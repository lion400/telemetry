import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { useStore } from '../store'

const API = '/api'

const TYPES = {
  intrusion: 'Intrusión gabinete',
  low_battery: 'Batería baja',
  power_loss: 'Pérdida energía',
  geofence: 'Geocerca',
  shock: 'Golpe / Choque',
  disconnect: 'Desconexión',
  overtemperature: 'Sobretemperatura',
  disconnect_battery: 'Desconexión batería',
  weak_signal: 'Señal débil',
}

const SEVERITIES = {
  info:     { color: '#5a9fff', label: 'Info' },
  warning:  { color: '#ffd740', label: 'Aviso' },
  critical: { color: '#ff5252', label: 'Crítico' },
}

// Columnas exportables (especificación: hora/fecha, parada, tipo, mensaje, dirección)
const ALL_COLUMNS = [
  { id: 'ts',          label: 'Fecha / Hora' },
  { id: 'device_name', label: 'Parada' },
  { id: 'type',        label: 'Tipo' },
  { id: 'severity',    label: 'Severidad' },
  { id: 'message',     label: 'Mensaje' },
  { id: 'address',     label: 'Dirección' },
]

function getColValue(ev, colId) {
  switch (colId) {
    case 'ts':          return ev.ts ? new Date(ev.ts.endsWith('Z') ? ev.ts : ev.ts + 'Z').toLocaleString('es-EC', { timeZone: 'America/Guayaquil' }) : ''
    case 'device_name': return ev.device_name || ev.device_id || ''
    case 'type':        return TYPES[ev.type] || ev.type || ''
    case 'severity':    return SEVERITIES[ev.severity]?.label || ev.severity || ''
    case 'message':     return ev.message || ''
    case 'address':     return ev.address || ''
    default:            return ''
  }
}

export default function EventsView() {
  const { devices } = useStore()
  const [events, setEvents] = useState([])
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({ device_id: '', severity: '', type: '', from: '', to: '' })
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [selectedCols, setSelectedCols] = useState(new Set(ALL_COLUMNS.map(c => c.id)))
  const LIMIT = 30

  // Fecha 12 meses atrás por defecto
  const defaultFrom = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API}/events`, {
        params: { ...filters, from: filters.from || defaultFrom, limit: LIMIT, offset: page * LIMIT }
      })
      setEvents(data.events || [])
      setTotal(data.total || 0)
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const resolve = async (id) => {
    await axios.put(`${API}/events/${id}/resolve`)
    fetchEvents()
  }

  const toggleCol = (id) => {
    setSelectedCols(s => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  // ── CSV ────────────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const cols = ALL_COLUMNS.filter(c => selectedCols.has(c.id))
    const header = cols.map(c => `"${c.label}"`).join(',')
    const rows = events.map(ev => cols.map(c => `"${getColValue(ev, c.id).replace(/"/g, '""')}"`).join(','))
    const blob = new Blob(['\uFEFF' + header + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    download(blob, `eventos_${today()}.csv`)
    setShowExportMenu(false)
  }

  // ── XLS (simple HTML table → xls) ────────────────────────────────────────
  const exportXLS = () => {
    const cols = ALL_COLUMNS.filter(c => selectedCols.has(c.id))
    const rows = events.map(ev => cols.map(c => `<td>${esc(getColValue(ev, c.id))}</td>`).join(''))
    const html = `<html><head><meta charset="utf-8"/></head><body>
      <table border="1">
        <tr>${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr>
        ${rows.map(r => `<tr>${r}</tr>`).join('')}
      </table></body></html>`
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    download(blob, `eventos_${today()}.xls`)
    setShowExportMenu(false)
  }

  // ── PDF (ventana impresión) ──────────────────────────────────────────────
  const exportPDF = () => {
    const cols = ALL_COLUMNS.filter(c => selectedCols.has(c.id))
    const rows = events.map(ev =>
      `<tr>${cols.map(c => `<td>${esc(getColValue(ev, c.id))}</td>`).join('')}</tr>`
    ).join('')
    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Eventos SolarTrack — EMOV</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:10px;margin:20px}
        h2{color:#1a3050;margin-bottom:4px}
        .sub{color:#6b8ab0;font-size:9px;margin-bottom:12px}
        table{width:100%;border-collapse:collapse}
        th{background:#1a3050;color:#fff;padding:6px 8px;text-align:left;font-size:9px}
        td{padding:5px 8px;border-bottom:1px solid #e0e0e0;font-size:9px}
        tr:nth-child(even){background:#f5f8ff}
      </style>
    </head><body>
      <h2>☀ SolarTrack — Historial de Eventos</h2>
      <div class="sub">EMOV Paradas Seguras · Exportado: ${new Date().toLocaleString('es-EC')} · ${total} eventos</div>
      <table><thead><tr>${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody></table>
    </body></html>`
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.print()
    setShowExportMenu(false)
  }

  const download = (blob, filename) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
  }

  const today = () => new Date().toISOString().slice(0, 10)
  const esc = (s) => String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const inp = {
    background: '#111f35', border: '1px solid #1a3050', borderRadius: 6,
    padding: '6px 10px', color: '#e8f0fe', fontSize: 12, outline: 'none',
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #1a3050', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800 }}>Historial de Eventos</h1>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#3d5a80', marginTop: 2 }}>
            {total} eventos · últimos 12 meses
          </div>
        </div>

        {/* Exportar con menú */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowExportMenu(m => !m)}
            style={{ background: '#1a6fff', border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', cursor: 'pointer', fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: 12 }}>
            ↓ Exportar ▾
          </button>

          {showExportMenu && (
            <div style={{
              position: 'absolute', right: 0, top: 40, zIndex: 500, width: 300,
              background: '#0c1829', border: '1px solid #1a3050', borderRadius: 12,
              padding: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}>
              {/* Selector de columnas */}
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1.5, color: '#3d5a80', textTransform: 'uppercase', marginBottom: 10 }}>
                Columnas a exportar
              </div>
              {ALL_COLUMNS.map(c => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer', fontSize: 12 }}>
                  <input type="checkbox" checked={selectedCols.has(c.id)} onChange={() => toggleCol(c.id)}
                    style={{ accentColor: '#1a6fff', width: 14, height: 14 }} />
                  {c.label}
                </label>
              ))}
              <div style={{ borderTop: '1px solid #1a3050', marginTop: 12, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: '📄 Exportar CSV', fn: exportCSV },
                  { label: '📊 Exportar XLS', fn: exportXLS },
                  { label: '🖨 Exportar PDF', fn: exportPDF },
                ].map(({ label, fn }) => (
                  <button key={label} onClick={fn} style={{
                    background: '#111f35', border: '1px solid #1a3050', borderRadius: 7,
                    padding: '8px 12px', color: '#e8f0fe', cursor: 'pointer', fontSize: 12, textAlign: 'left',
                  }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ padding: '10px 24px', borderBottom: '1px solid #1a3050', display: 'flex', gap: 10, flexWrap: 'wrap', background: '#0c1829' }}>
        <select style={inp} value={filters.device_id} onChange={e => { setFilters(f => ({...f, device_id: e.target.value})); setPage(0) }}>
          <option value="">Todas las paradas</option>
          {devices.map(d => <option key={d.device_id} value={d.device_id}>{d.name}</option>)}
        </select>
        <select style={inp} value={filters.severity} onChange={e => { setFilters(f => ({...f, severity: e.target.value})); setPage(0) }}>
          <option value="">Toda severidad</option>
          <option value="critical">Crítico</option>
          <option value="warning">Aviso</option>
          <option value="info">Info</option>
        </select>
        <select style={inp} value={filters.type} onChange={e => { setFilters(f => ({...f, type: e.target.value})); setPage(0) }}>
          <option value="">Todos los tipos</option>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" style={inp} value={filters.from} onChange={e => { setFilters(f => ({...f, from: e.target.value})); setPage(0) }} />
        <input type="date" style={inp} value={filters.to}   onChange={e => { setFilters(f => ({...f, to: e.target.value})); setPage(0) }} />
        <button onClick={() => { setFilters({ device_id:'',severity:'',type:'',from:'',to:'' }); setPage(0) }}
          style={{ ...inp, cursor: 'pointer', color: '#6b8ab0' }}>
          Limpiar
        </button>
      </div>

      {/* Tabla */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#0c1829', position: 'sticky', top: 0, zIndex: 10 }}>
              {['Fecha / Hora', 'Parada', 'Tipo', 'Severidad', 'Mensaje', 'Dirección', 'Acciones'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', borderBottom: '1px solid #1a3050', fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1, color: '#3d5a80', textTransform: 'uppercase', fontWeight: 400 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#3d5a80' }}>Cargando...</td></tr>
            ) : events.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#3d5a80' }}>Sin eventos encontrados</td></tr>
            ) : events.map(ev => {
              const sev = SEVERITIES[ev.severity] || SEVERITIES.info
              return (
                <tr key={ev.id}
                  style={{ borderBottom: '1px solid #1a3050', opacity: ev.resolved ? 0.5 : 1 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#111f35'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '10px 16px', fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#6b8ab0', whiteSpace: 'nowrap' }}>
                    {ev.ts ? new Date(ev.ts.endsWith('Z') ? ev.ts : ev.ts + 'Z').toLocaleString('es-EC', { timeZone: 'America/Guayaquil' }) : '--'}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 12 }}>{ev.device_name || ev.device_id}</td>
                  <td style={{ padding: '10px 16px', fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
                    {TYPES[ev.type] || ev.type}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 20,
                      background: `${sev.color}18`, color: sev.color,
                      border: `1px solid ${sev.color}40`,
                      fontFamily: "'DM Mono',monospace",
                    }}>
                      {sev.label}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 12, maxWidth: 280 }}>{ev.message}</td>
                  <td style={{ padding: '10px 16px', fontSize: 11, color: '#6b8ab0' }}>{ev.address || '—'}</td>
                  <td style={{ padding: '10px 16px' }}>
                    {!ev.resolved && (
                      <button onClick={() => resolve(ev.id)} style={{
                        background: 'none', border: '1px solid #1a3050', borderRadius: 6,
                        padding: '3px 8px', color: '#00e676', cursor: 'pointer', fontSize: 10,
                      }}>✓ Resolver</button>
                    )}
                    {ev.resolved && <span style={{ fontSize: 10, color: '#3d5a80' }}>✓ Resuelto</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div style={{ padding: '10px 24px', borderTop: '1px solid #1a3050', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 11, color: '#6b8ab0' }}>
          {total === 0 ? '0' : `${page * LIMIT + 1}–${Math.min((page + 1) * LIMIT, total)}`} de {total}
        </span>
        <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
          style={{ background: '#111f35', border: '1px solid #1a3050', borderRadius: 6, padding: '4px 12px', color: page === 0 ? '#3d5a80' : '#e8f0fe', cursor: 'pointer' }}>
          ←
        </button>
        <button disabled={(page + 1) * LIMIT >= total} onClick={() => setPage(p => p + 1)}
          style={{ background: '#111f35', border: '1px solid #1a3050', borderRadius: 6, padding: '4px 12px', color: (page + 1) * LIMIT >= total ? '#3d5a80' : '#e8f0fe', cursor: 'pointer' }}>
          →
        </button>
      </div>
    </div>
  )
}
