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

// Hook para detectar tamaño de pantalla
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

export default function AppShell() {
  const { user, logout, unreadEvents, fetchDevices, fetchEvents, fetchGeocercas } = useStore()
  const navigate = useNavigate()
  const loc = useLocation()
  const [clock, setClock] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const isMobile = useIsMobile()
  const [userLocation, setUserLocation] = useState(null) // "Ciudad, País"
  const [locLoading, setLocLoading] = useState(false)

  // Pedir ubicación del navegador al cargar
  useEffect(() => {
    if (!navigator.geolocation) return
    setLocLoading(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          // Geocoding inverso con Nominatim (OpenStreetMap, gratis, sin API key)
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json&accept-language=es`,
            { headers: { 'Accept-Language': 'es' } }
          )
          const data = await res.json()
          const addr = data.address || {}
          // Construir string de ubicación: ciudad / municipio + país
          const city = addr.city || addr.town || addr.municipality || addr.county || addr.state || ''
          const country = addr.country || ''
          setUserLocation(city && country ? `${city}, ${country}` : data.display_name?.split(',')[0] || 'Ubicación obtenida')
        } catch {
          setUserLocation('Ubicación activa')
        }
        setLocLoading(false)
      },
      () => {
        // Usuario denegó o error — no mostrar nada
        setLocLoading(false)
      },
      { timeout: 8000, maximumAge: 300000 } // cache 5 min
    )
  }, [])

  useEffect(() => {
    fetchDevices()
    fetchEvents()
    fetchGeocercas()
    const interval = setInterval(fetchDevices, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString('es-EC')), 1000)
    return () => clearInterval(t)
  }, [])

  // En móvil siempre colapsado (usamos barra inferior)
  const sidebarWidth = isMobile ? 0 : (collapsed ? 56 : 220)
  const filteredNav = NAV.filter(n => !n.roles || n.roles.includes(user?.role))

  return (
    <>
      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.7)} }

        /* Popup Leaflet dark */
        .dark-popup .leaflet-popup-content-wrapper {
          background: #0c1829 !important;
          border: 1px solid #1a3050 !important;
          border-radius: 12px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
          color: #e8f0fe !important;
        }
        .dark-popup .leaflet-popup-tip { background: #0c1829 !important; }
        .dark-popup .leaflet-popup-close-button { color: #6b8ab0 !important; }

        /* Scrollbar mobile */
        @media (max-width: 767px) {
          ::-webkit-scrollbar { width: 2px; height: 2px; }
        }
      `}</style>

      <div style={{
        display: 'grid',
        gridTemplateRows: isMobile ? '52px 1fr 60px' : '52px 1fr',
        gridTemplateColumns: isMobile ? '1fr' : `${sidebarWidth}px 1fr`,
        height: '100vh',
        height: '100dvh', // dynamic viewport height para móvil (evita barra del browser)
        transition: 'grid-template-columns 0.2s ease',
        overflow: 'hidden',
      }}>

        {/* ── TOP BAR ── */}
        <header style={{
          gridColumn: '1 / -1',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isMobile ? '0 12px' : '0 20px 0 16px',
          borderBottom: '1px solid #1a3050',
          background: 'rgba(6,13,26,0.97)',
          backdropFilter: 'blur(12px)',
          position: 'relative', zIndex: 200,
        }}>
          {/* Logo + toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12 }}>
            {!isMobile && (
              <button
                onClick={() => setCollapsed(c => !c)}
                style={{ background: 'none', border: 'none', color: '#6b8ab0', cursor: 'pointer', fontSize: 16, padding: '4px 6px', borderRadius: 6 }}
              >
                {collapsed ? '▶' : '◀'}
              </button>
            )}
            <div style={{
              fontFamily: "'Syne',sans-serif", fontSize: isMobile ? 16 : 18, fontWeight: 800,
              display: 'flex', alignItems: 'center', gap: 8,
              opacity: (!isMobile && collapsed) ? 0 : 1, transition: 'opacity 0.15s',
              whiteSpace: 'nowrap',
            }}>
              <div style={{ width: 26, height: 26, background: '#1a6fff', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>☀</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Solar<span style={{ color: '#5a9fff' }}>Track</span>
                  {!isMobile && (
                    <span style={{ color: '#3d5a80', fontSize: 12, fontWeight: 400 }}>· Paradas Seguras</span>
                  )}
                </div>
                {/* Ubicación real del usuario */}
                {(userLocation || locLoading) && (
                  <div style={{
                    fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 400,
                    color: userLocation ? '#00d4ff' : '#3d5a80',
                    letterSpacing: 0.3, marginTop: 1,
                    display: 'flex', alignItems: 'center', gap: 3,
                  }}>
                    {locLoading
                      ? <span style={{ color: '#3d5a80' }}>📍 Obteniendo ubicación...</span>
                      : <span>📍 {userLocation}</span>
                    }
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16 }}>
            {/* Reloj — oculto en móvil */}
            {!isMobile && (
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#6b8ab0' }}>{clock}</span>
            )}

            {/* EN VIVO */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)',
              borderRadius: 20, padding: isMobile ? '3px 7px' : '3px 10px',
              color: '#00e676', fontSize: isMobile ? 9 : 10,
            }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00e676', animation: 'pulse-dot 1.5s infinite' }} />
              {isMobile ? 'LIVE' : 'EN VIVO'}
            </div>

            {/* Alertas */}
            {unreadEvents > 0 && (
              <div
                onClick={() => navigate('/events')}
                style={{
                  background: 'rgba(255,82,82,0.15)', border: '1px solid rgba(255,82,82,0.4)',
                  borderRadius: 20, padding: isMobile ? '3px 7px' : '3px 10px',
                  color: '#ff5252', fontSize: isMobile ? 10 : 11, cursor: 'pointer',
                }}
              >
                ⚠ {unreadEvents}
              </div>
            )}

            {/* Usuario + logout */}
            <div
              onClick={logout}
              title="Cerrar sesión"
              style={{
                display: 'flex', alignItems: 'center', gap: isMobile ? 5 : 8,
                background: '#111f35', borderRadius: 8,
                padding: isMobile ? '5px 8px' : '5px 12px',
                border: '1px solid #1a3050', cursor: 'pointer', fontSize: 12,
              }}
            >
              <span style={{ fontSize: 14 }}>👤</span>
              {!isMobile && (
                <div>
                  <div style={{ fontWeight: 500 }}>{user?.username}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase', color: '#5a9fff' }}>
                    {user?.role}
                  </div>
                </div>
              )}
              <span style={{ color: '#3d5a80' }}>⏻</span>
            </div>
          </div>
        </header>

        {/* ── SIDEBAR — solo desktop ── */}
        {!isMobile && (
          <nav style={{
            borderRight: '1px solid #1a3050',
            background: 'rgba(12,24,41,0.8)',
            display: 'flex', flexDirection: 'column', gap: 2,
            padding: '12px 8px', overflowY: 'auto', overflowX: 'hidden',
          }}>
            {filteredNav.map(n => {
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
        )}

        {/* ── MAIN ── */}
        <main style={{
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          position: 'relative', zIndex: 1,
          // En móvil el grid ya reserva espacio para el bottom nav
        }}>
          <Routes>
            <Route path="/"           element={<Dashboard />} />
            <Route path="/map"        element={<MapView />} />
            <Route path="/events"     element={<EventsView />} />
            <Route path="/users"      element={<UsersView />} />
            <Route path="/device/:id" element={<DeviceDetail />} />
          </Routes>
        </main>

        {/* ── BOTTOM NAV — solo móvil ── */}
        {isMobile && (
          <nav style={{
            display: 'flex', alignItems: 'stretch',
            borderTop: '1px solid #1a3050',
            background: 'rgba(6,13,26,0.97)',
            backdropFilter: 'blur(12px)',
            zIndex: 200,
          }}>
            {filteredNav.map(n => {
              const active = loc.pathname === n.id || (n.id !== '/' && loc.pathname.startsWith(n.id))
              return (
                <div
                  key={n.id}
                  onClick={() => navigate(n.id)}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 3,
                    cursor: 'pointer', padding: '6px 4px',
                    color: active ? '#5a9fff' : '#6b8ab0',
                    background: active ? 'rgba(26,111,255,0.08)' : 'transparent',
                    borderTop: `2px solid ${active ? '#1a6fff' : 'transparent'}`,
                    transition: 'all 0.15s',
                    position: 'relative',
                  }}
                >
                  <span style={{ fontSize: 18 }}>{n.icon}</span>
                  <span style={{ fontSize: 9, fontFamily: "'DM Mono',monospace", letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    {n.label}
                  </span>
                  {n.badge === 'unread' && unreadEvents > 0 && (
                    <div style={{
                      position: 'absolute', top: 4, right: '25%',
                      background: '#ff5252', color: '#fff',
                      borderRadius: 10, padding: '1px 5px', fontSize: 8,
                      fontWeight: 700, minWidth: 16, textAlign: 'center',
                    }}>
                      {unreadEvents > 99 ? '99+' : unreadEvents}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
        )}

      </div>
    </>
  )
}
