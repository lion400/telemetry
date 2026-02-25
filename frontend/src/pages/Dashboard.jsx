import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'

// Hardware constants (LFP1.28KWH12.8V-P65L2EV50 + GV310LAU + Tracer-AN G3)
const BAT_CHARGE_V  = 14.4
const BAT_DISCHARGE_V = 10.4
const PANEL_MAX_W   = 350
const MPPT_EFF      = 98

function StatCard({ label, value, unit, color, icon, sub }) {
  return (
    <div style={{
      background: '#0c1829', border: '1px solid #1a3050', borderRadius: 12,
      padding: '16px 20px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},transparent)` }} />
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1.5, color: '#3d5a80', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{icon}</span>{label}
      </div>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 32, fontWeight: 800, color }}>
        {value}<span style={{ fontSize: 16, color: '#6b8ab0', fontWeight: 400, marginLeft: 4 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 11, color: '#6b8ab0', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function DeviceRow({ device, telemetry, onClick }) {
  const t = telemetry?.[device.device_id] || {}
  const soc = t.soc ?? device.soc ?? '--'
  const status = device.status || 'offline'
  const doorOpen = t.door1 || t.door2 || t.door3 || t.door4
  const signalOk = (t.rssi ?? device.rssi ?? -200) > -100
  const mpptStage = t.mppt_stage ?? '--'

  const socColor = typeof soc === 'number'
    ? (soc > 50 ? '#00e676' : soc > 20 ? '#ffd740' : '#ff5252')
    : '#6b8ab0'

  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '1.8fr 65px 90px 70px 70px 70px 80px',
        alignItems: 'center', padding: '10px 16px',
        borderBottom: '1px solid #1a3050', cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#111f35'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div>
        <div style={{ fontWeight: 500, marginBottom: 2 }}>{device.name}</div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#3d5a80' }}>
          {device.device_id} · {device.address?.substring(0, 28)}
        </div>
      </div>

      {/* Estado */}
      <div>
        <span style={{
          fontSize: 9, padding: '2px 7px', borderRadius: 20,
          background: status === 'online' ? 'rgba(0,230,118,0.1)' : 'rgba(255,82,82,0.1)',
          color: status === 'online' ? '#00e676' : '#ff5252',
          border: `1px solid ${status === 'online' ? 'rgba(0,230,118,0.3)' : 'rgba(255,82,82,0.3)'}`,
          whiteSpace: 'nowrap',
        }}>
          {status === 'online' ? '● EN LÍNEA' : '● FUERA'}
        </span>
      </div>

      {/* SOC + barra */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ flex: 1, height: 6, background: '#111f35', borderRadius: 3, overflow: 'hidden', border: '1px solid #1a3050' }}>
            <div style={{ width: `${soc}%`, height: '100%', borderRadius: 3, background: socColor, transition: 'width 1s ease' }} />
          </div>
          <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: socColor, minWidth: 30 }}>
            {soc}%
          </span>
        </div>
      </div>

      {/* Voltaje */}
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: '#5a9fff' }}>
        {t.voltage ? `${t.voltage.toFixed(2)}V` : '--'}
      </div>

      {/* Panel solar */}
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: '#ffd740' }}>
        {t.panel_power !== undefined ? `${t.panel_power.toFixed(0)}W` : '--'}
      </div>

      {/* Temp */}
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: '#ff9800' }}>
        {t.temperature ? `${t.temperature.toFixed(1)}°C` : '--'}
      </div>

      {/* Puertas + señal */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {doorOpen
          ? <span style={{ fontSize: 9, color: '#ff5252' }}>🔓 ALERTA</span>
          : <span style={{ fontSize: 9, color: '#00e676' }}>🔒 OK</span>}
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: signalOk ? '#00d4ff' : '#ff5252' }}>
          {t.rssi ?? device.rssi ?? '--'} dBm
        </span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { devices, telemetry, events } = useStore()

  const stats = useMemo(() => {
    const online = devices.filter(d => d.status === 'online').length
    const avgSoc = devices.length
      ? Math.round(devices.reduce((a, d) => a + (telemetry[d.device_id]?.soc ?? d.soc ?? 0), 0) / devices.length)
      : 0
    const totalSolar = devices.reduce((a, d) => a + (telemetry[d.device_id]?.panel_power ?? 0), 0)
    const doorAlerts = devices.filter(d => {
      const t = telemetry[d.device_id] || {}
      return t.door1 || t.door2 || t.door3 || t.door4
    }).length
    const critEvents = events.filter(e => e.severity === 'critical' && !e.resolved).length
    return { online, total: devices.length, avgSoc, totalSolar, doorAlerts, critEvents }
  }, [devices, telemetry, events])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #1a3050', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800 }}>Dashboard</h1>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#3d5a80', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>
            GV310LAU · Tracer-AN G3 · LFP 1.28kWh · Panel 350W
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          <StatCard label="Paradas en línea" value={stats.online} unit={`/ ${stats.total}`}
            color="#00e676" icon="📡" sub={`Buffer GV310: 30k pos`} />
          <StatCard label="SOC promedio" value={stats.avgSoc} unit="%"
            color="#1a6fff" icon="🔋" sub="LFP 100Ah / 1.28kWh" />
          <StatCard label="Solar total" value={stats.totalSolar.toFixed(0)} unit="W"
            color="#ffd740" icon="☀" sub={`Panel 350W · MPPT ${MPPT_EFF}%`} />
          <StatCard label="Alertas críticas" value={stats.critEvents} unit=""
            color={stats.critEvents > 0 ? '#ff5252' : '#00e676'} icon="⚠"
            sub={stats.critEvents > 0 ? 'Requieren atención' : 'Sistema normal'} />
          <StatCard label="Puertas abiertas" value={stats.doorAlerts} unit=""
            color={stats.doorAlerts > 0 ? '#ffd740' : '#00e676'} icon="🚪"
            sub="Sensor WMS301 / BLE 5.2" />
        </div>

        {/* Tabla de paradas */}
        <div style={{ background: '#0c1829', border: '1px solid #1a3050', borderRadius: 12, overflow: 'hidden', flex: 1 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.8fr 65px 90px 70px 70px 70px 80px',
            padding: '10px 16px', borderBottom: '1px solid #1a3050',
            background: '#0c1829',
          }}>
            {['Parada', 'Estado', 'SOC', 'Voltaje', 'Solar', 'Temp.', 'Puertas/RSSI'].map(h => (
              <div key={h} style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1, color: '#3d5a80', textTransform: 'uppercase' }}>
                {h}
              </div>
            ))}
          </div>

          <div style={{ overflow: 'auto', maxHeight: 'calc(100% - 44px)' }}>
            {devices.map(d => (
              <DeviceRow key={d.device_id} device={d} telemetry={telemetry}
                onClick={() => navigate(`/device/${d.device_id}`)} />
            ))}
            {!devices.length && (
              <div style={{ padding: 40, textAlign: 'center', color: '#3d5a80' }}>
                Conectando con dispositivos...
              </div>
            )}
          </div>
        </div>

        {/* Hardware info bar */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
          background: '#0c1829', border: '1px solid #1a3050', borderRadius: 10,
          padding: '12px 16px',
        }}>
          {[
            { label: 'Tracker GPS', value: 'Queclink GV310LAU', sub: 'LTE Cat4 · BLE 5.2 · <2m CEP · 30k buffer', color: '#00d4ff' },
            { label: 'Controlador MPPT', value: 'EPEVER Tracer-AN G3', sub: '42A · 98% eficiencia · 3 etapas · RS485', color: '#ffd740' },
            { label: 'Batería LFP', value: 'LFP1.28KWH12.8V', sub: '100Ah · 12.8V · IP65 · >5000 ciclos', color: '#00e676' },
          ].map(h => (
            <div key={h.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 3, height: 36, borderRadius: 2, background: h.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#3d5a80', letterSpacing: 1, textTransform: 'uppercase' }}>{h.label}</div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, color: h.color }}>{h.value}</div>
                <div style={{ fontSize: 10, color: '#6b8ab0', marginTop: 1 }}>{h.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
