import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useStore } from '../store'

const API = '/api'

const PRESET_COLORS = ['#1a6fff','#DD102E','#00e676','#ffd740','#00d4ff','#ff5252','#ab47bc','#ff9800','#26c6da','#66bb6a']

function useIsMobile() {
  const [m, setM] = React.useState(window.innerWidth < 768)
  React.useEffect(() => { const h = () => setM(window.innerWidth < 768); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [])
  return m
}

// ── Modal zona ────────────────────────────────────────────────────────────────
function ZoneModal({ zone, onClose, onSaved }) {
  const [form, setForm] = useState({ name: zone?.name || '', color: zone?.color || '#1a6fff' })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nombre requerido'); return }
    setSaving(true)
    try {
      if (zone) await axios.put(`${API}/devices/meta/groups/${zone.id}`, form)
      else await axios.post(`${API}/devices/meta/groups`, form)
      toast.success(zone ? 'Zona actualizada' : 'Zona creada')
      onSaved(); onClose()
    } catch(e) { toast.error(e.response?.data?.error || 'Error') } finally { setSaving(false) }
  }

  const inp = {
    width: '100%',
    background: 'var(--bg-input, #111f35)',
    border: '1px solid var(--border, #1a3050)',
    borderRadius: 8,
    padding: '9px 12px',
    color: 'var(--text-primary, #e8f0fe)',
    fontSize: 13,
    outline: 'none',
    marginBottom: 12,
  }
  const lbl = {
    fontFamily: "'DM Mono',monospace",
    fontSize: 9,
    color: 'var(--text-muted, #3d5a80)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
    display: 'block',
  }

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)', padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background:'var(--bg-card, #0c1829)', border:'1px solid var(--border, #1a3050)', borderRadius:14, width:'100%', maxWidth:400, boxShadow:'0 20px 60px rgba(0,0,0,0.6)' }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border, #1a3050)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:15, color:'var(--text-primary, #e8f0fe)' }}>{zone ? '✏️ Editar zona' : '+ Nueva zona'}</div>
          <button onClick={onClose} style={{ background:'none', border:'1px solid var(--border, #1a3050)', borderRadius:7, padding:'4px 10px', color:'var(--text-secondary, #6b8ab0)', cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ padding:'18px 18px 6px' }}>
          <label style={lbl}>Nombre de la zona</label>
          <input style={inp} placeholder="ej: Norte, Guayaquil Sur..." value={form.name}
            onChange={e => setForm(f => ({...f, name:e.target.value}))}
            onKeyDown={e => e.key === 'Enter' && handleSave()} />
          <label style={lbl}>Color identificador</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
            {PRESET_COLORS.map(c => (
              <div key={c} onClick={() => setForm(f => ({...f, color:c}))} style={{
                width:28, height:28, borderRadius:6, background:c, cursor:'pointer',
                border:`3px solid ${form.color===c ? 'var(--text-primary, #fff)' : 'transparent'}`,
                boxShadow: form.color===c ? `0 0 0 2px ${c}` : 'none',
                transition:'all 0.1s',
              }} />
            ))}
            <input type="color" value={form.color} onChange={e => setForm(f => ({...f, color:e.target.value}))}
              style={{ width:28, height:28, border:'none', borderRadius:6, cursor:'pointer', padding:0, background:'none' }} title="Color personalizado" />
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--bg-hover, rgba(26,48,80,0.4))', borderRadius:8, marginBottom:16 }}>
            <div style={{ width:16, height:16, borderRadius:4, background:form.color, flexShrink:0 }} />
            <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13, color:'var(--text-primary, #e8f0fe)' }}>{form.name || 'Vista previa'}</span>
          </div>
        </div>
        <div style={{ padding:'0 18px 18px', display:'flex', gap:8 }}>
          <button onClick={onClose} style={{ flex:1, background:'none', border:'1px solid var(--border, #1a3050)', borderRadius:8, padding:9, color:'var(--text-secondary, #6b8ab0)', cursor:'pointer', fontSize:13 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ flex:2, background:'var(--accent-dim, rgba(26,111,255,0.2))', border:'1px solid var(--accent-border, rgba(26,111,255,0.4))', borderRadius:8, padding:9, color:'var(--accent, #5a9fff)', cursor:'pointer', fontSize:13, fontWeight:700, opacity:saving?0.6:1 }}>
            {saving ? 'Guardando...' : zone ? '✓ Actualizar' : '✓ Crear zona'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal parada ──────────────────────────────────────────────────────────────
function StopModal({ stop, groups, onClose, onSaved }) {
  const isEdit = !!stop
  const [form, setForm] = useState({
    device_id: stop?.device_id || '',
    imei:      stop?.imei      || '',
    name:      stop?.name      || '',
    address:   stop?.address   || '',
    group_id:  stop?.group_id  || '',
    lat:       stop?.lat       || '',
    lng:       stop?.lng       || '',
    photo_url: stop?.photo_url || '',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  const handlePhoto = (e) => {
    const file = e.target.files[0]; if (!file) return
    if (file.size > 2*1024*1024) { toast.error('Imagen máx 2MB'); return }
    setUploading(true)
    const reader = new FileReader()
    reader.onload = ev => { setForm(f => ({...f, photo_url:ev.target.result})); setUploading(false); toast.success('Foto cargada') }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nombre requerido'); return }
    if (!isEdit && !form.device_id.trim()) { toast.error('ID de parada requerido'); return }
    setSaving(true)
    try {
      const payload = { ...form, lat: form.lat ? parseFloat(form.lat) : null, lng: form.lng ? parseFloat(form.lng) : null, group_id: form.group_id || null }
      if (isEdit) await axios.put(`${API}/devices/${stop.device_id}`, payload)
      else await axios.post(`${API}/devices`, payload)
      toast.success(isEdit ? 'Parada actualizada' : 'Parada creada')
      onSaved(); onClose()
    } catch(e) { toast.error(e.response?.data?.error || 'Error') } finally { setSaving(false) }
  }

  const inp = {
    width: '100%',
    background: 'var(--bg-input, #111f35)',
    border: '1px solid var(--border, #1a3050)',
    borderRadius: 8,
    padding: '8px 12px',
    color: 'var(--text-primary, #e8f0fe)',
    fontSize: 13,
    outline: 'none',
    marginBottom: 10,
  }
  const lbl = {
    fontFamily: "'DM Mono',monospace",
    fontSize: 9,
    color: 'var(--text-muted, #3d5a80)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 3,
    display: 'block',
  }
  const gmaps = form.lat && form.lng ? `https://www.google.com/maps?q=${form.lat},${form.lng}` : null

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)', padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background:'var(--bg-card, #0c1829)', border:'1px solid var(--border, #1a3050)', borderRadius:14, width:'100%', maxWidth:520, maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,0.7)' }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border, #1a3050)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:15, color:'var(--text-primary, #e8f0fe)' }}>{isEdit ? '✏️ Editar parada' : '+ Nueva parada'}</div>
            {isEdit && <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'var(--text-muted, #3d5a80)', marginTop:2 }}>{stop.device_id}</div>}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'1px solid var(--border, #1a3050)', borderRadius:7, padding:'4px 10px', color:'var(--text-secondary, #6b8ab0)', cursor:'pointer' }}>✕</button>
        </div>

        <div style={{ padding:'14px 18px', overflowY:'auto', flex:1 }}>
          {/* Foto */}
          <label style={lbl}>Foto de la parada</label>
          {form.photo_url ? (
            <div style={{ position:'relative', marginBottom:10 }}>
              <img src={form.photo_url} alt="" style={{ width:'100%', height:140, objectFit:'cover', borderRadius:8, border:'1px solid var(--border, #1a3050)', display:'block' }} />
              <button onClick={() => setForm(f => ({...f,photo_url:''}))} style={{ position:'absolute', top:6, right:6, background:'rgba(255,82,82,0.9)', border:'none', borderRadius:6, padding:'3px 8px', color:'#fff', cursor:'pointer', fontSize:11 }}>✕</button>
            </div>
          ) : (
            <div
              style={{ width:'100%', height:90, border:'2px dashed var(--border, #1a3050)', borderRadius:8, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--text-muted, #3d5a80)', fontSize:12, marginBottom:8 }}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? '⏳ Cargando...' : '📷 Clic para subir foto'}<span style={{ fontSize:10, marginTop:3 }}>JPG / PNG · máx 2MB</span>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handlePhoto} />
          {!form.photo_url && (
            <button onClick={() => fileRef.current?.click()} style={{ ...inp, cursor:'pointer', color:'var(--text-secondary, #6b8ab0)', marginBottom:12 }}>📷 Subir foto</button>
          )}

          {/* IDs — solo en creación */}
          {!isEdit && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <label style={lbl}>ID único de parada *</label>
                <input style={inp} placeholder="GV310-EC-0001" value={form.device_id}
                  onChange={e => setForm(f => ({...f, device_id:e.target.value.toUpperCase().replace(/\s/g,'')}))} />
              </div>
              <div>
                <label style={lbl}>IMEI del dispositivo</label>
                <input style={inp} placeholder="863286020000000" value={form.imei}
                  onChange={e => setForm(f => ({...f, imei:e.target.value}))} />
              </div>
            </div>
          )}

          <label style={lbl}>Nombre de la parada *</label>
          <input style={inp} placeholder="ej: Parque Calderón — Centro Histórico" value={form.name}
            onChange={e => setForm(f => ({...f, name:e.target.value}))} />

          <label style={lbl}>Dirección</label>
          <input style={inp} placeholder="ej: Av. España y Huayna Cápac" value={form.address}
            onChange={e => setForm(f => ({...f, address:e.target.value}))} />

          <label style={lbl}>Zona</label>
          <select style={{ ...inp, cursor:'pointer' }} value={form.group_id} onChange={e => setForm(f => ({...f, group_id:e.target.value}))}>
            <option value="">Sin zona</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={lbl}>Latitud</label>
              <input style={inp} placeholder="-2.8970" type="number" step="any" value={form.lat}
                onChange={e => setForm(f => ({...f, lat:e.target.value}))} />
            </div>
            <div>
              <label style={lbl}>Longitud</label>
              <input style={inp} placeholder="-79.0045" type="number" step="any" value={form.lng}
                onChange={e => setForm(f => ({...f, lng:e.target.value}))} />
            </div>
          </div>

          {gmaps && (
            <a href={gmaps} target="_blank" rel="noopener noreferrer" style={{ display:'block', textAlign:'center', padding:'8px', background:'var(--accent-dim, rgba(26,111,255,0.08))', border:'1px solid var(--accent-border, rgba(26,111,255,0.25))', borderRadius:8, color:'var(--accent, #5a9fff)', textDecoration:'none', fontSize:12, fontWeight:600, marginBottom:4 }}>
              🗺 Verificar ubicación en Google Maps
            </a>
          )}
        </div>

        <div style={{ padding:'12px 18px', borderTop:'1px solid var(--border, #1a3050)', display:'flex', gap:8, flexShrink:0 }}>
          <button onClick={onClose} style={{ flex:1, background:'none', border:'1px solid var(--border, #1a3050)', borderRadius:8, padding:9, color:'var(--text-secondary, #6b8ab0)', cursor:'pointer', fontSize:13 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ flex:2, background:'var(--accent-dim, rgba(26,111,255,0.2))', border:'1px solid var(--accent-border, rgba(26,111,255,0.4))', borderRadius:8, padding:9, color:'var(--accent, #5a9fff)', cursor:'pointer', fontSize:13, fontWeight:700, opacity:saving?0.6:1 }}>
            {saving ? 'Guardando...' : isEdit ? '✓ Guardar cambios' : '✓ Crear parada'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Vista principal ───────────────────────────────────────────────────────────
export default function StopsView() {
  const isMobile = useIsMobile()
  const { user } = useStore()
  const [stops, setStops] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('stops')
  const [filterZone, setFilterZone] = useState('')
  const [filterText, setFilterText] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [editStop, setEditStop] = useState(null)
  const [newStop, setNewStop] = useState(false)
  const [editZone, setEditZone] = useState(null)
  const [newZone, setNewZone] = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [sRes, gRes] = await Promise.all([
        axios.get(`${API}/devices`),
        axios.get(`${API}/devices/meta/groups`),
      ])
      setStops(sRes.data)
      setGroups(gRes.data)
    } catch(e) { toast.error('Error cargando datos') } finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  const deleteStop = async (id) => {
    if (!confirm(`¿Desactivar parada ${id}? Se puede reactivar después.`)) return
    try { await axios.delete(`${API}/devices/${id}`); toast.success('Parada desactivada'); fetchAll() }
    catch(e) { toast.error(e.response?.data?.error || 'Error') }
  }

  const reactivateStop = async (id) => {
    try { await axios.put(`${API}/devices/${id}/reactivate`); toast.success('Parada reactivada'); fetchAll() }
    catch(e) { toast.error('Error') }
  }

  const deleteZone = async (id, name) => {
    if (!confirm(`¿Eliminar zona "${name}"?`)) return
    try { await axios.delete(`${API}/devices/meta/groups/${id}`); toast.success('Zona eliminada'); fetchAll() }
    catch(e) { toast.error(e.response?.data?.error || 'Error') }
  }

  const filteredStops = stops.filter(s => {
    const active = showInactive ? true : s.active !== 0
    const zone = !filterZone || s.group_id === parseInt(filterZone)
    const text = !filterText || s.name.toLowerCase().includes(filterText.toLowerCase()) || s.address?.toLowerCase().includes(filterText.toLowerCase()) || s.device_id.toLowerCase().includes(filterText.toLowerCase())
    return active && zone && text
  })

  const cardStyle = {
    background: 'var(--bg-card, #0c1829)',
    border: '1px solid var(--border, #1a3050)',
    borderRadius: 12,
    padding: isMobile ? '12px' : '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  }

  const btnPrimary = {
    background: 'var(--accent-dim, rgba(26,111,255,0.2))',
    border: '1px solid var(--accent-border, rgba(26,111,255,0.4))',
    borderRadius: 8,
    padding: '8px 16px',
    color: 'var(--accent, #5a9fff)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
  }
  const btnDanger = {
    background: 'rgba(255,82,82,0.1)',
    border: '1px solid rgba(255,82,82,0.3)',
    borderRadius: 8,
    padding: '6px 12px',
    color: 'var(--offline, #ff5252)',
    cursor: 'pointer',
    fontSize: 11,
  }
  const btnSuccess = {
    background: 'rgba(0,230,118,0.1)',
    border: '1px solid rgba(0,230,118,0.3)',
    borderRadius: 8,
    padding: '6px 12px',
    color: 'var(--online, #00e676)',
    cursor: 'pointer',
    fontSize: 11,
  }

  const filterInpStyle = {
    background: 'var(--bg-input, #111f35)',
    border: '1px solid var(--border, #1a3050)',
    borderRadius: 8,
    padding: '7px 12px',
    color: 'var(--text-primary, #e8f0fe)',
    fontSize: 12,
    outline: 'none',
    cursor: 'pointer',
  }

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg-app, #060d1a)' }}>

      {/* Header */}
      <div style={{ padding:isMobile?'10px 12px':'14px 24px', borderBottom:'1px solid var(--border, #1a3050)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, flexWrap:'wrap', gap:8, background:'var(--bg-app, #060d1a)' }}>
        <div>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:isMobile?17:20, fontWeight:800, color:'var(--text-primary, #e8f0fe)' }}>Gestión de Paradas</h1>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'var(--text-muted, #3d5a80)', letterSpacing:1, textTransform:'uppercase', marginTop:2 }}>
            {stops.filter(s=>s.active!==0).length} activas · {groups.length} zonas
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {tab === 'stops' && (
            <button onClick={() => setNewStop(true)} style={{ ...btnPrimary, fontSize:13 }}>+ Nueva parada</button>
          )}
          {tab === 'zones' && (
            <button onClick={() => setNewZone(true)} style={{ ...btnPrimary, fontSize:13 }}>+ Nueva zona</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:0, borderBottom:'1px solid var(--border, #1a3050)', flexShrink:0, background:'var(--bg-card, #0c1829)' }}>
        {[
          { id:'stops', label:`🚏 Paradas (${stops.filter(s=>s.active!==0).length})` },
          { id:'zones', label:`📍 Zonas (${groups.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: isMobile?'10px 16px':'11px 24px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: tab===t.id ? 'var(--nav-active-text, #5a9fff)' : 'var(--text-secondary, #6b8ab0)',
            borderBottom: `2px solid ${tab===t.id ? 'var(--accent, #1a6fff)' : 'transparent'}`,
            fontFamily: "'DM Mono',monospace",
            fontSize: isMobile?10:11,
            letterSpacing: 0.5,
            fontWeight: tab===t.id ? 700 : 400,
            transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex:1, overflow:'auto', padding:isMobile?'10px 12px':'16px 24px', background:'var(--bg-app, #060d1a)' }}>

        {/* ── Tab: Paradas ── */}
        {tab === 'stops' && (
          <>
            {/* Filtros */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
              <input
                type="text" placeholder="Buscar por nombre, dirección o ID..."
                value={filterText} onChange={e => setFilterText(e.target.value)}
                style={{ ...filterInpStyle, flex:1, minWidth:160 }}
              />
              <select value={filterZone} onChange={e => setFilterZone(e.target.value)} style={filterInpStyle}>
                <option value="">Todas las zonas</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button
                onClick={() => setShowInactive(v=>!v)}
                style={{
                  ...filterInpStyle,
                  background: showInactive ? 'rgba(255,215,64,0.1)' : 'var(--bg-input, #111f35)',
                  border: `1px solid ${showInactive ? 'rgba(255,215,64,0.4)' : 'var(--border, #1a3050)'}`,
                  color: showInactive ? 'var(--warning, #ffd740)' : 'var(--text-secondary, #6b8ab0)',
                  whiteSpace: 'nowrap',
                }}
              >
                {showInactive ? '👁 Todas' : '👁 Solo activas'}
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign:'center', padding:60, color:'var(--text-muted, #3d5a80)' }}>Cargando...</div>
            ) : filteredStops.length === 0 ? (
              <div style={{ textAlign:'center', padding:60, color:'var(--text-muted, #3d5a80)' }}>
                <div style={{ fontSize:32, marginBottom:12 }}>🚏</div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:'var(--text-primary, #e8f0fe)' }}>Sin paradas encontradas</div>
                <button onClick={() => setNewStop(true)} style={{ ...btnPrimary, marginTop:16 }}>+ Crear primera parada</button>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns: isMobile?'1fr':'repeat(auto-fill, minmax(340px,1fr))', gap:12 }}>
                {filteredStops.map(s => {
                  const group = groups.find(g => g.id === s.group_id)
                  const isInactive = s.active === 0
                  const gmaps = s.lat && s.lng ? `https://www.google.com/maps?q=${s.lat},${s.lng}` : null
                  return (
                    <div key={s.device_id} style={{
                      ...cardStyle,
                      opacity: isInactive ? 0.65 : 1,
                      borderColor: isInactive ? 'var(--border, #1a3050)' : group?.color ? `${group.color}40` : 'var(--border, #1a3050)',
                      borderLeft: `3px solid ${group?.color || 'var(--border, #1a3050)'}`,
                    }}>
                      {/* Foto */}
                      {s.photo_url && (
                        <img src={s.photo_url} alt="" style={{ width:'100%', height:120, objectFit:'cover', borderRadius:8, display:'block' }} />
                      )}
                      {/* Info */}
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:14, marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text-primary, #e8f0fe)' }}>
                            <span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%', background:s.status==='online'?'var(--online, #00e676)':'var(--offline, #ff5252)', marginRight:6, flexShrink:0 }} />
                            {s.name}
                          </div>
                          <div style={{ fontSize:11, color:'var(--text-secondary, #6b8ab0)', marginBottom:4 }}>{s.address}</div>
                          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                            <span style={{ fontFamily:"'DM Mono',monospace", fontSize:9, padding:'2px 7px', borderRadius:10, background:'var(--bg-hover, rgba(255,255,255,0.05))', color:'var(--text-muted, #3d5a80)' }}>{s.device_id}</span>
                            {group && <span style={{ fontFamily:"'DM Mono',monospace", fontSize:9, padding:'2px 7px', borderRadius:10, background:`${group.color}18`, color:group.color, border:`1px solid ${group.color}40` }}>{group.name}</span>}
                            {isInactive && <span style={{ fontFamily:"'DM Mono',monospace", fontSize:9, padding:'2px 7px', borderRadius:10, background:'rgba(255,82,82,0.1)', color:'var(--offline, #ff5252)' }}>Inactiva</span>}
                          </div>
                          {s.lat && s.lng && (
                            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'var(--text-muted, #3d5a80)', marginTop:4 }}>
                              {parseFloat(s.lat).toFixed(5)}, {parseFloat(s.lng).toFixed(5)}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Actions */}
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        <button onClick={() => setEditStop(s)} style={{ ...btnPrimary, padding:'6px 12px', flex:1 }}>✏️ Editar</button>
                        {gmaps && (
                          <a href={gmaps} target="_blank" rel="noopener noreferrer" style={{ ...btnPrimary, padding:'6px 10px', textDecoration:'none', textAlign:'center' }}>🗺</a>
                        )}
                        {isInactive
                          ? <button onClick={() => reactivateStop(s.device_id)} style={{ ...btnSuccess, flex:1 }}>↩ Reactivar</button>
                          : <button onClick={() => deleteStop(s.device_id)} style={{ ...btnDanger, flex:1 }}>⊘ Desactivar</button>
                        }
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── Tab: Zonas ── */}
        {tab === 'zones' && (
          <>
            {groups.length === 0 ? (
              <div style={{ textAlign:'center', padding:60, color:'var(--text-muted, #3d5a80)' }}>
                <div style={{ fontSize:32, marginBottom:12 }}>📍</div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:'var(--text-primary, #e8f0fe)' }}>Sin zonas definidas</div>
                <div style={{ fontSize:12, marginTop:6, marginBottom:16 }}>Las zonas agrupan paradas por sector geográfico</div>
                <button onClick={() => setNewZone(true)} style={btnPrimary}>+ Crear primera zona</button>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
                {groups.map(g => {
                  const stopsInZone = stops.filter(s => s.group_id === g.id && s.active !== 0)
                  return (
                    <div key={g.id} style={{ ...cardStyle, borderLeft:`4px solid ${g.color}` }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div style={{ width:40, height:40, borderRadius:10, background:`${g.color}22`, border:`2px solid ${g.color}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <div style={{ width:18, height:18, borderRadius:4, background:g.color }} />
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:16, color:'var(--text-primary, #e8f0fe)' }}>{g.name}</div>
                          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'var(--text-muted, #3d5a80)' }}>
                            {stopsInZone.length} parada{stopsInZone.length!==1?'s':''} activa{stopsInZone.length!==1?'s':''}
                          </div>
                        </div>
                      </div>
                      {stopsInZone.length > 0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                          {stopsInZone.map(s => (
                            <span key={s.device_id} style={{ fontFamily:"'DM Mono',monospace", fontSize:9, padding:'2px 8px', borderRadius:10, background:'var(--bg-hover, rgba(255,255,255,0.05))', color:'var(--text-secondary, #6b8ab0)' }}>
                              {s.name.split('—')[0].trim().split(' ').slice(-2).join(' ')}
                            </span>
                          ))}
                        </div>
                      )}
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => setEditZone(g)} style={{ ...btnPrimary, flex:1, padding:'7px' }}>✏️ Editar</button>
                        <button onClick={() => deleteZone(g.id, g.name)} style={{ ...btnDanger, padding:'7px 12px' }}>🗑</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {(newStop || editStop) && (
        <StopModal
          stop={editStop}
          groups={groups}
          onClose={() => { setNewStop(false); setEditStop(null) }}
          onSaved={fetchAll}
        />
      )}
      {(newZone || editZone) && (
        <ZoneModal
          zone={editZone}
          onClose={() => { setNewZone(false); setEditZone(null) }}
          onSaved={fetchAll}
        />
      )}
    </div>
  )
}
