import React, { useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../store'
import Dashboard from './Dashboard'
import MapView from './MapView'
import EventsView from './EventsView'
import UsersView from './UsersView'
import DeviceDetail from './DeviceDetail'

const NAV = [
  { id: '/',       label: 'Dashboard', icon: '⬡' },
  { id: '/map',    label: 'Mapa',      icon: '⌖' },
  { id: '/events', label: 'Eventos',   icon: '◈', badge: 'unread' },
  { id: '/users',  label: 'Usuarios',  icon: '◻', roles: ['gerente', 'supervisor'] },
]

export default function AppShell() {
  const { user, logout, unreadEvents, fetchDevices, fetchEvents, fetchGeocercas } = useStore()
  const navigate = useNavigate()
  const loc = useLocation()
  const [clock, setClock] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  // Initial data load + polling
  useEffect(() => {
    fetchDevices()
    fetchEvents()
    fetchGeocercas()
    const interval = setInterval(fetchDevices, 30000)
    return () => clearInterval(interval)
  }, [])

  // Clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString('es-EC')), 1000)
    return () => clearInterval(t)
  }, [])

  const sidebarWidth = collapsed ? 56 : 220

  return (
    <>
      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.7)} }
      `}</style>
      <div style={{
        display: 'grid',
        gridTemplateRows: '52px 1fr',
        gridTemplateColumns: `${sidebarWidth}px 1fr`,
        height: '100vh',
        transition: 'grid-template-columns 0.2s ease',
      }}>

        {/* ── TOP BAR ── */}
        <header style={{
          gridColumn: '1 / -1',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px 0 16px',
          borderBottom: '1px solid #1a3050',
          background: 'rgba(6,13,26,0.97)',
          backdropFilter: 'blur(12px)',
          position: 'relative', zIndex: 200,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setCollapsed(c => !c)}
              style={{ background: 'none', border: 'none', color: '#6b8ab0', cursor: 'pointer', fontSize: 16, padding: '4px 6px', borderRadius: 6 }}
            >
              {collapsed ? '▶' : '◀'}
            </button>
            <div style={{
              fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 800,
              display: 'flex', alignItems: 'center', gap: 8,
              opacity: collapsed ? 0 : 1, transition: 'opacity 0.15s',
              whiteSpace: 'nowrap', overflow: 'hidden',
            }}>
              <div style={{ width: 28, height: 28, background: '#1a6fff', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>☀</div>
              Solar<span style={{ color: '#5a9fff' }}>Track</span>
              <span style={{ color: '#3d5a80', fontSize: 12, fontWeight: 400, marginLeft: 4 }}>· Paradas Seguras</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#6b8ab0' }}>{clock}</span>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)',
              borderRadius: 20, padding: '3px 10px', color: '#00e676', fontSize: 10,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00e676', animation: 'pulse-dot 1.5s infinite' }} />
              EN VIVO
            </div>

            {unreadEvents > 0 && (
              <div
                onClick={() => navigate('/events')}
                style={{
                  background: 'rgba(255,82,82,0.15)', border: '1px solid rgba(255,82,82,0.4)',
                  borderRadius: 20, padding: '3px 10px', color: '#ff5252',
                  fontSize: 11, cursor: 'pointer',
                }}
              >
                ⚠ {unreadEvents} alerta{unreadEvents !== 1 ? 's' : ''}
              </div>
            )}

            <div
              onClick={logout}
              title="Cerrar sesión"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#111f35', borderRadius: 8, padding: '5px 12px',
                border: '1px solid #1a3050', cursor: 'pointer', fontSize: 12,
              }}
            >
              <span style={{ fontSize: 16 }}>👤</span>
              <div>
                <div style={{ fontWeight: 500 }}>{user?.username}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase', color: '#5a9fff' }}>
                  {user?.role}
                </div>
              </div>
              <span style={{ color: '#3d5a80', marginLeft: 4 }}>⏻</span>
            </div>
          </div>
        </header>

        {/* ── SIDEBAR ── */}
        <nav style={{
          borderRight: '1px solid #1a3050',
          background: 'rgba(12,24,41,0.8)',
          display: 'flex', flexDirection: 'column', gap: 2,
          padding: '12px 8px', overflowY: 'auto', overflowX: 'hidden',
        }}>
          {NAV.filter(n => !n.roles || n.roles.includes(user?.role)).map(n => {
            const active = loc.pathname === n.id || (n.id !== '/' && loc.pathname.startsWith(n.id))
            return (
              <div
                key={n.id}
                onClick={() => navigate(n.id)}
                title={collapsed ? n.label : ''}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: collapsed ? '10px' : '9px 12px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                  color: active ? '#5a9fff' : '#6b8ab0',
                  background: active ? 'rgba(26,111,255,0.15)' : 'transparent',
                  border: `1px solid ${active ? 'rgba(26,111,255,0.3)' : 'transparent'}`,
                  fontSize: 13, whiteSpace: 'nowrap', position: 'relative',
                }}
              >
                <span style={{ fontSize: 15, width: 18, textAlign: 'center', flexShrink: 0 }}>{n.icon}</span>
                <span style={{ opacity: collapsed ? 0 : 1, transition: 'opacity 0.15s', overflow: 'hidden' }}>
                  {n.label}
                </span>
                {n.badge === 'unread' && unreadEvents > 0 && !collapsed && (
                  <span style={{
                    marginLeft: 'auto', background: '#ff5252', color: '#fff',
                    borderRadius: 10, padding: '1px 6px', fontSize: 10,
                  }}>
                    {unreadEvents}
                  </span>
                )}
              </div>
            )
          })}
        </nav>

        {/* ── MAIN ── */}
        <main style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
          <Routes>
            <Route path="/"           element={<Dashboard />} />
            <Route path="/map"        element={<MapView />} />
            <Route path="/events"     element={<EventsView />} />
            <Route path="/users"      element={<UsersView />} />
            <Route path="/device/:id" element={<DeviceDetail />} />
          </Routes>
        </main>

      </div>
    </>
  )
}
