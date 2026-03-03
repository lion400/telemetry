import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'

const MPPT_EFF = 98

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768)
  React.useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return isMobile
}

function StatCard({ label, value, unit, color, icon, sub }) {
  const isMobile = useIsMobile()
  return (
    <div style={{
      background: 'var(--bg-card, var(--bg-card, #0c1829))', border: '1px solid #1a3050', borderRadius: 12,
      padding: isMobile ? '12px 14px' : '16px 20px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},transparent)` }} />
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1.5, color: 'var(--text-muted, var(--text-muted, #3d5a80))', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
        <span>{icon}</span>{label}
      </div>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: isMobile ? 24 : 32, fontWeight: 800, color }}>
        {value}<span style={{ fontSize: isMobile ? 13 : 16, color: 'var(--text-secondary, var(--text-secondary, #6b8ab0))', fontWeight: 400, marginLeft: 3 }}>{unit}</span>
      </div>
      {sub && !isMobile && <div style={{ fontSize: 10, color: 'var(--text-secondary, var(--text-secondary, #6b8ab0))', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// Fila de tabla — solo desktop
function DeviceRow({ device, telemetry, onClick }) {
  const t = telemetry?.[device.device_id] || {}
  const soc = t.soc ?? device.soc ?? '--'
  const status = device.status || 'offline'
  const doorOpen = t.door1 || t.door2 || t.door3 || t.door4
  const signalOk = (t.rssi ?? device.rssi ?? -200) > -100
  const socColor = typeof soc === 'number' ? (soc > 50 ? 'var(--online, var(--online, #00e676))' : soc > 20 ? 'var(--warning, var(--warning, #ffd740))' : 'var(--offline, var(--offline, #ff5252))') : 'var(--text-secondary, var(--text-secondary, #6b8ab0))'

  const { user } = useStore()
  return (
    <div onClick={onClick} style={{
      display: 'grid', gridTemplateColumns: '1.6fr 65px 90px 70px 90px 90px 70px 120px',
      alignItems: 'center', padding: '10px 16px',
      borderBottom: '1px solid #1a3050', cursor: 'pointer', transition: 'background 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input, var(--bg-input, #111f35))'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div>
        <div style={{ fontWeight: 500, marginBottom: 2 }}>{device.name}</div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: 'var(--text-muted, var(--text-muted, #3d5a80))' }}>
          {device.device_id} · {device.address?.substring(0, 28)}
        </div>
      </div>
      <div>
        <span style={{
          fontSize: 9, padding: '2px 7px', borderRadius: 20,
          background: status === 'online' ? 'rgba(0,230,118,0.1)' : 'rgba(255,82,82,0.1)',
          color: status === 'online' ? 'var(--online, var(--online, #00e676))' : 'var(--offline, var(--offline, #ff5252))',
          border: `1px solid ${status === 'online' ? 'rgba(0,230,118,0.3)' : 'rgba(255,82,82,0.3)'}`,
        }}>
          {status === 'online' ? '● LÍNEA' : '● FUERA'}
        </span>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ flex: 1, height: 6, background: 'var(--bg-input, var(--bg-input, #111f35))', borderRadius: 3, overflow: 'hidden', border: '1px solid #1a3050' }}>
            <div style={{ width: `${soc}%`, height: '100%', borderRadius: 3, background: socColor }} />
          </div>
          <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: socColor, minWidth: 30 }}>{soc}%</span>
        </div>
      </div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--accent, var(--accent, #5a9fff))' }}>
        {t.voltage ? `${t.voltage.toFixed(2)}V` : '--'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: 'var(--online, var(--online, #00e676))' }}>
          ↑ {t.power_charge !== undefined ? `${t.power_charge.toFixed(0)}W` : '--'} · {t.current_charge !== undefined ? `${t.current_charge.toFixed(1)}A` : '--'}
        </span>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: 'var(--offline, var(--offline, #ff5252))' }}>
          ↓ {t.power_discharge !== undefined ? `${t.power_discharge.toFixed(0)}W` : '--'} · {t.current_discharge !== undefined ? `${t.current_discharge.toFixed(1)}A` : '--'}
        </span>
      </div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--warning, var(--warning, #ffd740))' }}>
        {t.panel_power !== undefined ? `${t.panel_power.toFixed(0)}W` : '--'}
      </div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: '#ff9800' }}>
        {t.temperature ? `${t.temperature.toFixed(1)}°C` : '--'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {doorOpen ? <span style={{ fontSize: 9, color: 'var(--offline, var(--offline, #ff5252))' }}>🔓 ALERTA</span>
                    : <span style={{ fontSize: 9, color: 'var(--online, var(--online, #00e676))' }}>🔒 OK</span>}
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: signalOk ? 'var(--accent2, var(--accent2, #00d4ff))' : 'var(--offline, var(--offline, #ff5252))' }}>
            {t.rssi ?? device.rssi ?? '--'} dBm
          </span>
        </div>
        {user?.role === 'gerente' && (
          <button
            onClick={(e) => { e.stopPropagation(); window.__onEditDevice(device) }}
            style={{ background: '#111f35', border: '1px solid #1a3050', color: '#fff', fontSize: 10, padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}>
            ✏️
          </button>
        )}
      </div>
    </div>
  )
}

// Tarjeta de parada — solo móvil
function DeviceCard({ device, telemetry, onClick }) {
  const t = telemetry?.[device.device_id] || {}
  const soc = t.soc ?? device.soc ?? '--'
  const status = device.status || 'offline'
  const doorOpen = t.door1 || t.door2 || t.door3 || t.door4
  const socColor = typeof soc === 'number' ? (soc > 50 ? 'var(--online, var(--online, #00e676))' : soc > 20 ? 'var(--warning, var(--warning, #ffd740))' : 'var(--offline, var(--offline, #ff5252))') : 'var(--text-secondary, var(--text-secondary, #6b8ab0))'

  return (
    <div onClick={onClick} style={{
      background: 'var(--bg-card, var(--bg-card, #0c1829))', border: '1px solid #1a3050', borderRadius: 12,
      padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.15s',
    }}
      onTouchStart={e => e.currentTarget.style.borderColor = 'var(--accent, var(--accent, #1a6fff))'}
      onTouchEnd={e => e.currentTarget.style.borderColor = 'var(--border, var(--border, #1a3050))'}
    >
      {/* Header tarjeta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{device.name}</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: 'var(--text-muted, var(--text-muted, #3d5a80))' }}>
            {device.address?.substring(0, 32)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{
            fontSize: 9, padding: '2px 8px', borderRadius: 20,
            background: status === 'online' ? 'rgba(0,230,118,0.1)' : 'rgba(255,82,82,0.1)',
            color: status === 'online' ? 'var(--online, var(--online, #00e676))' : 'var(--offline, var(--offline, #ff5252))',
            border: `1px solid ${status === 'online' ? 'rgba(0,230,118,0.3)' : 'rgba(255,82,82,0.3)'}`,
          }}>
            {status === 'online' ? '● EN LÍNEA' : '● FUERA'}
          </span>
          {doorOpen && <span style={{ fontSize: 9, color: 'var(--offline, var(--offline, #ff5252))' }}>🔓 PUERTA ABIERTA</span>}
        </div>
      </div>

      {/* SOC bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: 'var(--text-muted, var(--text-muted, #3d5a80))' }}>SOC</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700, color: socColor }}>{soc}%</span>
        </div>
        <div style={{ height: 6, background: 'var(--bg-input, var(--bg-input, #111f35))', borderRadius: 3, overflow: 'hidden', border: '1px solid #1a3050' }}>
          <div style={{ width: `${typeof soc === 'number' ? soc : 0}%`, height: '100%', background: socColor, borderRadius: 3, transition: 'width 1s ease' }} />
        </div>
      </div>

      {/* Métricas en fila */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {[
          { l: 'Voltaje',    v: t.voltage ? `${t.voltage.toFixed(2)}V` : '--', c: 'var(--accent, var(--accent, #5a9fff))' },
          { l: 'P.Carga',    v: t.power_charge !== undefined ? `${t.power_charge.toFixed(0)}W` : '--', c: 'var(--online, var(--online, #00e676))' },
          { l: 'P.Descarga', v: t.power_discharge !== undefined ? `${t.power_discharge.toFixed(0)}W` : '--', c: 'var(--offline, var(--offline, #ff5252))' },
          { l: 'Solar',      v: t.panel_power !== undefined ? `${t.panel_power.toFixed(0)}W` : '--', c: 'var(--warning, var(--warning, #ffd740))' },
          { l: 'Temp',       v: t.temperature ? `${t.temperature.toFixed(1)}°` : '--', c: '#ff9800' },
          { l: 'RSSI',       v: `${t.rssi ?? device.rssi ?? '--'} dBm`, c: (t.rssi ?? -200) > -100 ? 'var(--accent2, var(--accent2, #00d4ff))' : 'var(--offline, var(--offline, #ff5252))' },
        ].map(m => (
          <div key={m.l} style={{ background: 'var(--bg-input, var(--bg-input, #111f35))', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 8, color: 'var(--text-muted, var(--text-muted, #3d5a80))', marginBottom: 2 }}>{m.l}</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700, color: m.c }}>{m.v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { devices, telemetry, events } = useStore()
  const isMobile = useIsMobile()

  const [showDeviceForm, setShowDeviceForm] = useState(false)
  const [editingDevice, setEditingDevice] = useState(null)
  const [deviceForm, setDeviceForm] = useState({ device_id: '', imei: '', name: '', address: '', group_id: '', lat: '', lng: '', photo_url: '' })

  const { user, fetchDevices } = useStore()

  useEffect(() => {
    window.__onEditDevice = (d) => {
      setEditingDevice(d)
      setDeviceForm({
        device_id: d.device_id,
        imei: d.imei || '',
        name: d.name,
        address: d.address || '',
        group_id: d.group_id || '',
        lat: d.lat || '',
        lng: d.lng || '',
        photo_url: d.photo_url || ''
      })
      setShowDeviceForm(true)
    }
    return () => delete window.__onEditDevice
  }, [])

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

    // Report by Zone
    const zones = {}
    devices.forEach(d => {
      const z = d.group_name || 'Sin grupo'
      if (!zones[z]) zones[z] = { online: 0, total: 0, sumSoc: 0, sumSolar: 0 }
      zones[z].total++
      if (d.status === 'online') zones[z].online++
      zones[z].sumSoc += (telemetry[d.device_id]?.soc ?? d.soc ?? 0)
      zones[z].sumSolar += (telemetry[d.device_id]?.panel_power ?? 0)
    })

    const zoneStats = Object.entries(zones).map(([name, s]) => ({
      name,
      online: s.online,
      total: s.total,
      avgSoc: Math.round(s.sumSoc / s.total),
      totalSolar: Math.round(s.sumSolar)
    }))

    return { online, total: devices.length, avgSoc, totalSolar, doorAlerts, critEvents, zoneStats }
  }, [devices, telemetry, events])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: isMobile ? '10px 16px' : '14px 24px', borderBottom: '1px solid #1a3050' }}>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: isMobile ? 17 : 20, fontWeight: 800 }}>Dashboard</h1>
        {!isMobile && (
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: 'var(--text-muted, var(--text-muted, #3d5a80))', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>
            GV310LAU · Tracer-AN G3 · LFP 1.28kWh · Panel 350W
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '12px' : '16px 24px', display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 16 }}>

        {/* Device Management CRUD (Gerente only) */}
        {user?.role === 'gerente' && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
            <button
              onClick={() => { setEditingDevice(null); setDeviceForm({ device_id: '', imei: '', name: '', address: '', group_id: '', lat: '', lng: '', photo_url: '' }); setShowDeviceForm(!showDeviceForm) }}
              style={{
                background: 'var(--accent, #1a6fff)', border: 'none', borderRadius: 8, padding: '8px 16px',
                color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer'
              }}>
              {showDeviceForm ? '✕ Cerrar' : '+ Nueva Parada'}
            </button>
          </div>
        )}

        {showDeviceForm && (
          <div style={{ background: 'var(--bg-card, #0c1829)', border: '1px solid #1a3050', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <h3 style={{ marginBottom: 16, fontSize: 14 }}>{editingDevice ? 'Editar Parada' : 'Nueva Parada'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <input placeholder="Device ID (ej: GV310-EC-4471)" value={deviceForm.device_id} disabled={!!editingDevice} onChange={e => setDeviceForm({ ...deviceForm, device_id: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #1a3050', background: '#111f35', color: '#fff' }} />
              <input placeholder="IMEI" value={deviceForm.imei} onChange={e => setDeviceForm({ ...deviceForm, imei: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #1a3050', background: '#111f35', color: '#fff' }} />
              <input placeholder="Nombre" value={deviceForm.name} onChange={e => setDeviceForm({ ...deviceForm, name: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #1a3050', background: '#111f35', color: '#fff' }} />
              <input placeholder="Dirección" value={deviceForm.address} onChange={e => setDeviceForm({ ...deviceForm, address: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #1a3050', background: '#111f35', color: '#fff' }} />
              <input placeholder="Latitud" type="number" step="any" value={deviceForm.lat} onChange={e => setDeviceForm({ ...deviceForm, lat: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #1a3050', background: '#111f35', color: '#fff' }} />
              <input placeholder="Longitud" type="number" step="any" value={deviceForm.lng} onChange={e => setDeviceForm({ ...deviceForm, lng: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #1a3050', background: '#111f35', color: '#fff' }} />
              <input placeholder="Foto URL" value={deviceForm.photo_url} onChange={e => setDeviceForm({ ...deviceForm, photo_url: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #1a3050', background: '#111f35', color: '#fff' }} />
              <select value={deviceForm.group_id} onChange={e => setDeviceForm({ ...deviceForm, group_id: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #1a3050', background: '#111f35', color: '#fff' }}>
                <option value="">Seleccionar Grupo</option>
                <option value="1">Norte</option>
                <option value="2">Sur</option>
                <option value="3">Centro</option>
              </select>
            </div>
            <button
              onClick={async () => {
                try {
                  if (editingDevice) {
                    await axios.put(`/api/devices/${deviceForm.device_id}`, deviceForm)
                  } else {
                    await axios.post('/api/devices', deviceForm)
                  }
                  fetchDevices()
                  setShowDeviceForm(false)
                } catch (e) { alert(e.response?.data?.error || 'Error saving device') }
              }}
              style={{ marginTop: 16, background: 'var(--online, #00e676)', border: 'none', borderRadius: 8, padding: '10px 20px', color: '#000', fontWeight: 800, cursor: 'pointer' }}>
              {editingDevice ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        )}

        {/* KPIs — 2 columnas en móvil, 5 en desktop */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: isMobile ? 8 : 12 }}>
          <StatCard label="En línea" value={stats.online} unit={`/ ${stats.total}`} color="#00e676" icon="📡" sub="Buffer GV310: 30k pos" />
          <StatCard label="SOC prom." value={stats.avgSoc} unit="%" color="#1a6fff" icon="🔋" sub="LFP 100Ah / 1.28kWh" />
          <StatCard label="Solar" value={stats.totalSolar.toFixed(0)} unit="W" color="#ffd740" icon="☀" sub={`Panel 350W · MPPT ${MPPT_EFF}%`} />
          <StatCard label="Alertas" value={stats.critEvents} unit="" color={stats.critEvents > 0 ? 'var(--offline, var(--offline, #ff5252))' : 'var(--online, var(--online, #00e676))'} icon="⚠" sub={stats.critEvents > 0 ? 'Atención' : 'Normal'} />
          {/* En móvil el 5to KPI ocupa las 2 columnas */}
          <div style={isMobile ? { gridColumn: '1 / -1' } : {}}>
            <StatCard label="Puertas" value={stats.doorAlerts} unit="" color={stats.doorAlerts > 0 ? 'var(--warning, var(--warning, #ffd740))' : 'var(--online, var(--online, #00e676))'} icon="🚪" sub="Sensor WMS301 / BLE 5.2" />
          </div>
        </div>

        {/* Reporte por Secciones (Zonas) */}
        <div style={{ background: 'var(--bg-card, #0c1829)', border: '1px solid #1a3050', borderRadius: 12, padding: 16 }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: 'var(--text-muted, #3d5a80)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>
            Reporte por Secciones / Zonas
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
            {stats.zoneStats.map(z => (
              <div key={z.name} style={{ background: 'var(--bg-input, #111f35)', borderRadius: 10, padding: 12, border: '1px solid #1a3050' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--accent2, #00d4ff)', marginBottom: 8, textTransform: 'uppercase' }}>{z.name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted, #3d5a80)' }}>Estado</div>
                    <div style={{ fontSize: 12 }}>{z.online} / {z.total} online</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted, #3d5a80)' }}>SOC Prom.</div>
                    <div style={{ fontSize: 12, color: z.avgSoc > 50 ? '#00e676' : '#ffd740' }}>{z.avgSoc}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted, #3d5a80)' }}>Gen. Solar</div>
                    <div style={{ fontSize: 12, color: '#ffd740' }}>{z.totalSolar}W</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Paradas — tabla en desktop, tarjetas en móvil */}
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: 'var(--text-muted, var(--text-muted, #3d5a80))', letterSpacing: 1.5, textTransform: 'uppercase', padding: '0 2px' }}>
              Paradas · {devices.length} unidades
            </div>
            {devices.map(d => (
              <DeviceCard key={d.device_id} device={d} telemetry={telemetry}
                onClick={() => navigate(`/device/${d.device_id}`)} />
            ))}
            {!devices.length && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #3d5a80))' }}>Conectando...</div>
            )}
          </div>
        ) : (
          <div style={{ background: 'var(--bg-card, var(--bg-card, #0c1829))', border: '1px solid #1a3050', borderRadius: 12, overflow: 'hidden', flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 65px 90px 70px 90px 90px 70px 120px', padding: '10px 16px', borderBottom: '1px solid #1a3050', background: 'var(--bg-card, var(--bg-card, #0c1829))' }}>
              {['Parada', 'Estado', 'SOC', 'Voltaje', 'Carga / Descarga', 'Solar', 'Temp.', 'Puertas/RSSI/Acción'].map(h => (
                <div key={h} style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1, color: 'var(--text-muted, var(--text-muted, #3d5a80))', textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>
            <div style={{ overflow: 'auto', maxHeight: 'calc(100% - 44px)' }}>
              {devices.map(d => (
                <DeviceRow key={d.device_id} device={d} telemetry={telemetry}
                  onClick={() => navigate(`/device/${d.device_id}`)} />
              ))}
              {!devices.length && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #3d5a80))' }}>Conectando con dispositivos...</div>
              )}
            </div>
          </div>
        )}

        {/* Hardware info — oculto en móvil */}
        {!isMobile && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, background: 'var(--bg-card, var(--bg-card, #0c1829))', border: '1px solid #1a3050', borderRadius: 10, padding: '12px 16px' }}>
            {[
              { label: 'Tracker GPS', value: 'Queclink GV310LAU', sub: 'LTE Cat4 · BLE 5.2 · <2m CEP · 30k buffer', color: 'var(--accent2, var(--accent2, #00d4ff))' },
              { label: 'Controlador MPPT', value: 'EPEVER Tracer-AN G3', sub: '42A · 98% eficiencia · 3 etapas · RS485', color: 'var(--warning, var(--warning, #ffd740))' },
              { label: 'Batería LFP', value: 'LFP1.28KWH12.8V', sub: '100Ah · 12.8V · IP65 · >5000 ciclos', color: 'var(--online, var(--online, #00e676))' },
            ].map(h => (
              <div key={h.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 3, height: 36, borderRadius: 2, background: h.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: 'var(--text-muted, var(--text-muted, #3d5a80))', letterSpacing: 1, textTransform: 'uppercase' }}>{h.label}</div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, color: h.color }}>{h.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary, var(--text-secondary, #6b8ab0))', marginTop: 1 }}>{h.sub}</div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
