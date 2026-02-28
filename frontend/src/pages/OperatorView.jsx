import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import axios from 'axios'

const API = '/api'

const TYPES = {
  intrusion:          'Intrusión gabinete',
  low_battery:        'Batería baja',
  power_loss:         'Pérdida energía',
  geofence:           'Geocerca',
  shock:              'Golpe / Choque',
  disconnect:         'Desconexión',
  overtemperature:    'Sobretemperatura',
  disconnect_battery: 'Desconexión batería',
  weak_signal:        'Señal débil',
}

const SEV = {
  critical: { color: '#ff5252', bg: 'rgba(255,82,82,0.1)',  border: 'rgba(255,82,82,0.3)',  label: 'CRÍTICO' },
  warning:  { color: '#ffd740', bg: 'rgba(255,215,64,0.1)', border: 'rgba(255,215,64,0.3)', label: 'AVISO'   },
  info:     { color: '#5a9fff', bg: 'rgba(90,159,255,0.1)', border: 'rgba(90,159,255,0.3)', label: 'INFO'    },
}

const STATUS_CFG = {
  pending:   { color: '#ff5252', label: 'Pendiente',   icon: '🔴' },
  attending: { color: '#ffd740', label: 'Atendiendo',  icon: '🟡' },
  resolved:  { color: '#00e676', label: 'Resuelto',    icon: '🟢' },
}

// Cronómetro SLA — muestra tiempo restante o tiempo excedido
function SLATimer({ deadline, label, compact }) {
  const [display, setDisplay] = useState('')
  const [overdue, setOverdue] = useState(false)

  useEffect(() => {
    function update() {
      const diff = new Date(deadline).getTime() - Date.now()
      const abs = Math.abs(diff)
      const h = Math.floor(abs / 3600000)
      const m = Math.floor((abs % 3600000) / 60000)
      const s = Math.floor((abs % 60000) / 1000)
      setOverdue(diff < 0)
      if (h > 24) {
        const d = Math.floor(h / 24)
        setDisplay(`${d}d ${h % 24}h`)
      } else {
        setDisplay(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
      }
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [deadline])

  if (compact) {
    return (
      <span style={{
        fontFamily: "'DM Mono',monospace", fontSize: 10,
        color: overdue ? '#ff5252' : '#ffd740',
        background: overdue ? 'rgba(255,82,82,0.1)' : 'rgba(255,215,64,0.08)',
        border: `1px solid ${overdue ? 'rgba(255,82,82,0.3)' : 'rgba(255,215,64,0.2)'}`,
        borderRadius: 4, padding: '2px 6px',
      }}>
        {overdue ? '⚠ +' : ''}{display}
      </span>
    )
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center',
      background: overdue ? 'rgba(255,82,82,0.08)' : 'rgba(26,111,255,0.05)',
      border: `1px solid ${overdue ? 'rgba(255,82,82,0.25)' : 'rgba(26,48,80,0.6)'}`,
      borderRadius: 8, padding: '6px 10px', minWidth: 80,
    }}>
      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#3d5a80', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </span>
      <span style={{
        fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700,
        color: overdue ? '#ff5252' : '#e8f0fe',
      }}>
        {overdue ? '⚠ ' : ''}{display}
      </span>
      {overdue && <span style={{ fontSize: 8, color: '#ff5252' }}>EXCEDIDO</span>}
    </div>
  )
}

export default function OperatorView() {
  const navigate = useNavigate()
  const { user, devices, telemetry } = useStore()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('assigned') // assigned | pending | attending | all
  const [actionLoading, setActionLoading] = useState({})
  const [assignedDeviceIds, setAssignedDeviceIds] = useState([])

  // Cargar paradas asignadas al operador
  useEffect(() => {
    if (!user?.id) return
    axios.get(`${API}/users/${user.id}/devices`)
      .then(r => setAssignedDeviceIds(r.data.map(d => d.device_id)))
      .catch(() => setAssignedDeviceIds([]))
  }, [user?.id])

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: 200 }
      // Para "assigned" y otros filtros traemos todos y filtramos en frontend
      if (filter === 'pending')   params.status = 'pending'
      if (filter === 'attending') params.status = 'attending'
      const { data } = await axios.get(`${API}/events`, { params })
      setEvents(data.events || [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [filter])

  useEffect(() => {
    fetchEvents()
    const t = setInterval(fetchEvents, 15000)
    return () => clearInterval(t)
  }, [fetchEvents])

  async function attend(id) {
    setActionLoading(a => ({ ...a, [id]: 'attend' }))
    try {
      await axios.put(`${API}/events/${id}/attend`)
      fetchEvents()
    } catch (e) {}
    setActionLoading(a => ({ ...a, [id]: null }))
  }

  async function resolve(id) {
    setActionLoading(a => ({ ...a, [id]: 'resolve' }))
    try {
      await axios.put(`${API}/events/${id}/resolve`)
      fetchEvents()
    } catch (e) {}
    setActionLoading(a => ({ ...a, [id]: null }))
  }

  // Filtrar eventos según tab activo
  const assignedEvents = events.filter(e => assignedDeviceIds.includes(e.device_id))
  const visibleEvents = filter === 'assigned'
    ? assignedEvents.filter(e => e.status !== 'resolved')
    : events

  const pendingCount   = assignedEvents.filter(e => e.status === 'pending').length
  const attendingCount = assignedEvents.filter(e => e.status === 'attending').length
  const criticalCount  = assignedEvents.filter(e => e.severity === 'critical' && e.status !== 'resolved').length

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid #1a3050',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 800 }}>
            Panel Operador
          </h1>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#3d5a80', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>
            {user?.username} · Gestión de alertas en tiempo real
          </div>
        </div>

        {/* KPIs rápidos */}
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'Pendientes', value: pendingCount,   color: '#ff5252' },
            { label: 'Atendiendo', value: attendingCount, color: '#ffd740' },
            { label: 'Críticos',   value: criticalCount,  color: '#ff5252' },
          ].map(k => (
            <div key={k.label} style={{
              background: '#0c1829', border: '1px solid #1a3050', borderRadius: 8,
              padding: '6px 14px', textAlign: 'center',
            }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 8, color: '#3d5a80', textTransform: 'uppercase' }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ padding: '8px 20px', borderBottom: '1px solid #1a3050', display: 'flex', gap: 6, flexShrink: 0 }}>
        {[
          { id: 'assigned',  label: '📍 Asignadas' },
          { id: 'pending',   label: '🔴 Pendientes' },
          { id: 'attending', label: '🟡 Atendiendo' },
          { id: 'all',       label: '📋 Todos' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            background: filter === f.id ? 'rgba(26,111,255,0.15)' : 'transparent',
            border: `1px solid ${filter === f.id ? 'rgba(26,111,255,0.4)' : '#1a3050'}`,
            borderRadius: 6, padding: '5px 14px', cursor: 'pointer',
            color: filter === f.id ? '#5a9fff' : '#6b8ab0', fontSize: 12,
          }}>
            {f.label}
          </button>
        ))}
        <button onClick={fetchEvents} style={{
          marginLeft: 'auto', background: 'none', border: '1px solid #1a3050',
          borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: '#6b8ab0', fontSize: 12,
        }}>
          ↻ Actualizar
        </button>
      </div>

      {/* Lista de alertas */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && events.length === 0 && (
          <div style={{ textAlign: 'center', color: '#3d5a80', padding: 40 }}>Cargando alertas...</div>
        )}

        {!loading && visibleEvents.length === 0 && (
          <div style={{ textAlign: 'center', color: '#3d5a80', padding: 60 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700 }}>
              {filter === 'assigned' ? 'Sin alertas en tus paradas' : 'Sin alertas pendientes'}
            </div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              {filter === 'assigned'
                ? `Monitoreando ${assignedDeviceIds.length} paradas asignadas`
                : 'Todas las alertas están atendidas'}
            </div>
          </div>
        )}

        {visibleEvents.map(ev => {
          const sev = SEV[ev.severity] || SEV.info
          const st  = STATUS_CFG[ev.status] || STATUS_CFG.pending
          const device = devices.find(d => d.device_id === ev.device_id)
          const t = telemetry[ev.device_id] || {}
          const tsStr = ev.ts ? new Date(ev.ts.endsWith('Z') ? ev.ts : ev.ts + 'Z')
            .toLocaleString('es-EC', { timeZone: 'America/Guayaquil' }) : '--'

          return (
            <div key={ev.id} style={{
              background: '#0c1829',
              border: `1px solid ${ev.status === 'resolved' ? '#1a3050' : sev.border}`,
              borderLeft: `4px solid ${sev.color}`,
              borderRadius: 12, padding: '14px 16px',
              opacity: ev.status === 'resolved' ? 0.6 : 1,
            }}>
              {/* Fila superior */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  {/* Tipo + severidad */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
                      background: sev.bg, border: `1px solid ${sev.border}`,
                      color: sev.color, borderRadius: 4, padding: '2px 7px',
                    }}>{sev.label}</span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{TYPES[ev.type] || ev.type}</span>
                    <span style={{ fontSize: 10, color: st.color }}>{st.icon} {st.label}</span>
                  </div>

                  {/* Mensaje */}
                  <div style={{ fontSize: 12, color: '#b0c4de', marginBottom: 4 }}>{ev.message}</div>

                  {/* Parada + hora */}
                  <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#3d5a80' }}>
                    <span>📍 {ev.device_name || ev.device_id}</span>
                    <span>🕐 {tsStr}</span>
                    {ev.attended_by && <span>👤 Atendido por: {ev.attended_by}</span>}
                    {ev.resolved_by  && <span>✅ Resuelto por: {ev.resolved_by}</span>}
                  </div>
                </div>

                {/* Cronómetros SLA */}
                {ev.status !== 'resolved' && (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {ev.status === 'pending' && (
                      <SLATimer deadline={ev.sla_attend_deadline} label="Atención" />
                    )}
                    <SLATimer deadline={ev.sla_resolve_deadline} label="Resolución" />
                  </div>
                )}
              </div>

              {/* Telemetría live de la parada */}
              {device && ev.status !== 'resolved' && (
                <div style={{
                  display: 'flex', gap: 10, marginBottom: 12,
                  padding: '8px 10px', background: '#060d1a', borderRadius: 8,
                  fontSize: 10, fontFamily: "'DM Mono',monospace",
                }}>
                  <span style={{ color: '#3d5a80' }}>Estado live:</span>
                  <span style={{ color: device.status === 'online' ? '#00e676' : '#ff5252' }}>
                    {device.status === 'online' ? '● EN LÍNEA' : '● OFFLINE'}
                  </span>
                  <span style={{ color: '#1a6fff' }}>SOC {t.soc ?? device.soc ?? '--'}%</span>
                  <span style={{ color: '#ffd740' }}>{t.panel_power ? `☀ ${t.panel_power.toFixed(0)}W` : ''}</span>
                  <span style={{ color: '#ff9800' }}>{t.temperature ? `🌡 ${t.temperature.toFixed(1)}°C` : ''}</span>
                  <button
                    onClick={() => navigate(`/device/${ev.device_id}`)}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#5a9fff', cursor: 'pointer', fontSize: 10 }}
                  >
                    Ver parada →
                  </button>
                </div>
              )}

              {/* Botones de acción */}
              {ev.status !== 'resolved' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {ev.status === 'pending' && (
                    <button
                      onClick={() => attend(ev.id)}
                      disabled={!!actionLoading[ev.id]}
                      style={{
                        background: 'rgba(255,215,64,0.1)', border: '1px solid rgba(255,215,64,0.4)',
                        borderRadius: 8, padding: '7px 18px', cursor: 'pointer',
                        color: '#ffd740', fontSize: 12, fontWeight: 600,
                        opacity: actionLoading[ev.id] ? 0.5 : 1,
                      }}
                    >
                      {actionLoading[ev.id] === 'attend' ? '...' : '🟡 Atender'}
                    </button>
                  )}
                  {(ev.status === 'pending' || ev.status === 'attending') && (
                    <button
                      onClick={() => resolve(ev.id)}
                      disabled={!!actionLoading[ev.id]}
                      style={{
                        background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.4)',
                        borderRadius: 8, padding: '7px 18px', cursor: 'pointer',
                        color: '#00e676', fontSize: 12, fontWeight: 600,
                        opacity: actionLoading[ev.id] ? 0.5 : 1,
                      }}
                    >
                      {actionLoading[ev.id] === 'resolve' ? '...' : '✅ Resuelto'}
                    </button>
                  )}
                </div>
              )}

              {/* Resuelto — mostrar tiempos */}
              {ev.status === 'resolved' && ev.resolved_at && (
                <div style={{ fontSize: 10, color: '#00e676', fontFamily: "'DM Mono',monospace" }}>
                  ✅ Resuelto el {new Date(ev.resolved_at.endsWith('Z') ? ev.resolved_at : ev.resolved_at + 'Z')
                    .toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })} por {ev.resolved_by}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
