const express = require('express');
const router = express.Router();
const db = require('../db');

// ── Listar paradas con último telemetría ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const devices = await db.all(`
      SELECT d.*, g.name as group_name, g.color as group_color,
        t.soc, t.voltage, t.temperature, t.humidity, t.rssi, t.lte_band,
        t.lat as current_lat, t.lng as current_lng, t.ts as last_telemetry,
        t.door1, t.door2, t.door3, t.door4,
        t.panel_power, t.mppt_stage, t.current_charge, t.power_charge,
        t.buffered_positions,
        CASE WHEN datetime(d.last_seen) > datetime('now', '-5 minutes')
             THEN 'online' ELSE 'offline' END as status
      FROM devices d
      LEFT JOIN groups g ON d.group_id = g.id
      LEFT JOIN telemetry t ON t.id = (
        SELECT id FROM telemetry WHERE device_id = d.device_id ORDER BY ts DESC LIMIT 1
      )
      WHERE d.active = 1
      ORDER BY g.name, d.name
    `);
    res.json(devices);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── Detalle de parada ─────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const device = await db.get(`
    SELECT d.*, g.name as group_name, g.color as group_color
    FROM devices d LEFT JOIN groups g ON d.group_id = g.id
    WHERE d.device_id = ? AND d.active = 1
  `, [req.params.id]);
  if (!device) return res.status(404).json({ error: 'No encontrado' });
  res.json(device);
});

// ── Actualizar parada ─────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { name, address, group_id, photo_url } = req.body;
  await db.run(
    'UPDATE devices SET name=?, address=?, group_id=?, photo_url=? WHERE device_id=?',
    [name, address, group_id, photo_url, req.params.id]
  );
  res.json({ ok: true });
});

// ── Grupos ────────────────────────────────────────────────────────────────────
router.get('/meta/groups', async (req, res) => {
  const groups = await db.all('SELECT * FROM groups ORDER BY name');
  res.json(groups);
});

// ── Webhook Queclink GV310LAU ─────────────────────────────────────────────────
// El GV310LAU reporta en ASCII propietario o JSON según configuración.
// Este endpoint acepta el JSON parseado por el servidor intermediario.
// Campos soportados:
//   imei / device_id / unitId  → identificador
//   lat / latitude             → latitud
//   lng / longitude            → longitud
//   speed, heading, ts
//   rssi, rsrp, rsrq, snr, lte_band
//   door1..4, temperature, humidity  (sensores WMS301 via BLE 5.2)
router.post('/webhook/queclink', async (req, res) => {
  try {
    const data = req.body;
    const deviceId = data.imei || data.device_id || data.unitId;
    if (!deviceId) return res.status(400).json({ error: 'No device ID / IMEI' });

    const io = req.app.get('io');

    // Buscar device_id por IMEI si viene el IMEI directo
    let resolvedId = deviceId;
    const byImei = await db.get('SELECT device_id FROM devices WHERE imei=?', [deviceId]);
    if (byImei) resolvedId = byImei.device_id;

    const telemetry = {
      device_id: resolvedId,
      lat:      data.lat || data.latitude,
      lng:      data.lng || data.longitude,
      speed:    data.speed || 0,
      heading:  data.heading || 0,
      gps_accuracy: data.accuracy || data.hdop || null,
      buffered_positions: data.buffered || 0,
      rssi:     data.rssi, rsrp: data.rsrp,
      rsrq:     data.rsrq, snr: data.snr,
      lte_band: data.lte_band || data.band,
      // WMS301 via BLE
      door1:       data.door1 || 0,
      door2:       data.door2 || 0,
      door3:       data.door3 || 0,
      door4:       data.door4 || 0,
      temperature: data.temperature,
      humidity:    data.humidity,
      ts:          data.ts || new Date().toISOString(),
    };

    await db.run(`
      INSERT INTO telemetry (device_id,lat,lng,speed,heading,gps_accuracy,
        buffered_positions,rssi,rsrp,rsrq,snr,lte_band,
        door1,door2,door3,door4,temperature,humidity)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [resolvedId, telemetry.lat, telemetry.lng, telemetry.speed, telemetry.heading,
       telemetry.gps_accuracy, telemetry.buffered_positions,
       telemetry.rssi, telemetry.rsrp, telemetry.rsrq, telemetry.snr, telemetry.lte_band,
       telemetry.door1, telemetry.door2, telemetry.door3, telemetry.door4,
       telemetry.temperature, telemetry.humidity]);

    await db.run('UPDATE devices SET last_seen=CURRENT_TIMESTAMP WHERE device_id=?', [resolvedId]);

    // Alertas automáticas de geocerca
    await checkGeofence(resolvedId, telemetry.lat, telemetry.lng, io);

    // Alertas de puertas
    for (let i = 1; i <= 4; i++) {
      if (telemetry[`door${i}`]) {
        await createEventIfNew(resolvedId, 'intrusion',
          `Intrusión detectada: puerta ${i} abierta (WMS301)`, 'critical');
      }
    }

    io.to(`device:${resolvedId}`).emit('telemetry', telemetry);
    io.emit('telemetry_broadcast', telemetry);
    res.json({ ok: true });
  } catch (e) {
    console.error('Queclink webhook error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Webhook EPEVER Tracer-AN G3 (vía script Modbus RS485→USB) ────────────────
// Script Python en el servidor lee registros Modbus del Tracer 4210AN G3
// y envía este JSON. Campos según mapa de registros EPEVER:
//   soc, voltage, current_charge, current_discharge
//   power_charge, power_discharge, temperature
//   panel_voltage, panel_current, panel_power
//   cell_v1..4 (si BMS lo entrega)
//   mppt_stage (0=Bulk,1=Absorción,2=Float)
router.post('/webhook/epever', async (req, res) => {
  try {
    const data = req.body;
    const { device_id } = data;
    if (!device_id) return res.status(400).json({ error: 'No device_id' });

    const io = req.app.get('io');

    // Mapear stage numérico → texto
    const stageMap = { 0: 'Bulk', 1: 'Absorción', 2: 'Float', 3: 'Equalización' };
    const mppt_stage = stageMap[data.mppt_stage] || data.mppt_stage || null;

    await db.run(`
      INSERT INTO telemetry (device_id,soc,voltage,current_charge,current_discharge,
        power_charge,power_discharge,temperature,cell_v1,cell_v2,cell_v3,cell_v4,
        panel_voltage,panel_current,panel_power,mppt_stage,mppt_efficiency)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [device_id, data.soc, data.voltage,
       data.current_charge, data.current_discharge,
       data.power_charge, data.power_discharge, data.temperature,
       data.cell_v1 || null, data.cell_v2 || null,
       data.cell_v3 || null, data.cell_v4 || null,
       data.panel_voltage, data.panel_current, data.panel_power,
       mppt_stage, data.mppt_efficiency || 98.0]);

    await db.run('UPDATE devices SET last_seen=CURRENT_TIMESTAMP WHERE device_id=?', [device_id]);

    // Alertas automáticas batería
    if (data.soc !== undefined && data.soc < 20)
      await createEventIfNew(device_id, 'low_battery',
        `SOC crítico: ${data.soc}% — ${data.voltage}V`, 'critical');

    if (data.voltage !== undefined && data.voltage < 10.8)
      await createEventIfNew(device_id, 'disconnect_battery',
        `Voltaje crítico: ${data.voltage}V — posible desconexión`, 'critical');

    if (data.temperature !== undefined && data.temperature > 45)
      await createEventIfNew(device_id, 'overtemperature',
        `Temperatura alta: ${data.temperature}°C`, 'warning');

    const payload = { device_id, ...data, mppt_stage };
    io.to(`device:${device_id}`).emit('telemetry', payload);
    io.emit('telemetry_broadcast', payload);
    res.json({ ok: true });
  } catch (e) {
    console.error('EPEVER webhook error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Helpers internos ──────────────────────────────────────────────────────────
async function createEventIfNew(deviceId, type, message, severity) {
  try {
    const existing = await db.get(
      `SELECT id FROM events WHERE device_id=? AND type=? AND resolved=0
       AND ts > datetime('now', '-10 minutes')`,
      [deviceId, type]
    );
    if (!existing) {
      await db.run(
        'INSERT INTO events (device_id,type,message,severity) VALUES (?,?,?,?)',
        [deviceId, type, message, severity]
      );
    }
  } catch (e) {}
}

async function checkGeofence(deviceId, lat, lng, io) {
  if (!lat || !lng) return;
  try {
    const geocercas = await db.all(
      'SELECT * FROM geocercas WHERE device_id=? AND active=1', [deviceId]
    );
    for (const g of geocercas) {
      if (g.type === 'circle' && g.center_lat && g.center_lng) {
        const dist = haversine(lat, lng, g.center_lat, g.center_lng);
        if (dist > g.radius) {
          await createEventIfNew(deviceId, 'geofence',
            `Parada fuera de geocerca "${g.name}" (${Math.round(dist)}m del centro)`, 'critical');
        }
      }
    }
  } catch (e) {}
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) *
            Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── Modo de reporte — gerente puede cambiar intervalo del simulador ──────────
// Estado global del intervalo (compartido con simulator.js)
let currentReportInterval = parseInt(process.env.SIM_INTERVAL) * 1000 || 15000;
let reportModeTimer = null;

function getCurrentReportInterval() { return currentReportInterval; }

router.post('/report-mode', verifyToken, requireRole('gerente'), (req, res) => {
  const { interval, duration, mode } = req.body;
  if (!interval || interval < 1) return res.status(400).json({ error: 'Intervalo inválido' });

  const intervalMs = interval * 1000;
  currentReportInterval = intervalMs;

  // Notificar al simulador via evento global
  process.emit('report-mode-change', { intervalMs, mode });

  if (reportModeTimer) clearTimeout(reportModeTimer);

  // Al terminar la duración → volver a normal automáticamente
  if (duration > 0) {
    reportModeTimer = setTimeout(() => {
      currentReportInterval = parseInt(process.env.SIM_INTERVAL) * 1000 || 15000;
      process.emit('report-mode-change', { intervalMs: currentReportInterval, mode: 'normal' });
    }, duration * 1000);
  }

  console.log(`⚙ Modo reporte: ${mode} · intervalo ${interval}s · duración ${duration}s`);
  res.json({ ok: true, interval, duration, mode });
});

module.exports = router;
module.exports.getCurrentReportInterval = getCurrentReportInterval;
