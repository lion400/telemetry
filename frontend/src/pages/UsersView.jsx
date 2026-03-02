import React, { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useStore } from '../store'

const API = '/api'

const ROLES = {
  gerente:    { color: '#ff9800', label: 'Gerente',    icon: '' },
  supervisor: { color: 'var(--warning, var(--warning, #ffd740))', label: 'Supervisor', icon: '🔭' },
  operador:   { color: 'var(--accent, var(--accent, #5a9fff))', label: 'Operador',   icon: '🛠' },
}

const REPORT_TYPES = [
  { id: 'telemetria',    label: '📊 Telemetría',    desc: 'Datos de batería, voltaje, temperatura en tiempo real' },
  { id: 'eventos',       label: '🔔 Eventos',        desc: 'Registro de alertas e incidentes de paradas' },
  { id: 'alertas',       label: '⚠️ Alertas',        desc: 'Notificaciones críticas y avisos automáticos' },
  { id: 'exportaciones', label: '📤 Exportaciones',  desc: 'Descarga de reportes en PDF, XLS y CSV' },
]

// ── Modal flotante de asignaciones ────────────────────────────────────────
function AssignModal({ user, devices, onClose, onSaved }) {
  const [tab, setTab]                         = useState('paradas')
  const [assignedDevices, setAssignedDevices] = useState([])
  const [assignedReports, setAssignedReports] = useState([])
  const [loading, setLoading]                 = useState(true)
  const [saving, setSaving]                   = useState(false)
  const [search, setSearch]                   = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      axios.get(`${API}/users/${user.id}/devices`),
      axios.get(`${API}/users/${user.id}/report-types`),
    ]).then(([devRes, repRes]) => {
      setAssignedDevices(devRes.data.map(d => d.device_id))
      setAssignedReports(repRes.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [user.id])

  const toggleDevice = (did) => setAssignedDevices(p =>
    p.includes(did) ? p.filter(d => d !== did) : [...p, did]
  )
  const toggleReport = (rt) => setAssignedReports(p =>
    p.includes(rt) ? p.filter(r => r !== rt) : [...p, rt]
  )

  const save = async () => {
    setSaving(true)
    try {
      await Promise.all([
        axios.put(`${API}/users/${user.id}/devices`,      { device_ids: assignedDevices }),
        axios.put(`${API}/users/${user.id}/report-types`, { report_types: assignedReports }),
      ])
      toast.success(`Asignaciones guardadas para ${user.username}`)
      onSaved()
      onClose()
    } catch { toast.error('Error guardando asignaciones') }
    setSaving(false)
  }

  const filtered = devices.filter(d =>
    d.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.address?.toLowerCase().includes(search.toLowerCase())
  )
  const grouped = filtered.reduce((g, d) => {
    const k = d.group_name || 'Sin grupo'
    if (!g[k]) g[k] = []
    g[k].push(d)
    return g
  }, {})

  const rol = ROLES[user.role] || ROLES.operador

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 620, maxHeight: '88vh',
          background: 'var(--bg-sidebar, var(--bg-sidebar, #0a1628))', border: '1px solid #1a3050',
          borderRadius: 16, display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px', borderBottom: '1px solid #1a3050',
          background: 'linear-gradient(135deg, var(--bg-card, #0c1829), var(--bg-input, #111f35))', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: `${rol.color}22`, border: `2px solid ${rol.color}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              }}>
                {rol.icon}
              </div>
              <div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 17, fontWeight: 800 }}>{user.username}</div>
                <div style={{ fontSize: 11, color: rol.color, fontFamily: "'DM Mono',monospace", marginTop: 2 }}>
                  {rol.label} · {user.email}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid #1a3050',
              borderRadius: 8, width: 32, height: 32, cursor: 'pointer',
              color: 'var(--text-secondary, var(--text-secondary, #6b8ab0))', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            {[
              { label: 'Paradas asignadas', value: assignedDevices.length, total: devices.length, color: 'var(--accent, var(--accent, #1a6fff))' },
              { label: 'Tipos de reporte',  value: assignedReports.length, total: REPORT_TYPES.length, color: 'var(--online, var(--online, #00e676))' },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1, background: 'var(--bg-hover, rgba(26,48,80,0.4))', borderRadius: 8,
                padding: '8px 14px', border: '1px solid #1a3050',
              }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color: s.color }}>
                  {loading ? '…' : s.value}
                  <span style={{ fontSize: 12, color: 'var(--text-muted, var(--text-muted, #3d5a80))', fontWeight: 400 }}> / {s.total}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary, var(--text-secondary, #6b8ab0))', fontFamily: "'DM Mono',monospace", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1a3050', flexShrink: 0 }}>
          {[
            { id: 'paradas',  label: '📍 Paradas',          count: assignedDevices.length },
            { id: 'reportes', label: '📋 Tipos de Reporte',  count: assignedReports.length },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '12px 8px', cursor: 'pointer',
              background: tab === t.id ? 'var(--nav-active-bg, rgba(26,111,255,0.08))' : 'transparent',
              border: 'none', borderBottom: `2px solid ${tab === t.id ? 'var(--accent, var(--accent, #1a6fff))' : 'transparent'}`,
              color: tab === t.id ? 'var(--accent, var(--accent, #5a9fff))' : 'var(--text-secondary, var(--text-secondary, #6b8ab0))',
              fontSize: 13, fontWeight: tab === t.id ? 700 : 400, transition: 'all 0.15s',
            }}>
              {t.label}
              {t.count > 0 && (
                <span style={{
                  marginLeft: 6, background: tab === t.id ? 'var(--accent, var(--accent, #1a6fff))' : 'var(--border, var(--border, #1a3050))',
                  color: tab === t.id ? '#fff' : 'var(--text-secondary, var(--text-secondary, #6b8ab0))',
                  borderRadius: 10, padding: '1px 7px', fontSize: 10, fontFamily: "'DM Mono',monospace",
                }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Contenido scrollable */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #3d5a80))', fontSize: 13 }}>
              Cargando asignaciones...
            </div>
          ) : tab === 'paradas' ? (
            <div style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
                <input
                  placeholder="Buscar parada..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    flex: 1, background: 'var(--bg-input, var(--bg-input, #111f35))', border: '1px solid #1a3050',
                    borderRadius: 8, padding: '7px 12px', color: 'var(--text-primary, var(--text-primary, #e8f0fe))', fontSize: 12, outline: 'none',
                  }}
                />
                <button onClick={() => setAssignedDevices(devices.map(d => d.device_id))} style={{
                  background: 'var(--nav-active-bg, rgba(26,111,255,0.1))', border: '1px solid rgba(26,111,255,0.3)',
                  borderRadius: 7, padding: '6px 12px', color: 'var(--accent, var(--accent, #5a9fff))', cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap',
                }}>✓ Todas</button>
                <button onClick={() => setAssignedDevices([])} style={{
                  background: 'none', border: '1px solid #1a3050',
                  borderRadius: 7, padding: '6px 12px', color: 'var(--text-secondary, var(--text-secondary, #6b8ab0))', cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap',
                }}>✕ Ninguna</button>
              </div>

              {Object.entries(grouped).map(([group, devs]) => (
                <div key={group} style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 9, color: 'var(--text-muted, var(--text-muted, #3d5a80))', fontFamily: "'DM Mono',monospace",
                    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span>{group}</span>
                    <span style={{ background: 'var(--border, var(--border, #1a3050))', borderRadius: 8, padding: '1px 6px' }}>{devs.length}</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border, var(--border, #1a3050))' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {devs.map(d => {
                      const checked = assignedDevices.includes(d.device_id)
                      return (
                        <div key={d.device_id} onClick={() => toggleDevice(d.device_id)} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                          background: checked ? 'var(--nav-active-bg, rgba(26,111,255,0.12))' : 'var(--bg-hover, rgba(26,48,80,0.25))',
                          border: `1px solid ${checked ? 'var(--accent-border, rgba(26,111,255,0.4))' : 'var(--bg-hover, rgba(26,48,80,0.5))'}`,
                          transition: 'all 0.12s', userSelect: 'none',
                        }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                            background: checked ? 'var(--accent, var(--accent, #1a6fff))' : 'transparent',
                            border: `2px solid ${checked ? 'var(--accent, var(--accent, #1a6fff))' : 'var(--text-muted, var(--text-muted, #3d5a80))'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.12s',
                          }}>
                            {checked && <span style={{ color: '#fff', fontSize: 11, lineHeight: 1 }}>✓</span>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 12, fontWeight: 600, color: checked ? 'var(--text-primary, var(--text-primary, #e8f0fe))' : 'var(--text-secondary, var(--text-secondary, #b0c4de))',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>{d.name}</div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted, var(--text-muted, #3d5a80))', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {d.address}
                            </div>
                          </div>
                          <div style={{
                            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                            background: d.status === 'online' ? 'var(--online, var(--online, #00e676))' : 'var(--offline, var(--offline, #ff5252))',
                            boxShadow: d.status === 'online' ? '0 0 6px #00e676' : 'none',
                          }} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #3d5a80))', padding: 30, fontSize: 13 }}>
                  Sin resultados para "{search}"
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '20px' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary, var(--text-secondary, #6b8ab0))', marginBottom: 16 }}>
                Define a qué secciones y tipos de reporte tiene acceso este usuario:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {REPORT_TYPES.map(rt => {
                  const checked = assignedReports.includes(rt.id)
                  return (
                    <div key={rt.id} onClick={() => toggleReport(rt.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                      background: checked ? 'var(--nav-active-bg, rgba(26,111,255,0.1))' : 'var(--bg-hover, rgba(26,48,80,0.2))',
                      border: `1px solid ${checked ? 'var(--accent-border, rgba(26,111,255,0.4))' : 'var(--bg-hover, rgba(26,48,80,0.5))'}`,
                      transition: 'all 0.12s', userSelect: 'none',
                    }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                        background: checked ? 'var(--accent, var(--accent, #1a6fff))' : 'transparent',
                        border: `2px solid ${checked ? 'var(--accent, var(--accent, #1a6fff))' : 'var(--text-muted, var(--text-muted, #3d5a80))'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.12s',
                      }}>
                        {checked && <span style={{ color: '#fff', fontSize: 13 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: checked ? 'var(--text-primary, var(--text-primary, #e8f0fe))' : 'var(--text-secondary, var(--text-secondary, #b0c4de))' }}>
                          {rt.label}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary, var(--text-secondary, #6b8ab0))', marginTop: 3 }}>{rt.desc}</div>
                      </div>
                      {checked && (
                        <span style={{
                          fontSize: 9, fontFamily: "'DM Mono',monospace", color: 'var(--accent, var(--accent, #1a6fff))',
                          background: 'var(--nav-active-bg, rgba(26,111,255,0.15))', border: '1px solid rgba(26,111,255,0.3)',
                          borderRadius: 8, padding: '2px 8px',
                        }}>ACTIVO</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid #1a3050',
          background: 'var(--bg-sidebar, var(--bg-sidebar, #0a1628))', flexShrink: 0, display: 'flex', gap: 10,
        }}>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid #1a3050', borderRadius: 8,
            padding: '10px 20px', cursor: 'pointer', color: 'var(--text-secondary, var(--text-secondary, #6b8ab0))', fontSize: 13,
          }}>Cancelar</button>
          <button onClick={save} disabled={saving} style={{
            flex: 1,
            background: saving ? 'var(--border, var(--border, #1a3050))' : 'linear-gradient(135deg, rgba(26,111,255,0.3), rgba(26,111,255,0.15))',
            border: `1px solid ${saving ? 'var(--border, var(--border, #1a3050))' : 'var(--accent-border, rgba(26,111,255,0.5))'}`,
            borderRadius: 8, padding: '10px', cursor: saving ? 'default' : 'pointer',
            color: saving ? 'var(--text-muted, var(--text-muted, #3d5a80))' : 'var(--accent, var(--accent, #5a9fff))', fontSize: 13, fontWeight: 700,
          }}>
            {saving ? '⏳ Guardando...' : '💾 Guardar asignaciones'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Vista principal ────────────────────────────────────────────────────────
export default function UsersView() {
  const { user: me, devices } = useStore()
  const [users, setUsers]         = useState([])
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({ username: '', email: '', password: '', role: 'operador' })
  const [log, setLog]             = useState([])
  const [modalUser, setModalUser] = useState(null)

  const fetchUsers = async () => {
    try {
      const { data } = await axios.get(`${API}/users`)
      setUsers(data)
    } catch { toast.error('Error cargando usuarios') }
  }

  const fetchLog = async () => {
    try {
      const { data } = await axios.get(`${API}/users/access-log`)
      setLog(data)
    } catch {}
  }

  useEffect(() => { fetchUsers(); fetchLog() }, [])

  const createUser = async (e) => {
    e.preventDefault()
    try {
      await axios.post(`${API}/users`, form)
      toast.success('Usuario creado')
      setShowForm(false)
      setForm({ username: '', email: '', password: '', role: 'operador' })
      fetchUsers()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error creando usuario')
    }
  }

  const toggleUser = async (id) => {
    await axios.put(`${API}/users/${id}/toggle`)
    fetchUsers()
  }

  const changeRole = async (id, role) => {
    try {
      await axios.put(`${API}/users/${id}/role`, { role })
      toast.success('Rol actualizado')
      fetchUsers()
    } catch { toast.error('Error cambiando rol') }
  }

  const inputStyle = {
    width: '100%', background: 'var(--bg-input, var(--bg-input, #111f35))', border: '1px solid #1a3050',
    borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary, var(--text-primary, #e8f0fe))', fontSize: 13,
    outline: 'none', marginBottom: 12,
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Modal flotante */}
      {modalUser && (
        <AssignModal
          user={modalUser}
          devices={devices}
          onClose={() => setModalUser(null)}
          onSaved={fetchUsers}
        />
      )}

      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #1a3050', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800 }}>Gestión de Usuarios</h1>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: 'var(--text-muted, var(--text-muted, #3d5a80))', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>
            {users.length} usuarios registrados
          </div>
        </div>
        {me?.role === 'gerente' && (
          <button onClick={() => setShowForm(s => !s)} style={{
            background: showForm ? 'var(--bg-input, var(--bg-input, #111f35))' : 'var(--nav-active-bg, rgba(26,111,255,0.15))',
            border: `1px solid ${showForm ? 'var(--border, var(--border, #1a3050))' : 'var(--accent-border, rgba(26,111,255,0.4))'}`,
            borderRadius: 8, padding: '8px 18px', cursor: 'pointer',
            color: showForm ? 'var(--text-secondary, var(--text-secondary, #6b8ab0))' : 'var(--accent, var(--accent, #5a9fff))', fontSize: 13, fontWeight: 600,
          }}>
            {showForm ? '✕ Cancelar' : '+ Nuevo usuario'}
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Formulario */}
        {showForm && (
          <div style={{ background: 'var(--bg-card, var(--bg-card, #0c1829))', border: '1px solid #1a3050', borderRadius: 12, padding: 20, maxWidth: 480 }}>
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, marginBottom: 14, color: 'var(--accent, var(--accent, #5a9fff))' }}>
              Nuevo Usuario
            </h3>
            <form onSubmit={createUser}>
              <input style={inputStyle} placeholder="Usuario" value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
              <input style={inputStyle} placeholder="Email" type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              <input style={inputStyle} placeholder="Contraseña" type="password" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="operador">🛠 Operador</option>
                <option value="supervisor">🔭 Supervisor</option>
                <option value="gerente">👑 Gerente</option>
              </select>
              <button type="submit" style={{
                width: '100%', background: 'var(--accent-dim, rgba(26,111,255,0.2))', border: '1px solid rgba(26,111,255,0.4)',
                borderRadius: 8, padding: '9px', color: 'var(--accent, var(--accent, #5a9fff))', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              }}>Crear Usuario</button>
            </form>
          </div>
        )}

        {/* Tabla de usuarios */}
        <div style={{ background: 'var(--bg-card, var(--bg-card, #0c1829))', border: '1px solid #1a3050', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-app, var(--bg-app, #060d1a))' }}>
                {['Usuario', 'Rol', 'Estado', 'Último acceso', 'Acciones'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left', borderBottom: '1px solid #1a3050',
                    fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1,
                    color: 'var(--text-muted, var(--text-muted, #3d5a80))', textTransform: 'uppercase', fontWeight: 400,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const rol = ROLES[u.role] || ROLES.operador
                return (
                  <tr key={u.id}
                    style={{ borderBottom: '1px solid rgba(26,48,80,0.5)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-hover, rgba(26,48,80,0.1))' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(26,111,255,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--bg-hover, rgba(26,48,80,0.1))'}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 10,
                          background: `${rol.color}22`, border: `1px solid ${rol.color}44`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
                        }}>{rol.icon}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{u.username}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted, var(--text-muted, #3d5a80))' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {me?.role === 'gerente' && u.id !== me?.id ? (
                        <select value={u.role} onChange={e => changeRole(u.id, e.target.value)} style={{
                          background: 'var(--bg-input, var(--bg-input, #111f35))', border: `1px solid ${rol.color}44`,
                          borderRadius: 6, padding: '4px 8px', color: rol.color,
                          fontSize: 11, cursor: 'pointer', fontWeight: 700,
                        }}>
                          <option value="operador">🛠 Operador</option>
                          <option value="supervisor">🔭 Supervisor</option>
                          <option value="gerente">👑 Gerente</option>
                        </select>
                      ) : (
                        <span style={{
                          fontSize: 11, padding: '3px 10px', borderRadius: 20,
                          background: `${rol.color}18`, color: rol.color,
                          border: `1px solid ${rol.color}40`, fontFamily: "'DM Mono',monospace",
                        }}>{rol.icon} {rol.label}</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: 11, padding: '3px 10px', borderRadius: 20, fontFamily: "'DM Mono',monospace",
                        background: u.active ? 'rgba(0,230,118,0.1)' : 'rgba(255,82,82,0.1)',
                        color: u.active ? 'var(--online, var(--online, #00e676))' : 'var(--offline, var(--offline, #ff5252))',
                        border: `1px solid ${u.active ? 'rgba(0,230,118,0.3)' : 'rgba(255,82,82,0.3)'}`,
                      }}>{u.active ? '● Activo' : '○ Inactivo'}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: "'DM Mono',monospace", fontSize: 10, color: 'var(--text-secondary, var(--text-secondary, #6b8ab0))' }}>
                      {u.last_login
                        ? new Date(u.last_login.endsWith('Z') ? u.last_login : u.last_login + 'Z')
                            .toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })
                        : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setModalUser(u)} style={{
                          background: 'var(--nav-active-bg, rgba(26,111,255,0.1))', border: '1px solid rgba(26,111,255,0.3)',
                          borderRadius: 7, padding: '5px 12px', cursor: 'pointer',
                          color: 'var(--accent, var(--accent, #5a9fff))', fontSize: 11, fontWeight: 600,
                        }}>⚙ Asignar</button>
                        {me?.role === 'gerente' && u.id !== me?.id && (
                          <button onClick={() => toggleUser(u.id)} style={{
                            background: 'none',
                            border: `1px solid ${u.active ? 'rgba(255,82,82,0.3)' : 'rgba(0,230,118,0.3)'}`,
                            borderRadius: 7, padding: '5px 12px',
                            color: u.active ? 'var(--offline, var(--offline, #ff5252))' : 'var(--online, var(--online, #00e676))',
                            cursor: 'pointer', fontSize: 11,
                          }}>{u.active ? 'Desactivar' : 'Activar'}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Bitácora */}
        {log.length > 0 && (
          <div style={{ background: 'var(--bg-card, var(--bg-card, #0c1829))', border: '1px solid #1a3050', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a3050', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700 }}>📋 Bitácora de Accesos</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: 'var(--text-muted, var(--text-muted, #3d5a80))', background: 'var(--bg-input, var(--bg-input, #111f35))', padding: '2px 8px', borderRadius: 8 }}>
                últimos {Math.min(log.length, 40)}
              </span>
            </div>
            <div style={{ maxHeight: 240, overflow: 'auto' }}>
              {log.slice(0, 40).map((l, i) => (
                <div key={i} style={{
                  padding: '8px 16px', borderBottom: '1px solid rgba(26,48,80,0.4)',
                  display: 'grid', gridTemplateColumns: '140px 100px 1fr 1fr', gap: 12,
                  fontSize: 11, alignItems: 'center',
                }}>
                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.username}</span>
                  <span style={{
                    color: l.action === 'login' ? 'var(--online, var(--online, #00e676))' : l.action === 'logout' ? 'var(--warning, var(--warning, #ffd740))' : 'var(--accent, var(--accent, #5a9fff))',
                    fontFamily: "'DM Mono',monospace", fontSize: 10,
                  }}>
                    {l.action === 'login' ? '→ Ingreso' : l.action === 'logout' ? '← Salida' : l.action}
                  </span>
                  <span style={{ color: 'var(--text-secondary, var(--text-secondary, #6b8ab0))', fontSize: 10, fontFamily: "'DM Mono',monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.location ? `📍 ${l.location}` : l.ip}
                  </span>
                  <span style={{ color: 'var(--text-muted, var(--text-muted, #3d5a80))', fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
                    {l.created_at ? new Date(l.created_at.endsWith('Z') ? l.created_at : l.created_at + 'Z')
                      .toLocaleString('es-EC', { timeZone: 'America/Guayaquil' }) : '--'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
