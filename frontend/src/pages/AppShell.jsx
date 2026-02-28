import React, { useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../store'
import Dashboard from './Dashboard'
import MapView from './MapView'
import EventsView from './EventsView'
import UsersView from './UsersView'
import DeviceDetail from './DeviceDetail'
import OperatorView from './OperatorView'

const NAV = [
  { id: '/',         label: 'Dashboard', icon: '⬡', roles: ['gerente', 'supervisor', 'admin'] },
  { id: '/map',      label: 'Mapa',      icon: '⌖' },
  { id: '/alerts',   label: 'Alertas',   icon: '🔔', badge: 'unread', roles: ['operador'] },
  { id: '/events',   label: 'Eventos',   icon: '◈', badge: 'unread', roles: ['gerente', 'supervisor', 'admin'] },
  { id: '/users',    label: 'Usuarios',  icon: '◻', roles: ['gerente', 'admin'] },
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
  const [date, setDate] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const isMobile = useIsMobile()
  const [userLocation, setUserLocation] = useState(null)
  const [locLoading, setLocLoading] = useState(false)
  // Modo de reporte
  const [reportMode, setReportMode] = useState('normal')
  const [reportTimeLeft, setReportTimeLeft] = useState(0)
  const [showModePanel, setShowModePanel] = useState(false)
  const [customInterval, setCustomInterval] = useState(10)
  const [customDuration, setCustomDuration] = useState(120)
  const reportTimerRef = React.useRef(null)

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

  // Redirigir al operador a /alerts si llega al dashboard
  useEffect(() => {
    if (user?.role === 'operador' && loc.pathname === '/') {
      navigate('/alerts', { replace: true })
    }
  }, [user?.role, loc.pathname])

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setClock(now.toLocaleTimeString('es-EC'))
      setDate(now.toLocaleDateString('es-EC', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }))
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [])

  // Activar modo de reporte
  function activateMode(mode, intervalSec, durationSec) {
    if (reportTimerRef.current) clearInterval(reportTimerRef.current)
    setReportMode(mode)
    setReportTimeLeft(durationSec)
    setShowModePanel(false)
    // Cambiar intervalo del simulador via API
    fetch('/api/devices/report-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ interval: intervalSec, duration: durationSec, mode })
    }).catch(() => {})
    // Countdown
    let left = durationSec
    reportTimerRef.current = setInterval(() => {
      left -= 1
      setReportTimeLeft(left)
      if (left <= 0) {
        clearInterval(reportTimerRef.current)
        setReportMode('normal')
        setReportTimeLeft(0)
        fetch('/api/devices/report-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ interval: 900, duration: 0, mode: 'normal' })
        }).catch(() => {})
      }
    }, 1000)
  }

  function formatTimeLeft(s) {
    if (s <= 0) return ''
    const m = Math.floor(s / 60)
    const sec = s % 60
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`
  }

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
        height: '100dvh',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12 }}>

            {/* Reloj + fecha + modo reporte — solo desktop */}
            {!isMobile && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: '#e8f0fe', letterSpacing: 0.5 }}>{clock}</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#3d5a80', letterSpacing: 0.3, textTransform: 'capitalize' }}>{date}</span>
              </div>
            )}

            {/* Botón modo reporte — solo gerente */}
            {user?.role === 'gerente' && !isMobile && (
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowModePanel(p => !p)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: reportMode === 'normal' ? 'rgba(26,111,255,0.1)' : reportMode === 'intensive' ? 'rgba(255,215,64,0.15)' : 'rgba(0,212,255,0.12)',
                  border: `1px solid ${reportMode === 'normal' ? 'rgba(26,111,255,0.4)' : reportMode === 'intensive' ? 'rgba(255,215,64,0.5)' : 'rgba(0,212,255,0.4)'}`,
                  borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: '#e8f0fe', fontSize: 11,
                  fontFamily: "'DM Mono',monospace",
                }}>
                  <span style={{ fontSize: 10 }}>
                    {reportMode === 'normal' ? '📶' : reportMode === 'intensive' ? '⚡' : '⚙'}
                  </span>
                  {reportMode === 'normal' ? 'Normal · 15min' : reportMode === 'intensive' ? `Intensivo ${formatTimeLeft(reportTimeLeft)}` : `Custom ${formatTimeLeft(reportTimeLeft)}`}
                  <span style={{ color: '#3d5a80', fontSize: 9 }}>▾</span>
                </button>

                {/* Panel desplegable */}
                {showModePanel && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                    background: '#0c1829', border: '1px solid #1a3050', borderRadius: 12,
                    padding: 16, minWidth: 280, zIndex: 999,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1.5, color: '#3d5a80', textTransform: 'uppercase', marginBottom: 12 }}>
                      Modo de reporte
                    </div>

                    {/* Normal */}
                    <button onClick={() => { activateMode('normal', 900, 0); setReportMode('normal'); setShowModePanel(false) }} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      background: reportMode === 'normal' ? 'rgba(26,111,255,0.15)' : 'transparent',
                      border: `1px solid ${reportMode === 'normal' ? 'rgba(26,111,255,0.4)' : '#1a3050'}`,
                      borderRadius: 8, padding: '10px 12px', cursor: 'pointer', color: '#e8f0fe',
                      marginBottom: 8, textAlign: 'left',
                    }}>
                      <span style={{ fontSize: 18 }}>📶</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>Modo Normal</div>
                        <div style={{ fontSize: 10, color: '#6b8ab0' }}>1 reporte cada 15 minutos · Plan M2M estándar</div>
                      </div>
                    </button>

                    {/* Intensivo */}
                    <button onClick={() => activateMode('intensive', 10, 120)} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      background: reportMode === 'intensive' ? 'rgba(255,215,64,0.1)' : 'transparent',
                      border: `1px solid ${reportMode === 'intensive' ? 'rgba(255,215,64,0.4)' : '#1a3050'}`,
                      borderRadius: 8, padding: '10px 12px', cursor: 'pointer', color: '#e8f0fe',
                      marginBottom: 12, textAlign: 'left',
                    }}>
                      <span style={{ fontSize: 18 }}>⚡</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>Modo Intensivo</div>
                        <div style={{ fontSize: 10, color: '#6b8ab0' }}>1 reporte cada 10 segundos · duración 2 minutos</div>
                      </div>
                    </button>

                    {/* Separador */}
                    <div style={{ borderTop: '1px solid #1a3050', marginBottom: 12 }} />

                    {/* Personalizado */}
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1, color: '#3d5a80', textTransform: 'uppercase', marginBottom: 10 }}>
                      ⚙ Modo personalizado
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, color: '#6b8ab0', marginBottom: 4 }}>Intervalo (segundos)</div>
                        <input
                          type="number" min="1" max="3600"
                          value={customInterval}
                          onChange={e => setCustomInterval(Math.max(1, parseInt(e.target.value) || 1))}
                          style={{
                            width: '100%', background: '#111f35', border: '1px solid #1a3050',
                            borderRadius: 6, padding: '6px 10px', color: '#e8f0fe',
                            fontFamily: "'DM Mono',monospace", fontSize: 12,
                          }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#6b8ab0', marginBottom: 4 }}>Duración (segundos)</div>
                        <input
                          type="number" min="10" max="86400"
                          value={customDuration}
                          onChange={e => setCustomDuration(Math.max(10, parseInt(e.target.value) || 10))}
                          style={{
                            width: '100%', background: '#111f35', border: '1px solid #1a3050',
                            borderRadius: 6, padding: '6px 10px', color: '#e8f0fe',
                            fontFamily: "'DM Mono',monospace", fontSize: 12,
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: '#3d5a80', marginBottom: 10 }}>
                      Recibirás ~{customDuration > 0 ? Math.floor(customDuration / customInterval) : 0} reportes en total
                    </div>
                    <button onClick={() => activateMode('custom', customInterval, customDuration)} style={{
                      width: '100%', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.4)',
                      borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: '#00d4ff',
                      fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 600,
                    }}>
                      Activar modo personalizado
                    </button>
                  </div>
                )}
              </div>
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
            <Route path="/alerts"     element={<OperatorView />} />
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
