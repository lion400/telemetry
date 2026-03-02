// ══════════════════════════════════════════════════════════════════
// SolarTrack — Temas de personalización EMOV
// Paleta extraída de emov.gob.ec / Alcaldía de Cuenca:
//   #000000  negro base
//   #DD102E  rojo EMOV institucional
//   #4D4D4D  gris oscuro
//   #151515  casi negro
//   #111212  negro texto
//   #868686  gris medio
//   #666666  gris suave
//   #EFEFEF  gris claro
//   #FAFAFA  blanco cálido
//   #FFFFFF  blanco puro
// ══════════════════════════════════════════════════════════════════

export const THEMES = [
  {
    id: 'solartrack',
    name: 'SolarTrack Original',
    description: 'Paleta azul-marino por defecto del sistema — dark tech',
    preview: ['#060d1a', '#0c1829', '#1a6fff', '#e8f0fe'],
    vars: {
      '--bg-app':          '#060d1a',
      '--bg-sidebar':      '#060d1a',
      '--bg-card':         '#0c1829',
      '--bg-input':        '#111f35',
      '--bg-hover':        'rgba(26,48,80,0.4)',
      '--bg-header':       'rgba(6,13,26,0.97)',
      '--border':          '#1a3050',
      '--border-active':   '#1a6fff',
      '--text-primary':    '#e8f0fe',
      '--text-secondary':  '#6b8ab0',
      '--text-muted':      '#3d5a80',
      '--text-header':     '#e8f0fe',
      '--accent':          '#1a6fff',
      '--accent-dim':      'rgba(26,111,255,0.15)',
      '--accent-border':   'rgba(26,111,255,0.35)',
      '--accent2':         '#00d4ff',
      '--nav-active-bg':   'rgba(26,111,255,0.15)',
      '--nav-active-text': '#5a9fff',
      '--online':          '#00e676',
      '--offline':         '#ff5252',
      '--warning':         '#ffd740',
    },
  },
  {
    id: 'emov-oscuro',
    name: 'EMOV Oscuro',
    description: 'Negro institucional con rojo EMOV — identidad oficial',
    preview: ['#000000', '#DD102E', '#4D4D4D', '#FFFFFF'],
    vars: {
      '--bg-app':          '#000000',
      '--bg-sidebar':      '#111212',
      '--bg-card':         '#151515',
      '--bg-input':        '#1a1a1a',
      '--bg-hover':        'rgba(30,30,30,0.6)',
      '--bg-header':       '#000000',
      '--border':          '#2a2a2a',
      '--border-active':   '#DD102E',
      '--text-primary':    '#FFFFFF',
      '--text-secondary':  '#868686',
      '--text-muted':      '#4D4D4D',
      '--text-header':     '#FFFFFF',
      '--accent':          '#DD102E',
      '--accent-dim':      'rgba(221,16,46,0.15)',
      '--accent-border':   'rgba(221,16,46,0.35)',
      '--accent2':         '#4D4D4D',
      '--nav-active-bg':   'rgba(221,16,46,0.12)',
      '--nav-active-text': '#DD102E',
      '--online':          '#00e676',
      '--offline':         '#ff5252',
      '--warning':         '#ffd740',
    },
  },
  {
    id: 'emov-rojo',
    name: 'EMOV Rojo',
    description: 'Rojo EMOV dominante sobre fondo muy oscuro — alto impacto',
    preview: ['#1a0004', '#DD102E', '#ff4060', '#FAFAFA'],
    vars: {
      '--bg-app':          '#0d0003',
      '--bg-sidebar':      '#160005',
      '--bg-card':         '#1a0006',
      '--bg-input':        '#220008',
      '--bg-hover':        'rgba(37,0,10,0.8)',
      '--bg-header':       '#0d0003',
      '--border':          '#3d0010',
      '--border-active':   '#DD102E',
      '--text-primary':    '#FAFAFA',
      '--text-secondary':  '#cc8891',
      '--text-muted':      '#7a3040',
      '--text-header':     '#FAFAFA',
      '--accent':          '#DD102E',
      '--accent-dim':      'rgba(221,16,46,0.2)',
      '--accent-border':   'rgba(221,16,46,0.45)',
      '--accent2':         '#ff4060',
      '--nav-active-bg':   'rgba(221,16,46,0.18)',
      '--nav-active-text': '#ff6070',
      '--online':          '#00e676',
      '--offline':         '#ff5252',
      '--warning':         '#ffd740',
    },
  },
  {
    id: 'emov-gris',
    name: 'EMOV Gris Urbano',
    description: 'Grises urbanos con acento rojo — estilo moderno neutro',
    preview: ['#151515', '#4D4D4D', '#DD102E', '#EFEFEF'],
    vars: {
      '--bg-app':          '#111212',
      '--bg-sidebar':      '#151515',
      '--bg-card':         '#1c1c1c',
      '--bg-input':        '#242424',
      '--bg-hover':        'rgba(40,40,40,0.8)',
      '--bg-header':       '#111212',
      '--border':          '#333333',
      '--border-active':   '#DD102E',
      '--text-primary':    '#EFEFEF',
      '--text-secondary':  '#868686',
      '--text-muted':      '#555555',
      '--text-header':     '#EFEFEF',
      '--accent':          '#DD102E',
      '--accent-dim':      'rgba(221,16,46,0.12)',
      '--accent-border':   'rgba(221,16,46,0.3)',
      '--accent2':         '#666666',
      '--nav-active-bg':   'rgba(221,16,46,0.1)',
      '--nav-active-text': '#DD102E',
      '--online':          '#00e676',
      '--offline':         '#ff5252',
      '--warning':         '#ffd740',
    },
  },
  {
    id: 'emov-claro',
    name: 'EMOV Claro',
    description: 'Fondo blanco EMOV con rojo institucional — ideal para presentaciones',
    preview: ['#FFFFFF', '#EFEFEF', '#DD102E', '#111212'],
    vars: {
      '--bg-app':          '#F4F6F9',
      '--bg-sidebar':      '#FFFFFF',
      '--bg-card':         '#FFFFFF',
      '--bg-input':        '#EFEFEF',
      '--bg-hover':        'rgba(220,220,230,0.5)',
      '--bg-header':       '#FFFFFF',
      '--border':          '#D8DCE6',
      '--border-active':   '#DD102E',
      '--text-primary':    '#111212',
      '--text-secondary':  '#4D4D4D',
      '--text-muted':      '#868686',
      '--text-header':     '#111212',
      '--accent':          '#DD102E',
      '--accent-dim':      'rgba(221,16,46,0.08)',
      '--accent-border':   'rgba(221,16,46,0.3)',
      '--accent2':         '#4D4D4D',
      '--nav-active-bg':   'rgba(221,16,46,0.08)',
      '--nav-active-text': '#DD102E',
      '--online':          '#1b9e4b',
      '--offline':         '#cc2222',
      '--warning':         '#c47d00',
    },
  },
  {
    id: 'emov-contraste',
    name: 'EMOV Alto Contraste',
    description: 'Máxima legibilidad — negro puro, rojo brillante, blanco puro',
    preview: ['#000000', '#FF1A35', '#FFFFFF', '#868686'],
    vars: {
      '--bg-app':          '#000000',
      '--bg-sidebar':      '#000000',
      '--bg-card':         '#0a0a0a',
      '--bg-input':        '#111111',
      '--bg-hover':        'rgba(22,22,22,0.9)',
      '--bg-header':       '#000000',
      '--border':          '#333333',
      '--border-active':   '#FF1A35',
      '--text-primary':    '#FFFFFF',
      '--text-secondary':  '#CCCCCC',
      '--text-muted':      '#666666',
      '--text-header':     '#FFFFFF',
      '--accent':          '#FF1A35',
      '--accent-dim':      'rgba(255,26,53,0.2)',
      '--accent-border':   'rgba(255,26,53,0.5)',
      '--accent2':         '#868686',
      '--nav-active-bg':   'rgba(255,26,53,0.15)',
      '--nav-active-text': '#FF1A35',
      '--online':          '#00FF88',
      '--offline':         '#FF4444',
      '--warning':         '#FFDD00',
    },
  },
  {
    id: 'alcaldia-cuenca',
    name: 'Alcaldía de Cuenca',
    description: 'Fondo gris claro institucional, rojo EMOV y tipografía oscura — identidad Municipio de Cuenca 2023-2027',
    preview: ['#F0F0F0', '#FFFFFF', '#DD102E', '#1A1A1A'],
    vars: {
      '--bg-app':          '#EDEEF0',
      '--bg-sidebar':      '#FFFFFF',
      '--bg-card':         '#FFFFFF',
      '--bg-input':        '#F5F5F5',
      '--bg-hover':        'rgba(200,200,210,0.45)',
      '--bg-header':       '#DD102E',
      '--border':          '#D0D3DA',
      '--border-active':   '#DD102E',
      '--text-primary':    '#1A1A1A',
      '--text-secondary':  '#4D4D4D',
      '--text-muted':      '#868686',
      '--text-header':     '#FFFFFF',
      '--accent':          '#DD102E',
      '--accent-dim':      'rgba(221,16,46,0.08)',
      '--accent-border':   'rgba(221,16,46,0.3)',
      '--accent2':         '#E85B00',
      '--nav-active-bg':   'rgba(221,16,46,0.1)',
      '--nav-active-text': '#DD102E',
      '--online':          '#1b9e4b',
      '--offline':         '#cc2222',
      '--warning':         '#c47d00',
    },
  },
]

export const DEFAULT_THEME_ID = 'solartrack'

// Aplica un tema inyectando variables CSS en :root
export function applyTheme(themeId) {
  const theme = THEMES.find(t => t.id === themeId) || THEMES[0]
  const root = document.documentElement
  root.style.setProperty('transition', 'background 0.35s ease, color 0.25s ease')
  Object.entries(theme.vars).forEach(([key, val]) => {
    root.style.setProperty(key, val)
  })
  root.setAttribute('data-theme', themeId)
  localStorage.setItem('solartrack_theme', themeId)
}

// Carga el tema guardado o el por defecto
export function loadSavedTheme() {
  const saved = localStorage.getItem('solartrack_theme') || DEFAULT_THEME_ID
  applyTheme(saved)
  return saved
}

export function getActiveThemeId() {
  return localStorage.getItem('solartrack_theme') || DEFAULT_THEME_ID
}

export function getActiveTheme() {
  return THEMES.find(t => t.id === getActiveThemeId()) || THEMES[0]
}
