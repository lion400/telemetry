import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import axios from 'axios'
import toast from 'react-hot-toast'
import 'leaflet-draw'
import { ZoneModal, StopModal } from './StopsView'

const API = '/api'

// Funciones auxiliares
const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

const pointInPolygon = (point, vs) => {
  let x = point[0], y = point[1]
  let inside = false
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i][0], yi = vs[i][1]
    let xj = vs[j][0], yj = vs[j][1]
    let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

// Modal de edición de parada
function StopEditModal({ device, groups, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: device.name || '', address: device.address || '',
    group_id: device.group_id || '', photo_url: device.photo_url || '',
  })
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()

  const handlePhoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2*1024*1024) { toast.error('Imagen máx 2MB'); return }
    setUploading(true)
    const reader = new FileReader()
    reader.onload = (ev) => { setForm(f => ({...f, photo_url: ev.target.result})); setUploading(false); toast.success('Foto cargada') }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    setSaving(true)
    try { await axios.put(`${API}/devices/${device.device_id}`, form); toast.success('Parada actualizada'); onSaved(); onClose() }
    catch { toast.error('Error guardando') } finally { setSaving(false) }
  }

  const lat = device.lat ?? device.current_lat
  const lng = device.lng ?? device.current_lng
  const gmaps = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : null

  const inp = { width:'100%', background:'#111f35', border:'1px solid #1a3050', borderRadius:8, padding:'8px 12px', color:'#e8f0fe', fontSize:13, outline:'none', marginBottom:10 }
  const lbl = { fontFamily:"'DM Mono',monospace", fontSize:9, color:'#3d5a80', letterSpacing:1, textTransform:'uppercase', marginBottom:3, display:'block' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)', padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#0c1829', border:'1px solid #1a3050', borderRadius:14, width:'100%', maxWidth:460, maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,0.7)' }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid #1a3050', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:15, color:'#e8f0fe' }}>✏️ Editar parada</div>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'#3d5a80', marginTop:2 }}>{device.device_id}</div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {gmaps && <a href={gmaps} target="_blank" rel="noopener noreferrer" style={{ background:'rgba(26,111,255,0.1)', border:'1px solid rgba(26,111,255,0.3)', borderRadius:7, padding:'5px 10px', color:'#5a9fff', fontSize:11, textDecoration:'none', fontWeight:600 }}>📍 Maps</a>}
            <button onClick={onClose} style={{ background:'none', border:'1px solid #1a3050', borderRadius:7, padding:'4px 10px', color:'#6b8ab0', cursor:'pointer' }}>✕</button>
          </div>
        </div>

        <div style={{ padding:'16px 18px', overflowY:'auto', flex:1 }}>
          <label style={lbl}>Foto de la parada</label>
          {form.photo_url ? (
            <div style={{ position:'relative', marginBottom:10 }}>
              <img src={form.photo_url} alt="parada" style={{ width:'100%', height:150, objectFit:'cover', borderRadius:8, border:'1px solid #1a3050', display:'block' }} />
              <button onClick={() => setForm(f => ({...f, photo_url:''}))} style={{ position:'absolute', top:6, right:6, background:'rgba(255,82,82,0.9)', border:'none', borderRadius:6, padding:'3px 8px', color:'#fff', cursor:'pointer', fontSize:11 }}>✕</button>
            </div>
          ) : (
            <div style={{ width:'100%', height:100, border:'2px dashed #1a3050', borderRadius:8, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#3d5a80', fontSize:12, marginBottom:8 }}
              onClick={() => fileRef.current?.click()}>
              {uploading ? '⏳ Cargando...' : '📷 Clic para subir foto'}
              <span style={{ fontSize:10, marginTop:4 }}>JPG / PNG · máx 2MB</span>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handlePhoto} />
          {!form.photo_url && <button onClick={() => fileRef.current?.click()} style={{ width:'100%', background:'#111f35', border:'1px solid #1a3050', borderRadius:7, padding:'7px', color:'#6b8ab0', cursor:'pointer', fontSize:12, marginBottom:10 }}>📷 Subir foto</button>}

          <label style={lbl}>Nombre</label>
          <input style={inp} value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} />

          <label style={lbl}>Dirección</label>
          <input style={inp} value={form.address} onChange={e => setForm(f => ({...f, address:e.target.value}))} />

          <label style={lbl}>Zona</label>
          <select style={{ ...inp, cursor:'pointer' }} value={form.group_id} onChange={e => setForm(f => ({...f, group_id:e.target.value}))}>
            <option value="">Sin zona</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>

          {gmaps && <a href={gmaps} target="_blank" rel="noopener noreferrer" style={{ display:'block', textAlign:'center', padding:'9px', background:'rgba(26,111,255,0.08)', border:'1px solid rgba(26,111,255,0.25)', borderRadius:8, color:'#5a9fff', textDecoration:'none', fontSize:12, fontWeight:600 }}>🗺 Ver en Google Maps ({lat?.toFixed(5)}, {lng?.toFixed(5)})</a>}
        </div>

        <div style={{ padding:'12px 18px', borderTop:'1px solid #1a3050', display:'flex', gap:8, flexShrink:0 }}>
          <button onClick={onClose} style={{ flex:1, background:'none', border:'1px solid #1a3050', borderRadius:8, padding:9, color:'#6b8ab0', cursor:'pointer', fontSize:13 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ flex:2, background:'rgba(26,111,255,0.2)', border:'1px solid rgba(26,111,255,0.4)', borderRadius:8, padding:9, color:'#5a9fff', cursor:'pointer', fontSize:13, fontWeight:700, opacity:saving?0.6:1 }}>{saving?'Guardando...':'✓ Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

// Modal para editar geocerca
function EditGeocercaModal({ geocerca, onClose, onSaved }) {
  const [name, setName] = useState(geocerca.name || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('El nombre no puede estar vacío')
      return
    }
    setSaving(true)
    try {
      await axios.put(`${API}/geocercas/${geocerca.id}`, { name })
      toast.success('Geocerca actualizada')
      onSaved()
      onClose()
    } catch (error) {
      toast.error('Error al actualizar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de eliminar esta geocerca?')) return
    setSaving(true)
    try {
      await axios.delete(`${API}/geocercas/${geocerca.id}`)
      toast.success('Geocerca eliminada')
      onSaved()
      onClose()
    } catch (error) {
      toast.error('Error al eliminar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)', padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#0c1829', border:'1px solid #1a3050', borderRadius:14, width:'100%', maxWidth:400, padding:'20px' }}>
        <h3 style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, marginBottom:12 }}>Editar geocerca</h3>
        <input
          type="text"
          placeholder="Nombre de la geocerca"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{ width:'100%', background:'#111f35', border:'1px solid #1a3050', borderRadius:8, padding:'10px', color:'#e8f0fe', fontSize:14, marginBottom:16, outline:'none' }}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          autoFocus
        />
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onClose} style={{ flex:1, background:'none', border:'1px solid #1a3050', borderRadius:8, padding:'10px', color:'#6b8ab0', cursor:'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ flex:1, background:'rgba(26,111,255,0.2)', border:'1px solid rgba(26,111,255,0.4)', borderRadius:8, padding:'10px', color:'#5a9fff', cursor:'pointer', fontWeight:700 }}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
        <div style={{ marginTop:12, textAlign:'center' }}>
          <button onClick={handleDelete} disabled={saving} style={{ background:'none', border:'1px solid #ff5252', borderRadius:8, padding:'8px 16px', color:'#ff5252', cursor:'pointer', fontSize:13, width:'100%' }}>Eliminar geocerca</button>
        </div>
      </div>
    </div>
  )
}

export default function MapView() {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const drawControlRef = useRef(null)
  const markersRef = useRef({})
  const geocercaLayersRef = useRef([])
  const navigate = useNavigate()
  const { devices, telemetry, geocercas, setSelectedDevice, fetchDevices, fetchGeocercas } = useStore()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState({})
  const [selectedDevices, setSelectedDevices] = useState(new Set())
  const [filter, setFilter] = useState('')
  const [showGeocercas, setShowGeocercas] = useState(true)
  const [zoneFilter, setZoneFilter] = useState('todas')
  const [selectedGeocerca, setSelectedGeocerca] = useState(null)
  const [editDevice, setEditDevice] = useState(null)
  const [groups, setGroups] = useState([])
  const { user } = useStore()

  // Estados para autocompletado y menú desplegable
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showZoneDropdown, setShowZoneDropdown] = useState(false)
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)

  // Estados para nueva geocerca y modales
  const [drawingMode, setDrawingMode] = useState(false)
  const [selectedDrawMode, setSelectedDrawMode] = useState(null) // 'polygon' o 'circle'
  const [showDrawMenu, setShowDrawMenu] = useState(false)
  const [newGeocercaName, setNewGeocercaName] = useState('')
  const [showGeocercaNameModal, setShowGeocercaNameModal] = useState(false)
  const [drawnLayer, setDrawnLayer] = useState(null)
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [showNewZoneModal, setShowNewZoneModal] = useState(false)
  const [showNewStopModal, setShowNewStopModal] = useState(false)

  // Estado para editar geocerca
  const [editingGeocerca, setEditingGeocerca] = useState(null)

  // Cargar grupos
  useEffect(() => {
    axios.get(`${API}/devices/meta/groups`).then(r => setGroups(r.data)).catch(() => {})
  }, [])

  const zones = useMemo(() => ['todas', ...new Set(devices.map(d => d.group_name).filter(Boolean))], [devices])

  const filterOptions = useMemo(() => {
    const zonesList = zones
    const geocercasList = geocercas.map(g => ({ id: g.id, name: g.name, type: 'geocerca' }))
    return { zones: zonesList, geocercas: geocercasList }
  }, [zones, geocercas])

  // Función para determinar si un punto está dentro de una geocerca
  const pointInGeocerca = (device, geocerca) => {
    if (!geocerca) return false
    const t = telemetry[device.device_id] || {}
    const lat = t.lat ?? device.lat ?? device.current_lat
    const lng = t.lng ?? device.lng ?? device.current_lng
    if (!lat || !lng) return false

    if (geocerca.type === 'circle' && geocerca.center_lat && geocerca.center_lng) {
      const dist = haversine(lat, lng, geocerca.center_lat, geocerca.center_lng)
      return dist <= (geocerca.radius || 50)
    } else if (geocerca.type === 'polygon' && geocerca.polygon) {
      try {
        const coords = JSON.parse(geocerca.polygon)
        return pointInPolygon([lat, lng], coords)
      } catch (e) {
        return false
      }
    }
    return false
  }

  // Lista de paradas filtradas (para la lista lateral)
  const grouped = useMemo(() => {
    const g = {}
    devices.forEach(d => {
      const txt = d.name.toLowerCase().includes(filter.toLowerCase()) || d.address?.toLowerCase().includes(filter.toLowerCase())
      const zoneMatch = zoneFilter === 'todas' || d.group_name === zoneFilter
      let geocercaMatch = true
      if (selectedGeocerca) {
        geocercaMatch = pointInGeocerca(d, selectedGeocerca)
      }
      if (txt && zoneMatch && geocercaMatch) {
        const k = d.group_name || 'Sin zona'
        if (!g[k]) g[k] = []
        g[k].push(d)
      }
    })
    return g
  }, [devices, filter, zoneFilter, selectedGeocerca, telemetry])

  // IDs de dispositivos visibles en el mapa
  const visibleDeviceIds = useMemo(() => {
    let visible = []
    if (selectedGeocerca) {
      visible = devices.filter(d => pointInGeocerca(d, selectedGeocerca))
    } else if (zoneFilter !== 'todas') {
      visible = devices.filter(d => d.group_name === zoneFilter)
    } else {
      visible = devices
    }
    return new Set(visible.map(d => d.device_id))
  }, [devices, zoneFilter, selectedGeocerca, telemetry])

  // Inicializar mapa
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return
    const L = window.L
    if (!L) return

    const map = L.map(mapRef.current, { center:[-2.9027,-79.0045], zoom:13, zoomControl:false })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution:'© OpenStreetMap © CARTO', subdomains:'abcd', maxZoom:20
    }).addTo(map)
    L.control.zoom({ position:'bottomright' }).addTo(map)
    mapInstanceRef.current = map

    return () => {
      Object.values(markersRef.current).forEach(m => { try { m.remove() } catch(e){} })
      markersRef.current = {}
      geocercaLayersRef.current = []
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  // Agregar control de dibujo
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    const L = window.L
    if (!L || !L.Control || !L.Control.Draw) return

    const drawControl = new L.Control.Draw({
      draw: {
        polygon: true,
        circle: true,
        rectangle: false,
        marker: false,
        polyline: false,
      },
      edit: false
    })
    map.addControl(drawControl)
    drawControlRef.current = drawControl

    map.on(L.Draw.Event.CREATED, (e) => {
      const layer = e.layer
      setDrawnLayer(layer)
      setShowGeocercaNameModal(true)
      setDrawingMode(false)
      setSelectedDrawMode(null)
    })

    return () => {
      if (drawControlRef.current) map.removeControl(drawControlRef.current)
    }
  }, [mapInstanceRef.current])

  // Dibujar marcadores de paradas
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || devices.length === 0) return
    const L = window.L

    devices.forEach(device => {
      const t = telemetry[device.device_id] || {}
      const lat = t.lat ?? device.lat ?? device.current_lat
      const lng = t.lng ?? device.lng ?? device.current_lng
      const isVisible = visibleDeviceIds.has(device.device_id)

      if (!isVisible) {
        if (markersRef.current[device.device_id] && map.hasLayer(markersRef.current[device.device_id])) {
          map.removeLayer(markersRef.current[device.device_id])
        }
        return
      }
      if (!lat || !lng) return

      const soc = t.soc ?? device.soc ?? 0
      const status = device.status || 'offline'
      const isSelected = selectedDevices.has(device.device_id)
      const color = status === 'online' ? (soc>50 ? '#00e676' : soc>20 ? '#ffd740' : '#ff5252') : '#6b8ab0'
      const size = isSelected ? 44 : 36

      const html = `<div style="position:relative;width:${size}px;height:${size}px;">
        <div style="width:100%;height:100%;background:linear-gradient(135deg,#1a6fff,${color});border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid ${isSelected?'#fff':'#060d1a'};box-shadow:0 4px 16px rgba(26,111,255,${isSelected?0.8:0.4})"></div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-60%);font-size:14px">☀</div>
        ${status==='online'?`<div style="position:absolute;top:0;right:0;width:10px;height:10px;border-radius:50%;background:${color};border:2px solid #060d1a"></div>`:''}
      </div>`

      const photo = device.photo_url ? `<img src="${device.photo_url}" style="width:100%;height:130px;object-fit:cover;border-radius:6px;margin-bottom:10px;display:block" />` : ''
      const popupHtml = `<div style="font-family:'DM Sans',sans-serif;color:#e8f0fe;background:#0c1829;min-width:230px;padding:2px">
        ${photo}
        <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin-bottom:3px">${device.name}</div>
        <div style="font-size:11px;color:#6b8ab0;margin-bottom:10px">${device.address||''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin-bottom:10px">
          <div><span style="color:#3d5a80">SOC</span><br><strong style="color:#1a6fff">${soc}%</strong></div>
          <div><span style="color:#3d5a80">Voltaje</span><br><strong style="color:#00d4ff">${(t.voltage||0).toFixed(1)}V</strong></div>
          <div><span style="color:#3d5a80">Temp</span><br><strong style="color:#ffd740">${(t.temperature||0).toFixed(1)}°C</strong></div>
          <div><span style="color:#3d5a80">Señal</span><br><strong style="color:#00e676">${t.rssi||'--'} dBm</strong></div>
        </div>
        <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener noreferrer" style="display:block;text-align:center;padding:6px;background:rgba(26,111,255,0.12);border:1px solid rgba(26,111,255,0.3);border-radius:6px;color:#5a9fff;text-decoration:none;font-size:11px;font-weight:600;margin-bottom:6px">🗺 Ver en Google Maps</a>
        <div style="display:flex;gap:6px">
          <button onclick="window.__navDev('${device.device_id}')" style="flex:1;padding:6px;background:#1a6fff;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:11px;font-weight:600">Ver detalle →</button>
          <button onclick="window.__editDev('${device.device_id}')" style="padding:6px 10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#e8f0fe;cursor:pointer;font-size:11px">✏️</button>
        </div>
      </div>`

      if (markersRef.current[device.device_id] && map.hasLayer(markersRef.current[device.device_id])) {
        markersRef.current[device.device_id].setLatLng([lat,lng])
        markersRef.current[device.device_id].setIcon(L.divIcon({html,iconSize:[44,44],iconAnchor:[22,44],className:''}))
        markersRef.current[device.device_id].getPopup()?.setContent(popupHtml)
      } else {
        if (markersRef.current[device.device_id]) {
          try { markersRef.current[device.device_id].remove() } catch(e){}
        }
        const marker = L.marker([lat,lng], { icon:L.divIcon({html,iconSize:[44,44],iconAnchor:[22,44],className:''}) }).addTo(map)
        marker.bindPopup(popupHtml, { className:'dark-popup', maxWidth:270 })
        marker.on('click', () => {
          setSelectedDevice(device.device_id)
          setSelectedDevices(prev => { const n=new Set(prev); n.add(device.device_id); return n })
        })
        markersRef.current[device.device_id] = marker
      }
    })
  }, [devices, telemetry, selectedDevices, visibleDeviceIds, mapInstanceRef.current])

  // Dibujar geocercas
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    const L = window.L

    geocercaLayersRef.current.forEach(l => map.removeLayer(l))
    geocercaLayersRef.current = []

    // Determinar qué geocercas dibujar
    let geocercasToDraw = []
    if (selectedGeocerca) {
      // Si hay una geocerca seleccionada, solo dibujar esa
      geocercasToDraw = [selectedGeocerca]
    } else if (showGeocercas) {
      // Si no hay selección y showGeocercas es true, dibujar todas
      geocercasToDraw = geocercas
    }

    geocercasToDraw.forEach(g => {
      let layer
      if (g.type === 'circle' && g.center_lat) {
        layer = L.circle([g.center_lat, g.center_lng], {
          radius: g.radius || 50,
          color: '#1a6fff',
          fillColor: '#1a6fff',
          fillOpacity: 0.08,
          weight: 1
        }).addTo(map)
      } else if (g.type === 'polygon' && g.polygon) {
        try {
          const coords = JSON.parse(g.polygon)
          layer = L.polygon(coords, {
            color: '#ff9800',
            fillColor: '#ff9800',
            fillOpacity: 0.08,
            weight: 1
          }).addTo(map)
        } catch (e) {}
      }
      if (layer) {
        // Añadir popup con opciones de edición/eliminación
        const popupContent = document.createElement('div')
        popupContent.innerHTML = `
          <div style="font-family:'DM Sans',sans-serif;color:#e8f0fe;background:#0c1829;min-width:180px;padding:6px">
            <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700;margin-bottom:6px">${g.name}</div>
            <div style="display:flex;gap:6px;justify-content:space-around">
              <button class="edit-geocerca" data-id="${g.id}" style="flex:1;padding:5px;background:rgba(26,111,255,0.2);border:1px solid rgba(26,111,255,0.4);border-radius:6px;color:#5a9fff;cursor:pointer;font-size:11px">Editar</button>
              <button class="delete-geocerca" data-id="${g.id}" style="flex:1;padding:5px;background:rgba(255,82,82,0.1);border:1px solid rgba(255,82,82,0.3);border-radius:6px;color:#ff5252;cursor:pointer;font-size:11px">Eliminar</button>
            </div>
          </div>
        `
        layer.bindPopup(popupContent, { className: 'dark-popup', maxWidth: 220 })

        // Manejar clics en los botones del popup
        layer.on('popupopen', () => {
          document.querySelector('.edit-geocerca')?.addEventListener('click', (e) => {
            e.stopPropagation()
            const id = e.target.dataset.id
            const geocerca = geocercas.find(g => g.id === parseInt(id))
            if (geocerca) setEditingGeocerca(geocerca)
            layer.closePopup()
          })
          document.querySelector('.delete-geocerca')?.addEventListener('click', async (e) => {
            e.stopPropagation()
            const id = e.target.dataset.id
            if (!confirm('¿Eliminar geocerca?')) return
            try {
              await axios.delete(`${API}/geocercas/${id}`)
              toast.success('Geocerca eliminada')
              fetchGeocercas()
              layer.closePopup()
            } catch {
              toast.error('Error al eliminar')
            }
          })
        })

        geocercaLayersRef.current.push(layer)
      }
    })
  }, [geocercas, showGeocercas, selectedGeocerca, mapInstanceRef.current, fetchGeocercas])

  useEffect(() => {
    window.__navDev = (id) => navigate(`/device/${id}`)
    window.__editDev = (id) => { const d = devices.find(d => d.device_id === id); if (d) setEditDevice(d) }
    return () => { delete window.__navDev; delete window.__editDev }
  }, [navigate, devices])

  const flyTo = (device) => {
    const t = telemetry[device.device_id] || {}
    const lat = t.lat ?? device.lat ?? device.current_lat
    const lng = t.lng ?? device.lng ?? device.current_lng
    if (lat && lng && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat,lng], 17, { duration:1 })
      markersRef.current[device.device_id]?.openPopup()
    }
  }

  const toggleGroup = (name) => setExpandedGroups(g => ({...g, [name]: g[name]===false ? true : false}))
  const toggleDevice = (id) => setSelectedDevices(s => { const n=new Set(s); if(n.has(id)) n.delete(id); else n.add(id); return n })

  const selectZone = (zoneName) => {
    setZoneFilter(zoneName)
    setSelectedGeocerca(null)
    setSelectedDevices(new Set())
    if (zoneName !== 'todas' && mapInstanceRef.current) {
      const L = window.L
      const points = devices.filter(d => d.group_name===zoneName).map(d => {
        const t = telemetry[d.device_id]||{}
        return [t.lat??d.lat, t.lng??d.lng]
      }).filter(p => p[0]&&p[1])
      if (points.length > 0) mapInstanceRef.current.fitBounds(L.latLngBounds(points), { padding:[40,40], maxZoom:15 })
    } else if (zoneName === 'todas' && mapInstanceRef.current) {
      mapInstanceRef.current.setView([-2.9027,-79.0045], 13)
    }
    setShowZoneDropdown(false)
  }

  const handleInputChange = (e) => {
    const value = e.target.value
    setFilter(value)
    if (value.trim() === '') {
      setSuggestions([])
      setShowSuggestions(false)
    } else {
      const zoneMatches = zones.filter(z => z !== 'todas' && z.toLowerCase().includes(value.toLowerCase()))
      const geocercaMatches = geocercas.filter(g => g.name.toLowerCase().includes(value.toLowerCase()))
      const combined = [
        ...zoneMatches.map(z => ({ type: 'zona', name: z })),
        ...geocercaMatches.map(g => ({ type: 'geocerca', name: g.name, id: g.id }))
      ]
      setSuggestions(combined)
      setShowSuggestions(combined.length > 0)
    }
  }

  const handleSuggestionClick = (item) => {
    if (item.type === 'zona') {
      selectZone(item.name)
    } else {
      const geocerca = geocercas.find(g => g.id === item.id)
      if (geocerca) {
        setSelectedGeocerca(geocerca)
        setZoneFilter('todas')
        setSelectedDevices(new Set())
        if (mapInstanceRef.current) {
          const L = window.L
          if (geocerca.type === 'circle') {
            mapInstanceRef.current.setView([geocerca.center_lat, geocerca.center_lng], 15)
          } else if (geocerca.type === 'polygon') {
            try {
              const bounds = L.latLngBounds(JSON.parse(geocerca.polygon))
              mapInstanceRef.current.fitBounds(bounds, { padding: [40,40] })
            } catch (e) {}
          }
        }
      }
    }
    setFilter('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const startDrawing = (mode) => {
    setDrawingMode(true)
    setSelectedDrawMode(mode)
    setShowDrawMenu(false)
    if (drawControlRef.current) {
      drawControlRef.current._toolbars.draw._modes.polygon.handler.disable()
      drawControlRef.current._toolbars.draw._modes.circle.handler.disable()
      if (mode === 'polygon') {
        drawControlRef.current._toolbars.draw._modes.polygon.handler.enable()
      } else if (mode === 'circle') {
        drawControlRef.current._toolbars.draw._modes.circle.handler.enable()
      }
    }
  }

  const cancelDrawing = () => {
    if (drawControlRef.current) {
      drawControlRef.current._toolbars.draw._modes.polygon.handler.disable()
      drawControlRef.current._toolbars.draw._modes.circle.handler.disable()
    }
    setDrawingMode(false)
    setSelectedDrawMode(null)
  }

  const saveNewGeocerca = async () => {
    if (!newGeocercaName.trim()) {
      toast.error('Debe ingresar un nombre')
      return
    }
    const L = window.L
    let geocercaData = { name: newGeocercaName }
    if (drawnLayer instanceof L.Circle) {
      const center = drawnLayer.getLatLng()
      geocercaData.type = 'circle'
      geocercaData.center_lat = center.lat
      geocercaData.center_lng = center.lng
      geocercaData.radius = drawnLayer.getRadius()
    } else if (drawnLayer instanceof L.Polygon) {
      const latlngs = drawnLayer.getLatLngs()[0]
      const coords = latlngs.map(ll => [ll.lat, ll.lng])
      geocercaData.type = 'polygon'
      geocercaData.polygon = JSON.stringify(coords)
    } else {
      toast.error('Tipo de geometría no soportado')
      return
    }

    try {
      await axios.post(`${API}/geocercas`, geocercaData)
      toast.success('Geocerca guardada')
      fetchGeocercas()
      setShowGeocercaNameModal(false)
      setNewGeocercaName('')
      setDrawnLayer(null)
    } catch (error) {
      console.error('Error al guardar geocerca:', error)
      toast.error('Error al guardar: ' + (error.response?.data?.error || error.message))
    }
  }

  const mapBtnStyle = (active) => ({
    background: active ? 'rgba(26,111,255,0.88)' : 'rgba(15,20,35,0.88)',
    border: `1px solid ${active ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)'}`,
    borderRadius:8, padding:'7px 12px', color:'#fff', fontWeight:600,
    cursor:'pointer', fontSize:11, backdropFilter:'blur(10px)',
    boxShadow:'0 2px 8px rgba(0,0,0,0.4)', whiteSpace:'nowrap',
  })

  return (
    <div style={{ height:'100%', display:'flex', position:'relative' }}>
      {/* Sidebar */}
      <div style={{ width:sidebarOpen ? 'min(280px,85vw)' : 0, borderRight:'1px solid var(--border,#1a3050)', background:'var(--bg-sidebar,rgba(12,24,41,0.97))', display:'flex', flexDirection:'column', transition:'all 0.2s ease', overflow:'hidden', flexShrink:0 }}>
        <div style={{ padding:'10px 12px 8px', borderBottom:'1px solid var(--border,#1a3050)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700 }}>Paradas</div>
            {selectedDevices.size > 0 && (
              <button onClick={() => setSelectedDevices(new Set())} style={{ background:'rgba(255,82,82,0.15)', border:'1px solid rgba(255,82,82,0.3)', borderRadius:6, padding:'3px 8px', color:'#ff5252', cursor:'pointer', fontSize:10 }}>✕ Limpiar ({selectedDevices.size})</button>
            )}
          </div>

          {/* Barra de búsqueda con botón desplegable */}
          <div ref={dropdownRef} style={{ position: 'relative', marginBottom: '8px' }}>
            <div style={{ display: 'flex' }}>
              <input
                ref={inputRef}
                type="text"
                placeholder="Buscar parada, zona o geocerca..."
                value={filter}
                onChange={handleInputChange}
                onFocus={() => filter.trim() !== '' && handleInputChange({ target: { value: filter } })}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                style={{
                  flex: 1,
                  background: 'var(--bg-input,#111f35)',
                  border: '1px solid var(--border,#1a3050)',
                  borderRight: 'none',
                  borderRadius: '6px 0 0 6px',
                  padding: '6px 10px',
                  color: 'var(--text-primary,#e8f0fe)',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
              <button
                onClick={() => setShowZoneDropdown(prev => !prev)}
                style={{
                  background: 'var(--bg-input,#111f35)',
                  border: '1px solid var(--border,#1a3050)',
                  borderLeft: 'none',
                  borderRadius: '0 6px 6px 0',
                  padding: '6px 12px',
                  color: 'var(--text-secondary,#6b8ab0)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ▼
              </button>
            </div>

            {/* Menú desplegable de zonas y geocercas */}
            {showZoneDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'var(--bg-card,#0c1829)',
                border: '1px solid var(--border,#1a3050)',
                borderRadius: 6,
                marginTop: 2,
                zIndex: 1000,
                maxHeight: '200px',
                overflowY: 'auto',
              }}>
                <div
                  onClick={() => { selectZone('todas'); setSelectedGeocerca(null); setShowZoneDropdown(false) }}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    color: 'var(--text-primary,#e8f0fe)',
                    fontSize: 12,
                    borderBottom: '1px solid var(--border,#1a3050)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover, rgba(26,48,80,0.4))'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  🌐 Todas las zonas
                </div>
                {filterOptions.zones.filter(z => z !== 'todas').map(z => (
                  <div
                    key={z}
                    onClick={() => { selectZone(z); setShowZoneDropdown(false) }}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      color: 'var(--text-primary,#e8f0fe)',
                      fontSize: 12,
                      borderBottom: '1px solid var(--border,#1a3050)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover, rgba(26,48,80,0.4))'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    📍 {z}
                  </div>
                ))}
                {filterOptions.geocercas.map(g => (
                  <div
                    key={g.id}
                    onClick={() => {
                      setSelectedGeocerca(g)
                      setZoneFilter('todas')
                      setShowZoneDropdown(false)
                      if (mapInstanceRef.current) {
                        const L = window.L
                        if (g.type === 'circle') {
                          mapInstanceRef.current.setView([g.center_lat, g.center_lng], 15)
                        } else if (g.type === 'polygon') {
                          try {
                            const bounds = L.latLngBounds(JSON.parse(g.polygon))
                            mapInstanceRef.current.fitBounds(bounds, { padding: [40,40] })
                          } catch (e) {}
                        }
                      }
                    }}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      color: 'var(--text-primary,#e8f0fe)',
                      fontSize: 12,
                      borderBottom: '1px solid var(--border,#1a3050)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover, rgba(26,48,80,0.4))'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    🔵 {g.name}
                  </div>
                ))}
              </div>
            )}

            {/* Sugerencias de autocompletado */}
            {showSuggestions && suggestions.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'var(--bg-card,#0c1829)',
                border: '1px solid var(--border,#1a3050)',
                borderRadius: 6,
                marginTop: 2,
                zIndex: 1000,
                maxHeight: '200px',
                overflowY: 'auto',
              }}>
                {suggestions.map((item, idx) => (
                  <div
                    key={idx}
                    onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(item) }}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      color: 'var(--text-primary,#e8f0fe)',
                      fontSize: 12,
                      borderBottom: '1px solid var(--border,#1a3050)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover, rgba(26,48,80,0.4))'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {item.type === 'zona' ? '📍 ' : '🔵 '}{item.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedDevices.size > 0 && (
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'#5a9fff', marginTop:6 }}>
              ✓ Mostrando {selectedDevices.size} seleccionada{selectedDevices.size!==1?'s':''}
            </div>
          )}
        </div>

        {/* Lista de paradas agrupadas */}
        <div style={{ flex:1, overflow:'auto', padding:'8px 0' }}>
          {Object.entries(grouped).map(([group, devs]) => (
            <div key={group}>
              <div onClick={() => toggleGroup(group)} style={{ padding:'6px 12px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', color:'var(--text-secondary,#6b8ab0)', fontSize:11, fontFamily:"'DM Mono',monospace", letterSpacing:0.8, textTransform:'uppercase' }}>
                <span>{group}</span>
                <span style={{ fontSize:9 }}>{expandedGroups[group]===false ? '▶' : '▼'} {devs.length}</span>
              </div>
              {expandedGroups[group] !== false && devs.map(d => {
                const t = telemetry[d.device_id]||{}
                const soc = t.soc ?? d.soc ?? '--'
                const isOnline = d.status === 'online'
                const isSelected = selectedDevices.has(d.device_id)
                return (
                  <div key={d.device_id} onClick={() => toggleDevice(d.device_id)} style={{ padding:'8px 12px 8px 20px', cursor:'pointer', borderBottom:'1px solid rgba(26,48,80,0.5)', background:isSelected?'rgba(26,111,255,0.12)':'transparent', borderLeft:`3px solid ${isSelected?'var(--accent,#1a6fff)':'transparent'}`, transition:'all 0.15s' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:isSelected?700:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5 }}>
                          <span style={{ width:6, height:6, borderRadius:'50%', background:isOnline?'#00e676':'#ff5252', display:'inline-block', flexShrink:0 }} />
                          {d.name}
                        </div>
                        <div style={{ fontSize:10, color:'var(--text-muted,#3d5a80)', marginTop:2, fontFamily:"'DM Mono',monospace" }}>SOC: {soc}%</div>
                      </div>
                      <div style={{ display:'flex', gap:4 }}>
                        <button onClick={e=>{e.stopPropagation();flyTo(d)}} style={{ background:'none', border:'1px solid var(--border,#1a3050)', borderRadius:4, padding:'2px 6px', color:'var(--text-secondary,#6b8ab0)', cursor:'pointer', fontSize:11 }}>📍</button>
                        {user?.role==='gerente' && <button onClick={e=>{e.stopPropagation();setEditDevice(d)}} style={{ background:'none', border:'1px solid var(--border,#1a3050)', borderRadius:4, padding:'2px 6px', color:'var(--text-secondary,#6b8ab0)', cursor:'pointer', fontSize:11 }}>✏️</button>}
                        <button onClick={e=>{e.stopPropagation();navigate(`/device/${d.device_id}`)}} style={{ background:'none', border:'1px solid var(--border,#1a3050)', borderRadius:4, padding:'2px 6px', color:'var(--text-secondary,#6b8ab0)', cursor:'pointer', fontSize:11 }}>→</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Mapa */}
      <div style={{ flex:1, position:'relative' }}>
        <style>{`
          .dark-popup .leaflet-popup-content-wrapper { background:var(--bg-card,#0c1829)!important;border:1px solid var(--border,#1a3050)!important;border-radius:10px!important;color:var(--text-primary,#e8f0fe)!important;padding:0!important }
          .dark-popup .leaflet-popup-tip { background:var(--bg-card,#0c1829)!important }
          .dark-popup .leaflet-popup-content { margin:12px!important }
        `}</style>
        <div ref={mapRef} style={{ width:'100%', height:'100%' }} />

        <div style={{ position:'absolute', top:12, left:12, zIndex:1000, display:'flex', flexDirection:'column', gap:6 }}>
          <button onClick={() => setSidebarOpen(o=>!o)} style={mapBtnStyle(false)}>{sidebarOpen ? '◀ Lista' : '▶ Lista'}</button>
          <button onClick={() => setShowGeocercas(g=>!g)} style={mapBtnStyle(showGeocercas)}>🔵 Geocercas</button>

          {/* Botón de geocerca con menú */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                if (drawingMode) {
                  cancelDrawing()
                } else {
                  setShowDrawMenu(!showDrawMenu)
                }
              }}
              style={mapBtnStyle(drawingMode || showDrawMenu)}
            >
              {drawingMode ? '✕ Cancelar dibujo' : '➕ Geocerca'}
            </button>
            {showDrawMenu && !drawingMode && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                background: 'var(--bg-card, #0c1829)',
                border: '1px solid var(--border, #1a3050)',
                borderRadius: 8,
                marginTop: 4,
                zIndex: 1000,
                minWidth: 140,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}>
                <div
                  onClick={() => startDrawing('polygon')}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    color: 'var(--text-primary, #e8f0fe)',
                    fontSize: 12,
                    borderBottom: '1px solid var(--border, #1a3050)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover, rgba(26,48,80,0.4))'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  📐 Polígono
                </div>
                <div
                  onClick={() => startDrawing('circle')}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    color: 'var(--text-primary, #e8f0fe)',
                    fontSize: 12,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover, rgba(26,48,80,0.4))'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  ⚪ Círculo
                </div>
              </div>
            )}
          </div>

          {/* Botón de crear zona/parada */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowCreateMenu(!showCreateMenu)}
              style={mapBtnStyle(showCreateMenu)}
            >
              + Crear
            </button>
            {showCreateMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                background: 'var(--bg-card, #0c1829)',
                border: '1px solid var(--border, #1a3050)',
                borderRadius: 8,
                marginTop: 4,
                zIndex: 1000,
                minWidth: 160,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}>
                <div
                  onClick={() => {
                    setShowNewZoneModal(true)
                    setShowCreateMenu(false)
                  }}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    color: 'var(--text-primary, #e8f0fe)',
                    fontSize: 12,
                    borderBottom: '1px solid var(--border, #1a3050)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover, rgba(26,48,80,0.4))'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  📍 Crear zona
                </div>
                <div
                  onClick={() => {
                    setShowNewStopModal(true)
                    setShowCreateMenu(false)
                  }}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    color: 'var(--text-primary, #e8f0fe)',
                    fontSize: 12,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover, rgba(26,48,80,0.4))'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  🚏 Crear parada
                </div>
              </div>
            )}
          </div>

          {selectedDevices.size > 0 && (
            <button onClick={() => setSelectedDevices(new Set())} style={{ ...mapBtnStyle(true), background:'rgba(255,82,82,0.8)' }}>✕ Ver todas</button>
          )}
        </div>

        <div style={{ position:'absolute', bottom:40, right:12, zIndex:1000, display:'flex', flexDirection:'column', gap:6 }}>
          {devices.filter(d => visibleDeviceIds.has(d.device_id)).slice(0,4).map(d => {
            const t = telemetry[d.device_id]||{}
            const soc = t.soc??'--'
            const sn = typeof soc==='number'?soc:null
            const sc = sn===null?'#aaa':sn>50?'#00e676':sn>20?'#ffd740':'#ff5252'
            return (
              <div key={d.device_id} style={{ background:'rgba(10,16,30,0.92)', border:'1px solid rgba(255,255,255,0.12)', borderLeft:`3px solid ${sc}`, borderRadius:8, padding:'6px 12px', backdropFilter:'blur(12px)', boxShadow:'0 2px 12px rgba(0,0,0,0.5)', fontFamily:"'DM Mono',monospace", fontSize:10, display:'flex', gap:10, alignItems:'center', minWidth:120 }}>
                <span style={{ color:'#aaa', fontSize:9 }}>{d.name.split(' ').slice(-1)[0]}</span>
                <span style={{ color:sc, fontWeight:700 }}>{soc}%</span>
                <span style={{ color:'#ffd740' }}>{t.panel_power?`${t.panel_power.toFixed(0)}W`:'--'}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal para nombre de nueva geocerca */}
      {showGeocercaNameModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)', padding:16 }}
          onClick={e => e.target === e.currentTarget && setShowGeocercaNameModal(false)}>
          <div style={{ background:'#0c1829', border:'1px solid #1a3050', borderRadius:14, width:'100%', maxWidth:400, padding:'20px' }}>
            <h3 style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, marginBottom:12 }}>Nombre de la geocerca</h3>
            <input
              type="text"
              placeholder="ej: Zona Centro, Carretera Sur..."
              value={newGeocercaName}
              onChange={e => setNewGeocercaName(e.target.value)}
              style={{ width:'100%', background:'#111f35', border:'1px solid #1a3050', borderRadius:8, padding:'10px', color:'#e8f0fe', fontSize:14, marginBottom:16, outline:'none' }}
              onKeyDown={e => e.key === 'Enter' && saveNewGeocerca()}
              autoFocus
            />
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setShowGeocercaNameModal(false)} style={{ flex:1, background:'none', border:'1px solid #1a3050', borderRadius:8, padding:'10px', color:'#6b8ab0', cursor:'pointer' }}>Cancelar</button>
              <button onClick={saveNewGeocerca} style={{ flex:1, background:'rgba(26,111,255,0.2)', border:'1px solid rgba(26,111,255,0.4)', borderRadius:8, padding:'10px', color:'#5a9fff', cursor:'pointer', fontWeight:700 }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para editar geocerca */}
      {editingGeocerca && (
        <EditGeocercaModal
          geocerca={editingGeocerca}
          onClose={() => setEditingGeocerca(null)}
          onSaved={() => {
            fetchGeocercas()
            setEditingGeocerca(null)
          }}
        />
      )}

      {/* Modal para crear nueva zona */}
      {showNewZoneModal && (
        <ZoneModal
          zone={null}
          groups={groups}
          onClose={() => setShowNewZoneModal(false)}
          onSaved={() => {
            axios.get(`${API}/devices/meta/groups`).then(r => setGroups(r.data)).catch(() => {})
          }}
        />
      )}

      {/* Modal para crear nueva parada */}
      {showNewStopModal && (
        <StopModal
          stop={null}
          groups={groups}
          onClose={() => setShowNewStopModal(false)}
          onSaved={() => fetchDevices()}
        />
      )}

      {editDevice && (
        <StopEditModal device={editDevice} groups={groups} onClose={() => setEditDevice(null)}
          onSaved={() => { if(fetchDevices) fetchDevices(); setEditDevice(null) }} />
      )}
    </div>
  )
}