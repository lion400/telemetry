import React, { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useStore } from '../store'

const API = '/api'
const ROLES = { gerente: { color: '#ff9800', label: 'Gerente' }, supervisor: { color: '#ffd740', label: 'Supervisor' }, operador: { color: '#5a9fff', label: 'Operador' } }

export default function UsersView() {
  const { user: me } = useStore()
  const [users, setUsers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'operador' })
  const [log, setLog] = useState([])

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

  const inputStyle = {
    width: '100%', background: '#111f35', border: '1px solid #1a3050',
    borderRadius: 8, padding: '9px 12px', color: '#e8f0fe', fontSize: 13,
    outline: 'none', marginBottom: 12,
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #1a3050', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800 }}>Gestión de Usuarios</h1>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#3d5a80', marginTop: 2 }}>
            HTTPS · Sesiones controladas · Bitácora de accesos
          </div>
        </div>
        {me?.role === 'gerente' && (
          <button onClick={() => setShowForm(s => !s)} style={{
            background: '#1a6fff', border: 'none', borderRadius: 8,
            padding: '8px 16px', color: '#fff', cursor: 'pointer',
            fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: 12,
          }}>
            + Nuevo usuario
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Create form */}
        {showForm && (
          <div style={{ background: '#0c1829', border: '1px solid #1a6fff', borderRadius: 12, padding: 20 }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Crear usuario</div>
            <form onSubmit={createUser}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, color: '#6b8ab0', fontFamily: "'DM Mono',monospace", letterSpacing: 1, textTransform: 'uppercase' }}>Usuario</label>
                  <input style={inputStyle} value={form.username} onChange={e => setForm(f => ({...f, username: e.target.value}))} required />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: '#6b8ab0', fontFamily: "'DM Mono',monospace", letterSpacing: 1, textTransform: 'uppercase' }}>Email</label>
                  <input style={inputStyle} type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} required />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: '#6b8ab0', fontFamily: "'DM Mono',monospace", letterSpacing: 1, textTransform: 'uppercase' }}>Contraseña</label>
                  <input style={inputStyle} type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} required />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: '#6b8ab0', fontFamily: "'DM Mono',monospace", letterSpacing: 1, textTransform: 'uppercase' }}>Rol</label>
                  <select style={inputStyle} value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}>
                    <option value="gerente">Gerente</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="operador">Operador</option>
                  </select>
                </div>
              </div>
              <button type="submit" style={{ background: '#1a6fff', border: 'none', borderRadius: 8, padding: '9px 20px', color: '#fff', cursor: 'pointer', fontFamily: "'Syne',sans-serif", fontWeight: 600 }}>
                Crear
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{ marginLeft: 8, background: 'none', border: '1px solid #1a3050', borderRadius: 8, padding: '9px 20px', color: '#6b8ab0', cursor: 'pointer' }}>
                Cancelar
              </button>
            </form>
          </div>
        )}

        {/* Users table */}
        <div style={{ background: '#0c1829', border: '1px solid #1a3050', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a3050', fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1.5, color: '#3d5a80', textTransform: 'uppercase' }}>
            Usuarios del sistema — {users.length} total
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0c1829' }}>
                {['Usuario', 'Email', 'Rol', 'Estado', 'Último acceso', 'Acciones'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', borderBottom: '1px solid #1a3050', fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#3d5a80', textTransform: 'uppercase', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const role = ROLES[u.role] || ROLES.operador
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #1a3050', opacity: u.active ? 1 : 0.5 }}>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{u.username}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#6b8ab0' }}>{u.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${role.color}18`, color: role.color, border: `1px solid ${role.color}40`, fontFamily: "'DM Mono',monospace" }}>
                        {role.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 10, color: u.active ? '#00e676' : '#ff5252' }}>
                        {u.active ? '● Activo' : '● Inactivo'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#6b8ab0' }}>
                      {u.last_login ? new Date(u.last_login).toLocaleString('es-EC') : 'Nunca'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {me?.role === 'gerente' && u.id !== me?.id && (
                        <button onClick={() => toggleUser(u.id)} style={{
                          background: 'none', border: '1px solid #1a3050', borderRadius: 6,
                          padding: '3px 10px', cursor: 'pointer', fontSize: 11,
                          color: u.active ? '#ff5252' : '#00e676',
                        }}>
                          {u.active ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Access log */}
        <div style={{ background: '#0c1829', border: '1px solid #1a3050', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a3050', fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1.5, color: '#3d5a80', textTransform: 'uppercase' }}>
            Bitácora de accesos
          </div>
          <div style={{ maxHeight: 240, overflow: 'auto' }}>
            {log.map(l => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 16px', borderBottom: '1px solid rgba(26,48,80,0.5)', fontSize: 12 }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#3d5a80', minWidth: 140 }}>
                  {new Date(l.created_at).toLocaleString('es-EC')}
                </span>
                <span style={{ fontWeight: 500 }}>{l.username}</span>
                <span style={{ color: l.action === 'login' ? '#00e676' : '#6b8ab0', fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
                  {l.action === 'login' ? '→ Ingreso' : '← Salida'}
                </span>
                <span style={{ fontSize: 10, color: '#3d5a80', marginLeft: 'auto' }}>{l.ip}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
