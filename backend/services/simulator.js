/**
 * SolarTrack — Simulador de telemetría realista
 *
 * Hardware real:
 *   GV310LAU   → LTE Cat4, BLE 5.2, buffer 30k pos, autonomía 36h
 *   Tracer-AN  → MPPT 3 etapas, 98% eficiencia, RS485
 *   LFP 1.28kWh→ 100Ah, 12.8V, 4S1P, corte 14.4V/10.4V
 *
 * Plan SIM M2M:
 *   Modo pasivo:    1 reporte cada 15 min  (2,880/mes · 150 bytes)
 *   Modo intensivo: 1 reporte cada 15 seg  (~2,700/mes · variable)
 *   Keep-alive:     ~1 MB/mes
 *   Total estimado: 2.5 MB/mes por chip
 *   Plan contratado: 10 MB/mes (margen OTA + picos)
 *   APN: Pasivo · Servidor Nube · Bidireccional
 *
 * REEMPLAZAR con webhooks reales al conectar hardware.
 */

const db = require('../db');

// Cuenca, Azuay, Ecuador
// Paradas distribuidas por la ciudad: Terminal, Centro Histórico, Totoracocha, Baños, U de Cuenca
const devices = [
  { id: 'GV310-EC-4471', lat: -2.8889, lng: -78.9988, imei: '863286020377033' }, // Terminal Terrestre
  { id: 'GV310-EC-4472', lat: -2.8970, lng: -79.0045, imei: '863286020377034' }, // Parque Calderón
  { id: 'GV310-EC-4473', lat: -2.9001, lng: -79.0012, imei: '863286020377035' }, // Mercado 10 de Agosto
  { id: 'GV310-EC-4474', lat: -2.9058, lng: -79.0089, imei: '863286020377036' }, // Hospital Regional
  { id: 'GV310-EC-4475', lat: -2.9027, lng: -79.0001, imei: '863286020377037' }, // Universidad de Cuenca
  { id: 'GV310-EC-4476', lat: -2.8942, lng: -79.0163, imei: '863286020377038' }, // Feria Libre
  { id: 'GV310-EC-4477', lat: -2.8871, lng: -78.9893, imei: '863286020377039' }, // Sector Totoracocha
  { id: 'GV310-EC-4478', lat: -2.9212, lng: -79.0328, imei: '863286020377040' }, // Baños
];

// ── Constantes reales de hardware ────────────────────────────
const BAT = {
  nominalV: 12.8, chargeV: 14.4, dischargeV: 10.4,
  capacityAh: 100, energyWh: 1280,
  maxChargeA: 100, maxDischargeA: 150, cells: 4, cellNominalV: 3.2,
};
const PANEL = { maxW: 350, mpptEff: 0.98, mpptTrackEff: 0.995, vmpV: 38.1, vocV: 45.2 };
const GV310 = {
  bufferMax: 30000, autonomyH: 36, batteryMah: 250, accuracyM: 1.8,
  lteBands: ['B1','B2','B3','B4','B5','B7','B8','B28'],
  // Plan M2M
  msgBytes: 150,            // bytes por mensaje
  passiveReports: 2880,     // reportes/mes modo pasivo
  intensiveReports: 2700,   // reportes/mes modo intensivo
  planMB: 10,               // MB contratados por mes
  estimatedMB: 2.5,         // MB consumo real estimado
};

// Estado por dispositivo
const state = {};
// Estadísticas de datos simulados (espejo del plan M2M)
const dataStats = {
  totalReports: 0,
  totalBytes: 0,
  monthStart: new Date(),
};

function socToVoltage(soc) {
  if (soc > 95) return 13.5 + (soc - 95) * 0.02;
  if (soc > 20) return 12.8 + (soc - 50) * 0.008;
  return 10.4 + (soc / 20) * 2.4;
}

function getMPPTStage(soc) {
  if (soc < 80) return 'Bulk';
  if (soc < 95) return 'Absorción';
  return 'Float';
}

function rnd(base, delta) { return +(base + (Math.random() - 0.5) * delta).toFixed(4); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function init() {
  devices.forEach(d => {
    const soc = 70 + Math.random() * 25;
    state[d.id] = {
      lat: d.lat, lng: d.lng,
      soc,
      voltage: socToVoltage(soc),
      cell_v: [3.2, 3.2, 3.2, 3.2].map(v => v + (Math.random() - 0.5) * 0.05),
      temperature: 23 + Math.random() * 7,
      humidity: 58 + Math.random() * 12,
      rssi: -72 + Math.random() * 18,
      rsrp: -95 + Math.random() * 18,
      rsrq: -9 + Math.random() * 4,
      snr: 12 + Math.random() * 8,
      lteBand: GV310.lteBands[5 + Math.floor(Math.random() * 3)], // B7/B8/B28
      door1: 0, door2: 0, door3: 0, door4: 0,
      bufferedPositions: 0,
      uptime: Math.round(Math.random() * 86400 * 14),
      chargeStage: 'Bulk',
      // Modo intensivo (se activa con eventos)
      intensiveMode: false,
      intensiveModeUntil: 0,
    };
  });
}

async function createEventIfNew(deviceId, type, message, severity) {
  try {
    const existing = await db.get(
      `SELECT id FROM events WHERE device_id=? AND type=? AND resolved=0
       AND ts > datetime('now', '-10 minutes')`, [deviceId, type]
    );
    if (!existing) {
      await db.run(
        'INSERT INTO events (device_id,type,message,severity) VALUES (?,?,?,?)',
        [deviceId, type, message, severity]
      );
      // Al crear evento crítico → activar modo intensivo (simula comportamiento GV310)
      if (severity === 'critical' || severity === 'warning') {
        state[deviceId].intensiveMode = true;
        state[deviceId].intensiveModeUntil = Date.now() + (parseInt(process.env.INTENSIVE_DURATION) || 300) * 1000;
      }
    }
  } catch (e) {}
}

async function tick(io) {
  const now = new Date();
  const hour = now.getHours();
  const min = now.getMinutes();

  // Factor solar real — Cuenca lat ~-2.9°, max mediodía
  const solarFactor = (hour >= 6 && hour <= 18)
    ? Math.max(0, Math.sin(((hour + min / 60 - 6) / 12) * Math.PI))
    : 0;

  for (const d of devices) {
    const s = state[d.id]

    // Dispositivo offline (escenario choque) — no enviar más telemetría
    if (s.offline) continue;

    // Verificar si salir de modo intensivo
    if (s.intensiveMode && Date.now() > s.intensiveModeUntil) {
      s.intensiveMode = false;
    }

    // ── MPPT / Panel ────────────────────────────────────────
    const rawPower = solarFactor * PANEL.maxW * (0.75 + Math.random() * 0.25);
    const panelPower = +(rawPower * PANEL.mpptEff).toFixed(1);
    const panelVoltage = panelPower > 5 ? rnd(PANEL.vmpV, 2) : 0;
    const panelCurrent = panelVoltage > 0 ? +(panelPower / panelVoltage).toFixed(2) : 0;

    // ── Carga batería MPPT 3 etapas ──────────────────────────
    s.chargeStage = getMPPTStage(s.soc);
    let chargeA = 0;
    if (panelPower > 5) {
      if (s.chargeStage === 'Bulk')       chargeA = clamp(panelPower / s.voltage, 0, BAT.maxChargeA);
      else if (s.chargeStage === 'Absorción') chargeA = clamp(panelPower / s.voltage * 0.4, 0, 25);
      else                                chargeA = clamp(panelPower / s.voltage * 0.04, 0, 5);
    }
    const chargePower = +(chargeA * s.voltage).toFixed(1);

    // ── Descarga (LED + GV310 ~9-12W total) ─────────────────
    const loadW = 9 + Math.random() * 3;
    const dischargeA = clamp(loadW / s.voltage, 0.5, BAT.maxDischargeA);
    const dischargePower = +(dischargeA * s.voltage).toFixed(1);

    // ── SOC + voltaje LFP ────────────────────────────────────
    const netA = chargeA - dischargeA;
    const deltaSOC = (netA / BAT.capacityAh) * (15 / 3600) * 100;
    s.soc = clamp(s.soc + deltaSOC + (Math.random() - 0.5) * 0.03, 0, 100);
    s.voltage = clamp(socToVoltage(s.soc) + (Math.random() - 0.5) * 0.04, BAT.dischargeV, BAT.chargeV);

    // ── Celdas 4S1P ──────────────────────────────────────────
    const cellBase = s.voltage / BAT.cells;
    s.cell_v = s.cell_v.map(() => clamp(rnd(cellBase, 0.01), 2.5, 3.65));

    // ── Sensores WMS301 ───────────────────────────────────────
    s.temperature = clamp(s.temperature + (Math.random() - 0.5) * 0.4 + solarFactor * 0.1, 15, 55);
    s.humidity    = clamp(s.humidity    + (Math.random() - 0.5) * 0.8, 30, 90);

    // ── Señal LTE GV310LAU ────────────────────────────────────
    s.rssi = clamp(s.rssi + (Math.random() - 0.5) * 1.5, -110, -55);
    s.rsrp = clamp(s.rsrp + (Math.random() - 0.5) * 2,   -120, -70);
    s.rsrq = clamp(s.rsrq + (Math.random() - 0.5) * 0.5, -20, -3);
    s.snr  = clamp(s.snr  + (Math.random() - 0.5) * 1,     0, 30);

    // ── Buffer GV310 ─────────────────────────────────────────
    const hasSignal = s.rssi > -105;
    if (!hasSignal) s.bufferedPositions = Math.min(s.bufferedPositions + 1, GV310.bufferMax);
    else if (s.bufferedPositions > 0) s.bufferedPositions = Math.max(0, s.bufferedPositions - 10);

    s.uptime += 15;

    // ── Estadísticas de datos M2M ─────────────────────────────
    // Cada reporte = 150 bytes (especificación plan M2M)
    dataStats.totalReports++;
    dataStats.totalBytes += GV310.msgBytes;

    // ── Eventos automáticos ───────────────────────────────────
    if (Math.random() < 0.003) {
      const di = Math.floor(Math.random() * 4) + 1;
      s[`door${di}`] = s[`door${di}`] ? 0 : 1;
      if (s[`door${di}`])
        await createEventIfNew(d.id, 'intrusion', `Intrusión gabinete: puerta ${di} abierta`, 'critical');
    }
    if (s.soc < 20 && Math.random() < 0.05)
      await createEventIfNew(d.id, 'low_battery', `SOC crítico: ${s.soc.toFixed(1)}% / ${s.voltage.toFixed(2)}V`, 'critical');
    if (s.temperature > 45 && Math.random() < 0.08)
      await createEventIfNew(d.id, 'overtemperature', `Sobretemperatura: ${s.temperature.toFixed(1)}°C`, 'warning');
    if (panelPower < 2 && hour >= 9 && hour <= 16 && Math.random() < 0.008)
      await createEventIfNew(d.id, 'power_loss', `Pérdida generación solar en hora pico (${hour}:00)`, 'warning');
    if (Math.random() < 0.002)
      await createEventIfNew(d.id, 'shock', `Golpe/choque detectado (acelerómetro GV310LAU)`, 'warning');

    // ── Payload telemetría ────────────────────────────────────
    const telemetry = {
      device_id: d.id, imei: d.imei,
      lat: s.lat, lng: s.lng, speed: 0, heading: 0,
      gps_accuracy: GV310.accuracyM,
      buffered_positions: s.bufferedPositions,
      // Batería LFP
      soc: Math.round(s.soc),
      voltage: +s.voltage.toFixed(3),
      current_charge: +chargeA.toFixed(2),
      current_discharge: +dischargeA.toFixed(2),
      power_charge: chargePower,
      power_discharge: dischargePower,
      temperature: +s.temperature.toFixed(1),
      cell_v1: +s.cell_v[0].toFixed(3),
      cell_v2: +s.cell_v[1].toFixed(3),
      cell_v3: +s.cell_v[2].toFixed(3),
      cell_v4: +s.cell_v[3].toFixed(3),
      // Panel MPPT
      panel_voltage: panelVoltage,
      panel_current: panelCurrent,
      panel_power: panelPower,
      mppt_stage: s.chargeStage,
      mppt_efficiency: +(PANEL.mpptEff * 100).toFixed(1),
      // Señal LTE
      rssi: Math.round(s.rssi), rsrp: Math.round(s.rsrp),
      rsrq: +s.rsrq.toFixed(1), snr: +s.snr.toFixed(1),
      lte_band: s.lteBand,
      // Sensores WMS301
      humidity: +s.humidity.toFixed(1),
      door1: s.door1, door2: s.door2, door3: s.door3, door4: s.door4,
      // Sistema
      uptime: s.uptime,
      // Modo de reporte actual (para diagnóstico)
      report_mode: s.intensiveMode ? 'intensive' : 'passive',
      msg_bytes: GV310.msgBytes,
      ts: now.toISOString(),
    };

    // Guardar en DB
    try {
      await db.run(`
        INSERT INTO telemetry (device_id,lat,lng,speed,heading,soc,voltage,current_charge,
          current_discharge,power_charge,power_discharge,temperature,cell_v1,cell_v2,cell_v3,cell_v4,
          panel_voltage,panel_current,panel_power,rssi,rsrp,rsrq,
          door1,door2,door3,door4,humidity,lte_band,uptime)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [d.id, s.lat, s.lng, 0, 0,
         telemetry.soc, telemetry.voltage,
         telemetry.current_charge, telemetry.current_discharge,
         chargePower, dischargePower, telemetry.temperature,
         ...s.cell_v.map(v => +v.toFixed(3)),
         panelVoltage, panelCurrent, panelPower,
         telemetry.rssi, telemetry.rsrp, telemetry.rsrq,
         s.door1, s.door2, s.door3, s.door4,
         telemetry.humidity, s.lteBand, s.uptime]);

      await db.run('UPDATE devices SET last_seen=CURRENT_TIMESTAMP WHERE device_id=?', [d.id]);
    } catch (e) { console.error('DB tick error:', e.message); }

    io.to(`device:${d.id}`).emit('telemetry', telemetry);
    io.emit('telemetry_broadcast', telemetry);
  }
}

function getDataStats() {
  const msSinceStart = Date.now() - dataStats.monthStart.getTime();
  const daysSinceStart = msSinceStart / (1000 * 60 * 60 * 24);
  const projectedMonthlyMB = (dataStats.totalBytes / 1024 / 1024) * (30 / Math.max(daysSinceStart, 0.001));
  return {
    totalReports: dataStats.totalReports,
    totalKB: (dataStats.totalBytes / 1024).toFixed(2),
    projectedMonthlyMB: projectedMonthlyMB.toFixed(2),
    planMB: GV310.planMB,
    estimatedMB: GV310.estimatedMB,
  };
}

function simulateTelemetry(io) {
  init();

  let intervalMs = (parseInt(process.env.SIM_INTERVAL) || 15) * 1000;
  let tickTimer = null;

  function scheduleTick() {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(() => tick(io), intervalMs);
  }

  // Escuchar cambios de modo de reporte desde el endpoint
  process.on('report-mode-change', ({ intervalMs: newInterval, mode }) => {
    intervalMs = newInterval;
    scheduleTick();
    console.log(`⚙ Simulador: intervalo cambiado a ${newInterval / 1000}s (modo: ${mode})`);
  });

  setTimeout(() => tick(io), 2000);
  scheduleTick();

  // ── Escenario: choque en Parada 03 y Parada 05 ───────────────────────────
  // T+30s  → llega reporte de choque (acelerómetro GV310LAU)
  // T+45s  → señal se degrada rápidamente
  // T+60s  → último reporte antes de desconectarse
  // T+75s  → dispositivos dejan de reportar (offline)

  const crashDevices = ['GV310-EC-4473', 'GV310-EC-4475']

  setTimeout(async () => {
    console.log('🚨 ESCENARIO: Choque detectado en Parada 03 y Parada 05')
    for (const devId of crashDevices) {
      await createEventIfNew(devId, 'shock',
        'Impacto severo detectado — posible colisión de vehículo contra parada', 'critical')
      // Simular modo intensivo post-choque
      if (state[devId]) {
        state[devId].intensiveMode = true
        state[devId].intensiveModeUntil = Date.now() + 60000
      }
    }
  }, 30000) // 30 segundos después de arrancar

  setTimeout(async () => {
    console.log('📉 ESCENARIO: Señal degradándose en Parada 03 y Parada 05...')
    for (const devId of crashDevices) {
      if (state[devId]) {
        // Señal cae drásticamente — antena dañada por el impacto
        state[devId].rssi = -102
        state[devId].rsrp = -115
        state[devId].snr  = 1
      }
    }
  }, 45000) // 45 segundos

  setTimeout(async () => {
    console.log('📡 ESCENARIO: Último reporte de Parada 03 y Parada 05')
    for (const devId of crashDevices) {
      await createEventIfNew(devId, 'weak_signal',
        'Señal crítica — posible daño físico en antena GV310LAU', 'critical')
    }
  }, 60000) // 60 segundos

  setTimeout(async () => {
    console.log('🔴 ESCENARIO: Parada 03 y Parada 05 OFFLINE — sin señal')
    for (const devId of crashDevices) {
      // Marcar como offline en DB — dejar de enviar telemetría
      state[devId].offline = true
      await createEventIfNew(devId, 'disconnect_battery',
        'Dispositivo sin respuesta — sin reportes hace +15 min. Posible daño estructural por colisión', 'critical')
      // Actualizar last_seen con timestamp viejo para que aparezca offline
      try {
        const db = require('../db')
        await db.run(
          `UPDATE devices SET last_seen=datetime('now', '-20 minutes') WHERE device_id=?`,
          [devId]
        )
      } catch(e) {}
      io.emit('telemetry_broadcast', { device_id: devId, status: 'offline', ts: new Date().toISOString() })
    }
  }, 75000) // 75 segundos

  console.log(`📡 Simulador activo — intervalo: ${intervalMs / 1000}s (producción: 900s)`)
  console.log(`   Plan M2M: ${GV310.estimatedMB}MB/mes estimado · ${GV310.planMB}MB contratado`)
  console.log(`   Mensaje: ${GV310.msgBytes} bytes · ${GV310.passiveReports} reportes/mes pasivo`)
  console.log(`   Batería: LFP ${BAT.capacityAh}Ah/${BAT.energyWh}Wh · Panel: ${PANEL.maxW}W MPPT ${PANEL.mpptEff * 100}%`)
  console.log(`   🚨 Escenario demo: Parada 03 y 05 — choque → offline en ~75s`)
  console.log(`   ⚠  Reemplazar con webhooks reales al conectar hardware\n`)
}

module.exports = { simulateTelemetry, getDataStats };
