import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'

export default function MapView() {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef({})
  const geocercaLayersRef = useRef([])
  const navigate = useNavigate()
  const { devices, telemetry, geocercas, setSelectedDevice } = useStore()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState({})
  const [selectedDevices, setSelectedDevices] = useState(new Set())
  const [filter, setFilter] = useState('')
  const [showGeocercas, setShowGeocercas] = useState(true)

  // Group devices
  const grouped = useMemo(() => {
    const g = {}
    devices.filter(d => d.name.toLowerCase().includes(filter.toLowerCase()) || d.address?.toLowerCase().includes(filter.toLowerCase())).forEach(d => {
      const key = d.group_name || 'Sin grupo'
      if (!g[key]) g[key] = []
      g[key].push(d)
    })
    return g
  }, [devices, filter])

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const L = window.L
    if (!L) return

    const map = L.map(mapRef.current, {
      center: [-2.4204, -79.3437], // La Troncal, Cañar
      zoom: 14,
      zoomControl: false,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)



    // Etiquetas de calles y lugares encima del satélite (CartoDB)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', {
      attribution: '© CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
      opacity: 0.9,
    }).addTo(map)

    L.control.zoom({ position: 'bottomright' }).addTo(map)
    mapInstanceRef.current = map

    return () => {
      // Limpiar todos los marcadores antes de destruir el mapa
      Object.values(markersRef.current).forEach(m => {
        try { m.remove() } catch (e) {}
      })
      markersRef.current = {}
      geocercaLayersRef.current = []
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  // Update markers — se ejecuta cada vez que cambian devices, telemetry o el mapa
  useEffect(() => {
    const L = window.L
    const map = mapInstanceRef.current
    if (!L || !map) return

    devices.forEach(device => {
      const t = telemetry[device.device_id] || {}
      const lat = t.lat ?? device.lat ?? device.current_lat
      const lng = t.lng ?? device.lng ?? device.current_lng
      if (!lat || !lng) return

      const soc = t.soc ?? device.soc ?? 0
      const status = device.status || 'offline'
      const color = status === 'online' ? (soc > 50 ? '#00e676' : soc > 20 ? '#ffd740' : '#ff5252') : '#6b8ab0'
      const isSelected = selectedDevices.has(device.device_id)

      const html = `
        <div style="
          position:relative;
          width:${isSelected ? 44 : 36}px;
          height:${isSelected ? 44 : 36}px;
        ">
          <div style="
            width:100%;height:100%;
            background:linear-gradient(135deg,#1a6fff,${color});
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            border:3px solid ${isSelected ? '#ffffff' : '#060d1a'};
            box-shadow:0 4px 16px rgba(26,111,255,${isSelected ? 0.8 : 0.4});
          "></div>
          <div style="
            position:absolute;top:50%;left:50%;
            transform:translate(-50%,-60%);
            font-size:14px;
          ">☀</div>
          ${status === 'online' ? `<div style="
            position:absolute;top:0;right:0;
            width:10px;height:10px;border-radius:50%;
            background:${color};border:2px solid #060d1a;
          "></div>` : ''}
        </div>`

      // Si el marcador ya existe en este mapa → actualizar posición e ícono
      // Si no existe (mapa recién creado o primera carga) → crear nuevo
      if (markersRef.current[device.device_id] && map.hasLayer(markersRef.current[device.device_id])) {
        markersRef.current[device.device_id].setLatLng([lat, lng])
        markersRef.current[device.device_id].setIcon(L.divIcon({ html, iconSize: [44, 44], iconAnchor: [22, 44], className: '' }))
      } else {
        // Limpiar referencia vieja si existe pero no está en el mapa
        if (markersRef.current[device.device_id]) {
          try { markersRef.current[device.device_id].remove() } catch (e) {}
        }

        const marker = L.marker([lat, lng], {
          icon: L.divIcon({ html, iconSize: [44, 44], iconAnchor: [22, 44], className: '' })
        }).addTo(map)

        marker.bindPopup(`
          <div style="font-family:'DM Sans',sans-serif;color:#e8f0fe;background:#0c1829;min-width:200px;padding:4px">
            <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin-bottom:8px">${device.name}</div>
            <div style="font-size:11px;color:#6b8ab0;margin-bottom:12px">${device.address || ''}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
              <div><span style="color:#3d5a80">SOC</span><br><strong style="color:#1a6fff">${soc}%</strong></div>
              <div><span style="color:#3d5a80">Voltaje</span><br><strong style="color:#00d4ff">${(t.voltage||0).toFixed(1)}V</strong></div>
              <div><span style="color:#3d5a80">Temp</span><br><strong style="color:#ffd740">${(t.temperature||0).toFixed(1)}°C</strong></div>
              <div><span style="color:#3d5a80">Señal</span><br><strong style="color:#00e676">${t.rssi||'--'} dBm</strong></div>
            </div>
            <button onclick="window.__navigateToDevice('${device.device_id}')" style="
              width:100%;margin-top:12px;padding:6px 12px;
              background:#1a6fff;border:none;border-radius:6px;
              color:#fff;cursor:pointer;font-size:12px;font-family:'Syne',sans-serif;font-weight:600;
            ">Ver detalle →</button>
          </div>
        `, {
          className: 'dark-popup',
          maxWidth: 240,
        })

        marker.on('click', () => {
          setSelectedDevice(device.device_id)
          setSelectedDevices(new Set([device.device_id]))
        })

        markersRef.current[device.device_id] = marker
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, telemetry, selectedDevices, mapInstanceRef.current])

  // Geocercas
  useEffect(() => {
    const L = window.L
    const map = mapInstanceRef.current
    if (!L || !map) return

    geocercaLayersRef.current.forEach(l => map.removeLayer(l))
    geocercaLayersRef.current = []

    if (!showGeocercas) return

    geocercas.forEach(g => {
      if (g.type === 'circle' && g.center_lat) {
        const circle = L.circle([g.center_lat, g.center_lng], {
          radius: g.radius || 50,
          color: '#1a6fff', fillColor: '#1a6fff',
          fillOpacity: 0.08, weight: 1,
        }).addTo(map)
        geocercaLayersRef.current.push(circle)
      }
    })
  }, [geocercas, showGeocercas])

  // Navigate helper exposed globally for popup button
  useEffect(() => {
    window.__navigateToDevice = (id) => navigate(`/device/${id}`)
    return () => { delete window.__navigateToDevice }
  }, [navigate])

  const flyTo = (device) => {
    const t = telemetry[device.device_id] || {}
    const lat = t.lat ?? device.lat ?? device.current_lat
    const lng = t.lng ?? device.lng ?? device.current_lng
    if (lat && lng && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 17, { duration: 1 })
      markersRef.current[device.device_id]?.openPopup()
    }
  }

  const toggleGroup = (name) => setExpandedGroups(g => ({...g, [name]: !g[name]}))
  const toggleDevice = (id) => {
    setSelectedDevices(s => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  return (
    <div style={{ height: '100%', display: 'flex', position: 'relative' }}>
      {/* Device sidebar */}
      <div style={{
        width: sidebarOpen ? '22%' : 0,
        maxWidth: 280, minWidth: sidebarOpen ? 200 : 0,
        borderRight: '1px solid #1a3050',
        background: 'rgba(12,24,41,0.95)',
        display: 'flex', flexDirection: 'column',
        transition: 'all 0.2s ease', overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid #1a3050', flexShrink: 0 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Paradas</div>
          <input
            type="text" placeholder="Buscar parada..."
            value={filter} onChange={e => setFilter(e.target.value)}
            style={{
              width: '100%', background: '#111f35', border: '1px solid #1a3050',
              borderRadius: 6, padding: '6px 10px', color: '#e8f0fe', fontSize: 12,
              outline: 'none',
            }}
          />
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
          {Object.entries(grouped).map(([group, devs]) => (
            <div key={group}>
              <div
                onClick={() => toggleGroup(group)}
                style={{
                  padding: '6px 12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  color: '#6b8ab0', fontSize: 11, fontFamily: "'DM Mono',monospace",
                  letterSpacing: 0.8, textTransform: 'uppercase',
                }}
              >
                <span>{group}</span>
                <span style={{ fontSize: 9 }}>
                  {expandedGroups[group] === false ? '▶' : '▼'} {devs.length}
                </span>
              </div>
              {expandedGroups[group] !== false && devs.map(d => {
                const t = telemetry[d.device_id] || {}
                const soc = t.soc ?? d.soc ?? '--'
                const isOnline = d.status === 'online'
                return (
                  <div
                    key={d.device_id}
                    style={{
                      padding: '8px 12px 8px 20px', cursor: 'pointer',
                      borderBottom: '1px solid rgba(26,48,80,0.5)',
                      background: selectedDevices.has(d.device_id) ? 'rgba(26,111,255,0.1)' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(26,111,255,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = selectedDevices.has(d.device_id) ? 'rgba(26,111,255,0.1)' : 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: isOnline ? '#00e676' : '#ff5252', marginRight: 6 }} />
                          {d.name}
                        </div>
                        <div style={{ fontSize: 10, color: '#3d5a80', marginTop: 2, fontFamily: "'DM Mono',monospace" }}>SOC: {soc}%</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={(e) => { e.stopPropagation(); flyTo(d) }}
                          style={{ background: 'none', border: '1px solid #1a3050', borderRadius: 4, padding: '2px 6px', color: '#6b8ab0', cursor: 'pointer', fontSize: 11 }}>
                          📍
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/device/${d.device_id}`) }}
                          style={{ background: 'none', border: '1px solid #1a3050', borderRadius: 4, padding: '2px 6px', color: '#6b8ab0', cursor: 'pointer', fontSize: 11 }}>
                          →
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <style>{`
          .dark-popup .leaflet-popup-content-wrapper {
            background: #0c1829 !important; border: 1px solid #1a3050 !important;
            border-radius: 10px !important; color: #e8f0fe !important; padding: 0 !important;
          }
          .dark-popup .leaflet-popup-tip { background: #0c1829 !important; }
          .dark-popup .leaflet-popup-content { margin: 12px !important; }
          .leaflet-tile { filter: saturate(0.6) brightness(0.75) hue-rotate(200deg) !important; }
        `}</style>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {/* Map controls */}
        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 1000,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{
              background: 'rgba(6,13,26,0.9)', border: '1px solid #1a3050',
              borderRadius: 8, padding: '7px 12px', color: '#e8f0fe',
              cursor: 'pointer', fontSize: 12, backdropFilter: 'blur(8px)',
            }}
          >
            {sidebarOpen ? '◀ Lista' : '▶ Lista'}
          </button>
          <button
            onClick={() => setShowGeocercas(g => !g)}
            style={{
              background: 'rgba(6,13,26,0.9)', border: `1px solid ${showGeocercas ? '#1a6fff' : '#1a3050'}`,
              borderRadius: 8, padding: '7px 12px',
              color: showGeocercas ? '#5a9fff' : '#6b8ab0',
              cursor: 'pointer', fontSize: 12, backdropFilter: 'blur(8px)',
            }}
          >
            Geocercas
          </button>
        </div>

        {/* Stats overlay */}
        <div style={{
          position: 'absolute', bottom: 40, right: 12, zIndex: 1000,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {devices.slice(0, 4).map(d => {
            const t = telemetry[d.device_id] || {}
            return (
              <div key={d.device_id} style={{
                background: 'rgba(6,13,26,0.9)', border: '1px solid #1a3050',
                borderRadius: 8, padding: '6px 12px', backdropFilter: 'blur(8px)',
                fontFamily: "'DM Mono',monospace", fontSize: 10,
                display: 'flex', gap: 10, alignItems: 'center',
              }}>
                <span style={{ color: '#3d5a80' }}>{d.name.split(' ')[1]}</span>
                <span style={{ color: '#1a6fff' }}>{t.soc ?? '--'}%</span>
                <span style={{ color: '#ffd740' }}>{t.panel_power ? `${t.panel_power.toFixed(0)}W` : '--'}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
