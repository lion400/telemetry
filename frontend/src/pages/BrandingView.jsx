import React, { useState, useCallback, useRef } from 'react'
import { THEMES, applyTheme, saveThemeToServer, loadThemeFromServer } from '../themes'
import toast from 'react-hot-toast'

// ── Paleta EMOV extraída del sitio ────────────────────────────────────────
const EMOV_PALETTE = [
  { hex: '#000000', name: 'Negro base',    usage: 'Header, nav' },
  { hex: '#111212', name: 'Negro texto',   usage: 'Texto principal' },
  { hex: '#151515', name: 'Negro card',    usage: 'Fondos de card' },
  { hex: '#DD102E', name: 'Rojo EMOV',     usage: 'Acento institucional' },
  { hex: '#4D4D4D', name: 'Gris oscuro',   usage: 'Texto secundario' },
  { hex: '#666666', name: 'Gris suave',    usage: 'Texto terciario' },
  { hex: '#868686', name: 'Gris medio',    usage: 'Iconos, flechas' },
  { hex: '#EFEFEF', name: 'Gris claro',    usage: 'Botones, modales' },
  { hex: '#FAFAFA', name: 'Blanco cálido', usage: 'Fondo claro' },
  { hex: '#FFFFFF', name: 'Blanco puro',   usage: 'Cards, contenido' },
]

// ── Mini preview de la UI ─────────────────────────────────────────────────
function MiniPreview({ theme, size = 'normal' }) {
  const v = theme.vars
  const small = size === 'small'
  return (
    <div style={{
      borderRadius: small ? 6 : 10, overflow: 'hidden',
      border: `1px solid ${v['--border']}`,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      {/* Topbar */}
      <div style={{
        background: v['--bg-header'],
        borderBottom: `1px solid ${v['--border']}`,
        padding: small ? '4px 8px' : '6px 12px',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <div style={{ width: small ? 5 : 7, height: small ? 5 : 7, borderRadius: '50%', background: v['--accent'] }} />
        <span style={{ fontFamily: "'Syne',sans-serif", fontSize: small ? 7 : 9, fontWeight: 800, color: v['--text-header'] || v['--text-primary'] }}>
          Solar<span style={{ color: v['--accent'] }}>Track</span>
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
          <div style={{ width: 20, height: 5, borderRadius: 3, background: v['--accent-dim'], border: `1px solid ${v['--accent-border']}` }} />
          <div style={{ width: 12, height: 5, borderRadius: 3, background: v['--bg-input'] }} />
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', height: small ? 60 : 90 }}>
        {/* Sidebar */}
        <div style={{
          width: small ? 28 : 40, background: v['--bg-sidebar'],
          borderRight: `1px solid ${v['--border']}`,
          padding: small ? '4px 3px' : '6px 5px',
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          {[true, false, false, false].map((active, i) => (
            <div key={i} style={{
              height: small ? 7 : 10, borderRadius: 3, padding: '0 3px',
              background: active ? v['--nav-active-bg'] : 'transparent',
              border: active ? `1px solid ${v['--accent-border']}` : 'none',
              display: 'flex', alignItems: 'center', gap: 2,
            }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: active ? v['--nav-active-text'] : v['--text-muted'] }} />
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, background: v['--bg-app'], padding: small ? 4 : 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 3 }}>
            {[v['--online'], v['--accent'], v['--warning']].map((c, i) => (
              <div key={i} style={{ background: v['--bg-card'], borderRadius: 3, padding: '2px 4px', border: `1px solid ${v['--border']}` }}>
                <div style={{ fontSize: 7, fontWeight: 800, color: c }}>{'██'}</div>
              </div>
            ))}
          </div>
          {/* Table rows */}
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              height: small ? 8 : 11, background: i === 0 ? v['--accent-dim'] : v['--bg-card'],
              borderRadius: 3, border: `1px solid ${i === 0 ? v['--accent-border'] : v['--border']}`,
              display: 'flex', alignItems: 'center', gap: 4, padding: '0 5px',
            }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: i === 0 ? v['--online'] : v['--text-muted'] }} />
              <div style={{ flex: 1, height: 2, borderRadius: 2, background: v['--border'] }} />
              <div style={{ width: 10, height: 2, borderRadius: 2, background: i === 0 ? v['--accent'] : v['--bg-input'] }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta de tema ───────────────────────────────────────────────────────
function ThemeCard({ theme, isActive, isPreview, onApply, onPreviewEnter, onPreviewLeave }) {
  return (
    <div
      onMouseEnter={() => onPreviewEnter(theme.id)}
      onMouseLeave={onPreviewLeave}
      style={{
        background: 'var(--bg-card, #0c1829)',
        border: `2px solid ${isActive ? '#DD102E' : isPreview ? 'rgba(221,16,46,0.5)' : 'var(--border, #1a3050)'}`,
        borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
        transition: 'all 0.2s',
        transform: isPreview ? 'translateY(-3px)' : 'none',
        boxShadow: isActive
          ? '0 0 0 1px rgba(221,16,46,0.3), 0 8px 32px rgba(221,16,46,0.15)'
          : isPreview
            ? '0 8px 32px rgba(0,0,0,0.4)'
            : 'none',
      }}
    >
      {/* Mini UI preview */}
      <div style={{ padding: 14, background: theme.vars['--bg-app'] }}>
        <MiniPreview theme={theme} />
      </div>

      {/* Info */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 800, color: 'var(--text-primary, #e8f0fe)' }}>
            {theme.name}
          </span>
          {isActive && (
            <span style={{
              fontSize: 9, fontFamily: "'DM Mono',monospace",
              color: '#DD102E', background: 'rgba(221,16,46,0.12)',
              border: '1px solid rgba(221,16,46,0.35)',
              borderRadius: 8, padding: '2px 8px', letterSpacing: 0.5,
            }}>● ACTIVO</span>
          )}
          {isPreview && !isActive && (
            <span style={{
              fontSize: 9, fontFamily: "'DM Mono',monospace",
              color: '#ffd740', background: 'rgba(255,215,64,0.1)',
              border: '1px solid rgba(255,215,64,0.3)',
              borderRadius: 8, padding: '2px 8px', letterSpacing: 0.5,
            }}>👁 PREVIEW</span>
          )}
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-secondary, #6b8ab0)', marginBottom: 12, lineHeight: 1.5 }}>
          {theme.description}
        </p>

        {/* Color chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
          {theme.preview.map((c, i) => (
            <div key={i} title={c} style={{
              width: 24, height: 24, borderRadius: 6, background: c, flexShrink: 0,
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: ['#FFFFFF','#FAFAFA','#EFEFEF'].includes(c) ? 'inset 0 0 0 1px #ccc' : 'none',
            }} />
          ))}
          <span style={{ fontSize: 9, color: 'var(--text-muted, #3d5a80)', fontFamily: "'DM Mono',monospace", marginLeft: 4 }}>
            {theme.preview.join(' · ')}
          </span>
        </div>

        <button
          onClick={() => onApply(theme.id)}
          style={{
            width: '100%', padding: '9px',
            background: isActive
              ? 'rgba(221,16,46,0.12)'
              : isPreview
                ? '#DD102E'
                : 'rgba(26,48,80,0.6)',
            border: `1px solid ${isActive || isPreview ? 'rgba(221,16,46,0.4)' : 'var(--border, #1a3050)'}`,
            borderRadius: 8, cursor: isActive ? 'default' : 'pointer',
            color: isActive ? '#DD102E' : isPreview ? '#fff' : 'var(--text-secondary, #6b8ab0)',
            fontSize: 12, fontWeight: isActive || isPreview ? 700 : 400,
            transition: 'all 0.15s',
          }}
        >
          {isActive ? '✓ Tema aplicado' : isPreview ? '⚡ Aplicar ahora' : 'Seleccionar'}
        </button>
      </div>
    </div>
  )
}

// ── Vista principal ───────────────────────────────────────────────────────
export default function BrandingView() {
  // ── Assets de marca ──────────────────────────────────────────────────────
  const [logoUrl,   setLogoUrl]   = useState(() => localStorage.getItem('st_logo')    || null)
  const [faviconUrl,setFaviconUrl]= useState(() => localStorage.getItem('st_favicon') || null)
  const [appName,   setAppName]   = useState(() => localStorage.getItem('st_appname') || '')
  const logoInputRef    = useRef()
  const faviconInputRef = useRef()

  const saveBrandAsset = async (key, value, setter) => {
    localStorage.setItem(key, value)
    setter(value)
    window.dispatchEvent(new CustomEvent('st_brand_update', { detail: { key, value } }))
    // Persistir en servidor — mapear key local a campo API
    const apiKeyMap = { st_logo: 'logo_url', st_favicon: 'favicon_url', st_appname: 'app_name' }
    const apiKey = apiKeyMap[key]
    if (apiKey) {
      try {
        await fetch('/api/branding', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ [apiKey]: value })
        })
      } catch(e) { console.warn('Error guardando branding en servidor:', e) }
    }
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 500 * 1024) { toast.error('El logo no debe superar 500KB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      saveBrandAsset('st_logo', ev.target.result, setLogoUrl)
      toast.success('Logo actualizado en la barra superior', { icon: '🖼' })
    }
    reader.readAsDataURL(file)
  }

  const handleFaviconUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 100 * 1024) { toast.error('El favicon no debe superar 100KB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      saveBrandAsset('st_favicon', ev.target.result, setFaviconUrl)
      // Aplicar favicon inmediatamente en este tab también
      let link = document.querySelector("link[rel='icon']")
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
      link.href = ev.target.result
      toast.success('Favicon actualizado en la pestaña del navegador', { icon: '📌' })
    }
    reader.readAsDataURL(file)
  }

  const handleAppName = (e) => {
    const val = e.target.value
    setAppName(val)
    localStorage.setItem('st_appname', val)
    window.dispatchEvent(new CustomEvent('st_brand_update', { detail: { key: 'st_appname', value: val } }))
  }

  const clearAsset = async (key, setter) => {
    localStorage.removeItem(key)
    setter(null)
    window.dispatchEvent(new CustomEvent('st_brand_update', { detail: { key, value: null } }))
    if (key === 'st_favicon') {
      let link = document.querySelector("link[rel='icon']")
      if (link) link.href = '/favicon.png'
    }
    // Limpiar en servidor también
    const apiKeyMap = { st_logo: 'logo_url', st_favicon: 'favicon_url', st_appname: 'app_name' }
    const apiKey = apiKeyMap[key]
    if (apiKey) {
      try {
        await fetch('/api/branding', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ [apiKey]: '' })
        })
      } catch(e) {}
    }
    toast.success('Eliminado — se restauró el valor por defecto')
  }

  const [activeTheme, setActiveTheme] = useState(
    sessionStorage.getItem('st_theme_cache') || 'solartrack'
  )
  const [brandingLoaded, setBrandingLoaded] = useState(false)

  // Cargar configuración global desde servidor al abrir la vista
  React.useEffect(() => {
    loadThemeFromServer().then(b => {
      if (b.active_theme) setActiveTheme(b.active_theme)
      if (b.logo_url)     { setLogoUrl(b.logo_url);     localStorage.setItem('st_logo', b.logo_url) }
      if (b.favicon_url)  { setFaviconUrl(b.favicon_url); localStorage.setItem('st_favicon', b.favicon_url) }
      if (b.app_name)     { setAppName(b.app_name);     localStorage.setItem('st_appname', b.app_name) }
      setBrandingLoaded(true)
    })
  }, [])
  const [previewTheme, setPreviewTheme] = useState(null)
  const [hoveredColor, setHoveredColor] = useState(null)

  const currentTheme = THEMES.find(t => t.id === activeTheme) || THEMES[0]

  const applyAndSave = async (themeId) => {
    await saveThemeToServer(themeId)
    setActiveTheme(themeId)
    setPreviewTheme(null)
    const name = THEMES.find(t => t.id === themeId)?.name
    toast.success(`Tema "${name}" aplicado para todos los usuarios`, { icon: '🌐' })
  }

  const handlePreviewEnter = useCallback((themeId) => {
    if (themeId === previewTheme) return
    setPreviewTheme(themeId)
    applyTheme(themeId)
  }, [previewTheme])

  const handlePreviewLeave = useCallback(() => {
    setPreviewTheme(null)
    applyTheme(activeTheme)
  }, [activeTheme])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-app, #060d1a)' }}>

      {/* Header */}
      <div style={{
        padding: '14px 24px', borderBottom: '1px solid #1a3050',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, background: 'var(--bg-app, #060d1a)',
      }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800, color: 'var(--text-primary, #e8f0fe)' }}>
            Personalización
          </h1>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: 'var(--text-muted, #3d5a80)', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>
            Tema activo: <span style={{ color: '#DD102E' }}>{currentTheme.name}</span>
            {previewTheme && (
              <span style={{ color: '#ffd740', marginLeft: 12 }}>
                · Vista previa: {THEMES.find(t => t.id === previewTheme)?.name}
              </span>
            )}
          </div>
        </div>
        {previewTheme && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              background: 'rgba(255,215,64,0.1)', border: '1px solid rgba(255,215,64,0.3)',
              borderRadius: 8, padding: '6px 14px', fontSize: 11, color: '#ffd740',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>👁</span>
              <span>Vista previa activa — mueve el cursor fuera para cancelar</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>

        {/* ── Activos de Marca ───────────────────────────────────────── */}
        <section style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 3, height: 18, background: 'var(--accent, #DD102E)', borderRadius: 2 }} />
            <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #e8f0fe)' }}>
              Identidad de Marca
            </span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: 'var(--text-muted, #3d5a80)', letterSpacing: 1 }}>
              LOGO · FAVICON · NOMBRE
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>

            {/* ── Logo ── */}
            <div style={{ background: 'var(--bg-card, #0c1829)', border: '1px solid var(--border, #1a3050)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: 'var(--text-muted, #3d5a80)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
                🖼 Logo — sustituye "SolarTrack" en el header
              </div>
              {/* Preview */}
              <div style={{
                height: 64, background: 'var(--bg-input, #111f35)', borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 12, border: '1px dashed var(--border, #1a3050)',
                overflow: 'hidden',
              }}>
                {logoUrl
                  ? <img src={logoUrl} alt="Logo" style={{ maxHeight: 52, maxWidth: '90%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: 11, color: 'var(--text-muted, #3d5a80)' }}>Sin logo — se usa "SolarTrack"</span>
                }
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted, #3d5a80)', marginBottom: 10 }}>
                PNG/SVG/JPG · máx 500KB · fondo transparente recomendado
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => logoInputRef.current.click()}
                  style={{
                    flex: 1, background: 'var(--accent, #DD102E)', border: 'none',
                    borderRadius: 7, padding: '8px', cursor: 'pointer',
                    color: '#fff', fontSize: 11, fontWeight: 700,
                  }}
                >
                  ↑ Subir logo
                </button>
                {logoUrl && (
                  <button
                    onClick={() => clearAsset('st_logo', setLogoUrl)}
                    style={{
                      background: 'var(--bg-input, #111f35)', border: '1px solid var(--border, #1a3050)',
                      borderRadius: 7, padding: '8px 12px', cursor: 'pointer',
                      color: 'var(--text-secondary, #6b8ab0)', fontSize: 11,
                    }}
                  >✕</button>
                )}
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
            </div>

            {/* ── Favicon ── */}
            <div style={{ background: 'var(--bg-card, #0c1829)', border: '1px solid var(--border, #1a3050)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: 'var(--text-muted, #3d5a80)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
                📌 Favicon — icono de la pestaña del navegador
              </div>
              <div style={{
                height: 64, background: 'var(--bg-input, #111f35)', borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 12, border: '1px dashed var(--border, #1a3050)',
                gap: 16,
              }}>
                {faviconUrl
                  ? <>
                      <img src={faviconUrl} alt="Favicon" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 4 }} />
                      <div style={{ fontSize: 9, color: 'var(--text-secondary, #6b8ab0)' }}>
                        <div>Vista prestaña:</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, padding: '3px 7px' }}>
                          <img src={faviconUrl} style={{ width: 12, height: 12 }} alt="" />
                          <span style={{ fontSize: 9 }}>{appName || 'SolarTrack'}</span>
                        </div>
                      </div>
                    </>
                  : <span style={{ fontSize: 11, color: 'var(--text-muted, #3d5a80)' }}>Sin favicon personalizado</span>
                }
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted, #3d5a80)', marginBottom: 10 }}>
                ICO/PNG/SVG · máx 100KB · cuadrado recomendado
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => faviconInputRef.current.click()}
                  style={{
                    flex: 1, background: 'var(--accent, #DD102E)', border: 'none',
                    borderRadius: 7, padding: '8px', cursor: 'pointer',
                    color: '#fff', fontSize: 11, fontWeight: 700,
                  }}
                >
                  ↑ Subir favicon
                </button>
                {faviconUrl && (
                  <button
                    onClick={() => clearAsset('st_favicon', setFaviconUrl)}
                    style={{
                      background: 'var(--bg-input, #111f35)', border: '1px solid var(--border, #1a3050)',
                      borderRadius: 7, padding: '8px 12px', cursor: 'pointer',
                      color: 'var(--text-secondary, #6b8ab0)', fontSize: 11,
                    }}
                  >✕</button>
                )}
              </div>
              <input ref={faviconInputRef} type="file" accept="image/*,.ico" style={{ display: 'none' }} onChange={handleFaviconUpload} />
            </div>

            {/* ── Nombre de la app ── */}
            <div style={{ background: 'var(--bg-card, #0c1829)', border: '1px solid var(--border, #1a3050)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: 'var(--text-muted, #3d5a80)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
                ✏️ Nombre — reemplaza "SolarTrack" en el header
              </div>
              <input
                type="text"
                value={appName}
                onChange={handleAppName}
                placeholder="SolarTrack"
                maxLength={24}
                style={{
                  width: '100%', background: 'var(--bg-input, #111f35)',
                  border: '1px solid var(--border, #1a3050)', borderRadius: 7,
                  padding: '10px 12px', color: 'var(--text-primary, #e8f0fe)',
                  fontSize: 14, fontFamily: "'Syne',sans-serif", fontWeight: 700,
                  marginBottom: 8, outline: 'none',
                }}
              />
              <div style={{ fontSize: 10, color: 'var(--text-muted, #3d5a80)', marginBottom: 12 }}>
                Máx 24 caracteres · se aplica en tiempo real
              </div>
              {/* Vista previa del header */}
              <div style={{
                background: 'var(--bg-header, rgba(6,13,26,0.97))',
                borderRadius: 7, padding: '8px 12px',
                display: 'flex', alignItems: 'center', gap: 8,
                border: '1px solid var(--border, #1a3050)',
              }}>
                {logoUrl
                  ? <img src={logoUrl} alt="" style={{ height: 20, maxWidth: 60, objectFit: 'contain' }} />
                  : <div style={{ width: 18, height: 18, background: 'var(--accent, #DD102E)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>☀</div>
                }
                <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 12, fontWeight: 800, color: 'var(--text-header, #e8f0fe)' }}>
                  {appName || 'SolarTrack'}
                </span>
                <span style={{ fontSize: 9, color: 'var(--text-header, #e8f0fe)', opacity: 0.6 }}>· Paradas Seguras</span>
              </div>
            </div>

          </div>
        </section>

        {/* ── Paleta EMOV ────────────────────────────────────────────── */}
        <section style={{ marginBottom: 36 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
          }}>
            <div style={{ width: 3, height: 18, background: '#DD102E', borderRadius: 2 }} />
            <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #e8f0fe)' }}>
              Paleta EMOV
            </span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: 'var(--text-muted, #3d5a80)', letterSpacing: 1 }}>
              EXTRAÍDA DE EMOV.GOB.EC
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {EMOV_PALETTE.map(c => (
              <div
                key={c.hex}
                onMouseEnter={() => setHoveredColor(c.hex)}
                onMouseLeave={() => setHoveredColor(null)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  cursor: 'default',
                }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: 10, background: c.hex,
                  border: `2px solid ${hoveredColor === c.hex ? '#DD102E' : 'var(--border, #1a3050)'}`,
                  boxShadow: ['#FFFFFF','#FAFAFA','#EFEFEF'].includes(c.hex) ? 'inset 0 0 0 1px #ccc' : 'none',
                  transition: 'border-color 0.15s',
                  display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 4,
                }}>
                  {hoveredColor === c.hex && (
                    <span style={{ fontSize: 7, fontFamily: "'DM Mono',monospace", color: ['#000000','#111212','#151515'].includes(c.hex) ? '#666' : '#333', background: 'rgba(255,255,255,0.7)', borderRadius: 3, padding: '1px 3px' }}>
                      copiado
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-primary, #e8f0fe)', fontFamily: "'DM Mono',monospace", textAlign: 'center', fontWeight: 600 }}>
                  {c.hex}
                </div>
                <div style={{ fontSize: 8, color: 'var(--text-muted, #3d5a80)', textAlign: 'center', maxWidth: 52, lineHeight: 1.3 }}>
                  {c.name}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Temas ──────────────────────────────────────────────────── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 3, height: 18, background: '#DD102E', borderRadius: 2 }} />
            <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #e8f0fe)' }}>
              7 Variantes de Tema
            </span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-secondary, #6b8ab0)', marginBottom: 20, marginLeft: 13 }}>
            Pasa el cursor sobre un tema para ver la vista previa en toda la plataforma en tiempo real. Haz clic en <strong style={{ color: 'var(--text-primary, #e8f0fe)' }}>Aplicar ahora</strong> para guardarlo.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
            {THEMES.map(theme => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                isActive={theme.id === activeTheme}
                isPreview={theme.id === previewTheme}
                onApply={applyAndSave}
                onPreviewEnter={handlePreviewEnter}
                onPreviewLeave={handlePreviewLeave}
              />
            ))}
          </div>
        </section>

        {/* ── Variables CSS del tema activo ──────────────────────────── */}
        <section style={{ marginTop: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 3, height: 18, background: 'var(--accent, #1a6fff)', borderRadius: 2 }} />
            <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #e8f0fe)' }}>
              Variables CSS — {currentTheme.name}
            </span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: 'var(--text-muted, #3d5a80)' }}>
              {Object.keys(currentTheme.vars).length} variables activas
            </span>
          </div>

          <div style={{
            background: 'var(--bg-card, #0c1829)', border: '1px solid var(--border, #1a3050)', borderRadius: 12, padding: 16,
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8,
          }}>
            {Object.entries(currentTheme.vars).map(([key, val]) => (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px', borderRadius: 6, background: 'var(--bg-input, #111f35)',
              }}>
                <div style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  background: val.startsWith('#') || val.startsWith('rgba') ? val : 'transparent',
                  border: '1px solid var(--border, #1a3050)',
                  boxShadow: ['#FFFFFF','#FAFAFA','#EFEFEF'].some(w => val.includes(w)) ? 'inset 0 0 0 1px #ccc' : 'none',
                }} />
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted, #3d5a80)', fontFamily: "'DM Mono',monospace", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {key}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary, #6b8ab0)', fontFamily: "'DM Mono',monospace", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {val}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
