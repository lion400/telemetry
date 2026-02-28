import React, { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useStore } from '../store'

const API = '/api'

const ROLES = {
  gerente:    { color: '#ff9800', label: 'Gerente' },
  supervisor: { color: '#ffd740', label: 'Supervisor' },
  operador:   { color: '#5a9fff', label: 'Operador' },
}

const REPORT_TYPES = [
  { id: 'telemetria',    label: '📊 Telemetría',    desc: 'Datos de batería, voltaje, temperatura' },
  { id: 'eventos',       label: '🔔 Eventos',        desc: 'Alertas e incidentes de paradas' },
  { id: 'alertas',       label: '⚠️ Alertas',        desc: 'Notificaciones críticas y avisos' },
  { id: 'exportaciones', label: '📤 Exportaciones',  desc: 'PDF, XLS, CSV de reportes' },
]

export default function UsersView() {
  const { user: me, devices } = useStore()
  const [users, setUsers]               = useState([])
  const [showForm, setShowForm]         = useState(false)
  const [form, setForm]                 = useState({ username: '', email: '', password: '', role: 'operador' })
  const [log, setLog]                   = useState([])
  const [selectedUser, setSelectedUser] = useState(null)    // user being assigned
  const [assignTab, setAssignTab]       = useState('paradas') // 'paradas' | 'reportes'
  const [assignedDevices, setAssignedDevices]     = useState([])
  const [assignedReports, setAssignedReports]     = useState([])
  const [savingAssign, setSavingAssign] = useState(false)

  const fetchUsers = async () => {
    try {
      const { data } = await axios.get(`${API}/users`)
      setUsers(data)
    } catch (e) { toast.error('Error cargando usuarios') }
  }

  const fetchLog = async () => {
    try {
      const { data } = await axios.get(`${API}/users/access-log`)
      setLog(data)
    } catch (e) {}
  }

  useEffect(() => { fetchUsers(); fetchLog() }, [])

  // Cargar asignaciones cuando se selecciona un usuario
  useEffect(() => {
    if (!selectedUser) return
    axios.get(`${API}/users/${selectedUser.id}/devices`)
      .then(r => setAssignedDevices(r.data.map(d => d.device_id)))
      .catch(() => setAssignedDevices([]))
    axios.get(`${API}/users/${selectedUser.id}/report-types`)
      .then(r => setAssignedReports(r.data))
      .catch(() => setAssignedReports([]))
  }, [selectedUser])

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
      if (selectedUser?.id === id) setSelectedUser(u => ({ ...u, role }))
    } catch { toast.error('Error cambiando rol') }
  }

  const saveAssignments = async () => {
    setSavingAssign(true)
    try {
      await Promise.all([
        axios.put(`${API}/users/${selectedUser.id}/devices`, { device_ids: assignedDevices }),
        axios.put(`${API}/users/${selectedUser.id}/report-types`, { report_types: assignedReports }),
      ])
      toast.success(`Asignaciones guardadas para ${selectedUser.username}`)
    } catch { toast.error('Error guardando asignaciones') }
    setSavingAssign(false)
  }

  const toggleDevice = (did) => setAssignedDevices(prev =>
    prev.includes(did) ? prev.filter(d => d !== did) : [...prev, did]
  )
  const toggleReport = (rt) => setAssignedReports(prev =>
    prev.includes(rt) ? prev.filter(r => r !== rt) : [...prev, rt]
  )
  const selectAllDevices = () => setAssignedDevices(devices.map(d => d.device_id))
  const clearAllDevices  = () => setAssignedDevices([])

  // Agrupar dispositivos por grupo
  const grouped = devices.reduce((g, d) => {
    const k = d.group_name || 'Sin grupo'
    if (!g[k]) g[k] = []
    g[k].push(d)
    return g
  }, {})

  const inputStyle = {
    width: '100%', background: '#111f35', border: '1px solid #1a3050',
    borderRadius: 8, padding: '9px 12px', color: '#e8f0fe', fontSize: 13,
    outline: 'none', marginBottom: 12,
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #1a3050', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800 }}>Gestión de Usuarios</h1>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#3d5a80', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>
            {users.length} usuarios registrados
          </div>
        </div>
        {me?.role === 'gerente' && (
          <button onClick={() => setShowForm(s => !s)} style={{
            background: showForm ? '#111f35' : 'rgba(26,111,255,0.15)',
            border: `1px solid ${showForm ? '#1a3050' : 'rgba(26,111,255,0.4)'}`,
            borderRadius: 8, padding: '8px 18px', cursor: 'pointer',
            color: showForm ? '#6b8ab0' : '#5a9fff', fontSize: 13, fontWeight: 600,
          }}>
            {showForm ? '✕ Cancelar' : '+ Nuevo usuario'}
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Columna izquierda — lista + form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Formulario nuevo usuario */}
          {showForm && (
            <div style={{ background: '#0c1829', border: '1px solid #1a3050', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, marginBottom: 14, color: '#5a9fff' }}>
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
                  <option value="operador">Operador</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="gerente">Gerente</option>
                </select>
                <button type="submit" style={{
                  width: '100%', background: 'rgba(26,111,255,0.2)', border: '1px solid rgba(26,111,255,0.4)',
                  borderRadius: 8, padding: '9px', color: '#5a9fff', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                }}>
                  Crear Usuario
                </button>
              </form>
            </div>
          )}

          {/* Tabla de usuarios */}
          <div style={{ background: '#0c1829', border: '1px solid #1a3050', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#060d1a' }}>
                  {['Usuario', 'Rol', 'Estado', 'Paradas', 'Reportes', 'Acciones'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '1px solid #1a3050',
                      fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1, color: '#3d5a80', textTransform: 'uppercase', fontWeight: 400 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const rol = ROLES[u.role] || ROLES.operador
                  const isSelected = selectedUser?.id === u.id
                  return (
                    <tr key={u.id}
                      style={{
                        borderBottom: '1px solid rgba(26,48,80,0.5)',
                        background: isSelected ? 'rgba(26,111,255,0.08)' : 'transparent',
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelectedUser(isSelected ? null : u)}
                    >
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{u.username}</div>
                        <div style={{ fontSize: 10, color: '#3d5a80' }}>{u.email}</div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {me?.role === 'gerente' && u.id !== me.id ? (
                          <select
                            value={u.role}
                            onClick={e => e.stopPropagation()}
                            onChange={e => changeRole(u.id, e.target.value)}
                            style={{
                              background: '#111f35', border: '1px solid #1a3050',
                              borderRadius: 6, padding: '3px 8px', color: rol.color,
                              fontSize: 11, cursor: 'pointer', fontWeight: 700,
                            }}
                          >
                            <option value="operador">Operador</option>
                            <option value="supervisor">Supervisor</option>
                            <option value="gerente">Gerente</option>
                          </select>
                        ) : (
                          <span style={{
                            fontSize: 10, padding: '3px 8px', borderRadius: 20,
                            background: `${rol.color}18`, color: rol.color,
                            border: `1px solid ${rol.color}40`, fontFamily: "'DM Mono',monospace",
                          }}>
                            {rol.label}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 20, fontFamily: "'DM Mono',monospace",
                          background: u.active ? 'rgba(0,230,118,0.1)' : 'rgba(255,82,82,0.1)',
                          color: u.active ? '#00e676' : '#ff5252',
                          border: `1px solid ${u.active ? 'rgba(0,230,118,0.3)' : 'rgba(255,82,82,0.3)'}`,
                        }}>
                          {u.active ? '● Activo' : '○ Inactivo'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
                        {isSelected && assignedDevices.length > 0
                          ? <span style={{ color: '#1a6fff' }}>{assignedDevices.length} asignadas</span>
                          : <span style={{ color: '#3d5a80' }}>—</span>
                        }
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
                        {isSelected && assignedReports.length > 0
                          ? <span style={{ color: '#1a6fff' }}>{assignedReports.length} tipos</span>
                          : <span style={{ color: '#3d5a80' }}>—</span>
                        }
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedUser(isSelected ? null : u)}
                            style={{
                              background: isSelected ? 'rgba(26,111,255,0.2)' : 'none',
                              border: `1px solid ${isSelected ? 'rgba(26,111,255,0.4)' : '#1a3050'}`,
                              borderRadius: 6, padding: '3px 8px', color: isSelected ? '#5a9fff' : '#6b8ab0',
                              cursor: 'pointer', fontSize: 10,
                            }}
                          >
                            ⚙ Asignar
                          </button>
                          {me?.role === 'gerente' && u.id !== me.id && (
                            <button onClick={() => toggleUser(u.id)} style={{
                              background: 'none', border: '1px solid #1a3050', borderRadius: 6,
                              padding: '3px 8px', color: u.active ? '#ff5252' : '#00e676',
                              cursor: 'pointer', fontSize: 10,
                            }}>
                              {u.active ? 'Desactivar' : 'Activar'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Bitácora de accesos */}
          {log.length > 0 && (
            <div style={{ background: '#0c1829', border: '1px solid #1a3050', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #1a3050' }}>
                <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700 }}>Bitácora de Accesos</span>
              </div>
              <div style={{ maxHeight: 260, overflow: 'auto' }}>
                {log.slice(0, 40).map((l, i) => (
                  <div key={i} style={{
                    padding: '8px 16px', borderBottom: '1px solid rgba(26,48,80,0.4)',
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8,
                    fontSize: 11,
                  }}>
                    <span style={{ fontWeight: 600 }}>{l.username}</span>
                    <span style={{
                      color: l.action === 'login' ? '#00e676' : l.action === 'logout' ? '#ffd740' : '#5a9fff',
                      fontFamily: "'DM Mono',monospace", fontSize: 10,
                    }}>
                      {l.action === 'login' ? '→ Ingreso' : l.action === 'logout' ? '← Salida' : l.action}
                    </span>
                    <span style={{ color: '#3d5a80', fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
                      {l.location ? `📍 ${l.location}` : l.ip}
                    </span>
                    <span style={{ color: '#3d5a80', fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
                      {l.created_at ? new Date(l.created_at.endsWith('Z') ? l.created_at : l.created_at + 'Z')
                        .toLocaleString('es-EC', { timeZone: 'America/Guayaquil' }) : '--'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Columna derecha — panel de asignación */}
        {selectedUser && (
          <div style={{
            background: '#0c1829', border: '1px solid #1a3050',
            borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: 520,
          }}>
            {/* Header panel */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #1a3050', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 800 }}>
                  Asignaciones — {selectedUser.username}
                </div>
                <div style={{ fontSize: 10, color: ROLES[selectedUser.role]?.color || '#6b8ab0', fontFamily: "'DM Mono',monospace", marginTop: 2 }}>
                  {ROLES[selectedUser.role]?.label}
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} style={{
                background: 'none', border: '1px solid #1a3050', borderRadius: 6,
                padding: '4px 8px', color: '#6b8ab0', cursor: 'pointer', fontSize: 12,
              }}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #1a3050' }}>
              {[
                { id: 'paradas', label: `📍 Paradas (${assignedDevices.length})` },
                { id: 'reportes', label: `📋 Tipos de Reporte (${assignedReports.length})` },
              ].map(t => (
                <button key={t.id} onClick={() => setAssignTab(t.id)} style={{
                  flex: 1, padding: '10px 8px', cursor: 'pointer',
                  background: assignTab === t.id ? 'rgba(26,111,255,0.1)' : 'transparent',
                  border: 'none', borderBottom: `2px solid ${assignTab === t.id ? '#1a6fff' : 'transparent'}`,
                  color: assignTab === t.id ? '#5a9fff' : '#6b8ab0', fontSize: 12, fontWeight: assignTab === t.id ? 700 : 400,
                }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab: Paradas */}
            {assignTab === 'paradas' && (
              <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px' }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  <button onClick={selectAllDevices} style={{
                    background: 'rgba(26,111,255,0.1)', border: '1px solid rgba(26,111,255,0.3)',
                    borderRadius: 6, padding: '4px 10px', color: '#5a9fff', cursor: 'pointer', fontSize: 11,
                  }}>Todas</button>
                  <button onClick={clearAllDevices} style={{
                    background: 'none', border: '1px solid #1a3050',
                    borderRadius: 6, padding: '4px 10px', color: '#6b8ab0', cursor: 'pointer', fontSize: 11,
                  }}>Ninguna</button>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: '#3d5a80', alignSelf: 'center', fontFamily: "'DM Mono',monospace" }}>
                    {assignedDevices.length}/{devices.length} seleccionadas
                  </span>
                </div>

                {Object.entries(grouped).map(([group, devs]) => (
                  <div key={group} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, color: '#3d5a80', fontFamily: "'DM Mono',monospace",
                      letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, padding: '0 4px' }}>
                      {group} ({devs.length})
                    </div>
                    {devs.map(d => {
                      const checked = assignedDevices.includes(d.device_id)
                      return (
                        <div key={d.device_id}
                          onClick={() => toggleDevice(d.device_id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 4,
                            background: checked ? 'rgba(26,111,255,0.1)' : 'rgba(26,48,80,0.2)',
                            border: `1px solid ${checked ? 'rgba(26,111,255,0.35)' : 'rgba(26,48,80,0.4)'}`,
                            transition: 'all 0.15s',
                          }}
                        >
                          <div style={{
                            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                            background: checked ? '#1a6fff' : 'transparent',
                            border: `2px solid ${checked ? '#1a6fff' : '#3d5a80'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {checked && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {d.name}
                            </div>
                            <div style={{ fontSize: 10, color: '#3d5a80', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {d.address}
                            </div>
                          </div>
                          <div style={{
                            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                            background: d.status === 'online' ? '#00e676' : '#ff5252',
                          }} />
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}

            {/* Tab: Tipos de Reporte */}
            {assignTab === 'reportes' && (
              <div style={{ flex: 1, overflow: 'auto', padding: '14px' }}>
                <div style={{ fontSize: 11, color: '#6b8ab0', marginBottom: 14 }}>
                  Selecciona qué tipos de reportes puede acceder este usuario:
                </div>
                {REPORT_TYPES.map(rt => {
                  const checked = assignedReports.includes(rt.id)
                  return (
                    <div key={rt.id}
                      onClick={() => toggleReport(rt.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', borderRadius: 10, cursor: 'pointer', marginBottom: 8,
                        background: checked ? 'rgba(26,111,255,0.1)' : 'rgba(26,48,80,0.2)',
                        border: `1px solid ${checked ? 'rgba(26,111,255,0.35)' : 'rgba(26,48,80,0.4)'}`,
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                        background: checked ? '#1a6fff' : 'transparent',
                        border: `2px solid ${checked ? '#1a6fff' : '#3d5a80'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {checked && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{rt.label}</div>
                        <div style={{ fontSize: 10, color: '#6b8ab0', marginTop: 2 }}>{rt.desc}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Botón guardar */}
            <div style={{ padding: '12px 14px', borderTop: '1px solid #1a3050' }}>
              <button
                onClick={saveAssignments}
                disabled={savingAssign}
                style={{
                  width: '100%', background: savingAssign ? '#1a3050' : 'rgba(26,111,255,0.2)',
                  border: `1px solid ${savingAssign ? '#1a3050' : 'rgba(26,111,255,0.4)'}`,
                  borderRadius: 8, padding: '10px', cursor: savingAssign ? 'default' : 'pointer',
                  color: savingAssign ? '#3d5a80' : '#5a9fff', fontSize: 13, fontWeight: 700,
                }}
              >
                {savingAssign ? 'Guardando...' : `💾 Guardar asignaciones para ${selectedUser.username}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
