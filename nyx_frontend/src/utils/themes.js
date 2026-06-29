// ── All theme definitions + shared helpers ────────────────────
// Import this in SettingsPage, ThemeContext, and anywhere else
// that needs theme data or the applyTheme function.

export const THEMES = [
  {
    id: 'nyx-purple', name: 'Nyx Purple',
    mood: 'Mysterious · Cinematic',
    performance: 'HIGH',
    swatches: ['#7B4DFF', '#C7A6FF', '#B96CFF', '#02030A'],
    preview: { bg: '#02030A', primary: '#7B4DFF', accent: '#C7A6FF', surface: 'rgba(10,12,30,0.75)' },
    vars: {
      '--color-primary':       '#7B4DFF',
      '--color-secondary':     '#B96CFF',
      '--color-accent':        '#C7A6FF',
      '--color-background':    '#02030A',
      '--color-surface':       'rgba(10,12,30,0.48)',
      '--color-border':        'rgba(140,100,255,0.20)',
      '--color-glow':          'rgba(123,77,255,0.55)',
      '--color-text-primary':  '#EDE8FF',
      '--color-text-secondary':'#B9A6FF',
      '--color-text-muted':    '#8E86B8',
      '--color-text-disabled': '#5E587A',
      '--color-primary-rgb':   '123, 77, 255',
      '--color-accent-rgb':    '199, 166, 255',
      '--color-bg-rgb':        '2, 3, 10',
      '--glow-intensity':      '1.0',
      '--particle-opacity':    '0.6',
    },
  },
  {
    id: 'emerald-green', name: 'Emerald Green',
    mood: 'Vital · Organic',
    performance: 'HIGH',
    swatches: ['#00C87A', '#4DFFB8', '#009960', '#01100A'],
    preview: { bg: '#010D08', primary: '#00C87A', accent: '#4DFFB8', surface: 'rgba(0,20,10,0.75)' },
    vars: {
      '--color-primary':       '#00C87A',
      '--color-secondary':     '#009960',
      '--color-accent':        '#4DFFB8',
      '--color-background':    '#010D08',
      '--color-surface':       'rgba(0,20,10,0.48)',
      '--color-border':        'rgba(0,200,122,0.20)',
      '--color-glow':          'rgba(0,200,122,0.55)',
      '--color-text-primary':  '#E8FFF4',
      '--color-text-secondary':'#7DFFC4',
      '--color-text-muted':    '#4A9E7A',
      '--color-text-disabled': '#2A5048',
      '--color-primary-rgb':   '0, 200, 122',
      '--color-accent-rgb':    '77, 255, 184',
      '--color-bg-rgb':        '1, 13, 8',
      '--glow-intensity':      '1.0',
      '--particle-opacity':    '0.55',
    },
  },
  {
    id: 'amber-gold', name: 'Amber Gold',
    mood: 'Imperial · Warm',
    performance: 'HIGH',
    swatches: ['#FFB800', '#FFD966', '#FF8C00', '#0C0800'],
    preview: { bg: '#0C0800', primary: '#FFB800', accent: '#FFD966', surface: 'rgba(20,14,0,0.75)' },
    vars: {
      '--color-primary':       '#FFB800',
      '--color-secondary':     '#FF8C00',
      '--color-accent':        '#FFD966',
      '--color-background':    '#0C0800',
      '--color-surface':       'rgba(20,14,0,0.48)',
      '--color-border':        'rgba(255,184,0,0.20)',
      '--color-glow':          'rgba(255,184,0,0.55)',
      '--color-text-primary':  '#FFF8E0',
      '--color-text-secondary':'#FFD580',
      '--color-text-muted':    '#B8882A',
      '--color-text-disabled': '#6B5010',
      '--color-primary-rgb':   '255, 184, 0',
      '--color-accent-rgb':    '255, 217, 102',
      '--color-bg-rgb':        '12, 8, 0',
      '--glow-intensity':      '1.0',
      '--particle-opacity':    '0.5',
    },
  },
  {
    id: 'pure-white', name: 'Pure White',
    mood: 'Clean · Minimal',
    performance: 'LOW',
    swatches: ['#0071E3', '#5AC8FA', '#86868B', '#F5F5F7'],
    preview: { bg: '#F0F0F5', primary: '#0071E3', accent: '#5AC8FA', surface: 'rgba(255,255,255,0.85)' },
    vars: {
      '--color-primary':       '#0071E3',
      '--color-secondary':     '#34AADC',
      '--color-accent':        '#5AC8FA',
      '--color-background':    '#F0F0F5',
      '--color-surface':       'rgba(255,255,255,0.78)',
      '--color-border':        'rgba(0,113,227,0.15)',
      '--color-glow':          'rgba(0,113,227,0.25)',
      '--color-text-primary':  '#1D1D1F',
      '--color-text-secondary':'#424245',
      '--color-text-muted':    '#86868B',
      '--color-text-disabled': '#B0B0B5',
      '--color-primary-rgb':   '0, 113, 227',
      '--color-accent-rgb':    '90, 200, 250',
      '--color-bg-rgb':        '240, 240, 245',
      '--glow-intensity':      '0.3',
      '--particle-opacity':    '0.2',
    },
  },
  {
    id: 'matrix-green', name: 'Matrix Green',
    mood: 'Hacker · Terminal',
    performance: 'MEDIUM',
    swatches: ['#00FF41', '#00BB30', '#003B00', '#000300'],
    preview: { bg: '#000300', primary: '#00FF41', accent: '#39FF85', surface: 'rgba(0,18,0,0.75)' },
    vars: {
      '--color-primary':       '#00FF41',
      '--color-secondary':     '#00BB30',
      '--color-accent':        '#39FF85',
      '--color-background':    '#000300',
      '--color-surface':       'rgba(0,18,0,0.48)',
      '--color-border':        'rgba(0,255,65,0.18)',
      '--color-glow':          'rgba(0,255,65,0.65)',
      '--color-text-primary':  '#CCFFDD',
      '--color-text-secondary':'#00FF41',
      '--color-text-muted':    '#00882A',
      '--color-text-disabled': '#004415',
      '--color-primary-rgb':   '0, 255, 65',
      '--color-accent-rgb':    '57, 255, 133',
      '--color-bg-rgb':        '0, 3, 0',
      '--glow-intensity':      '1.3',
      '--particle-opacity':    '0.7',
    },
  },
  {
    id: 'crimson-red', name: 'Crimson Red',
    mood: 'Aggressive · Alert',
    performance: 'HIGH',
    swatches: ['#FF2448', '#FF6B6B', '#FF4500', '#0D0004'],
    preview: { bg: '#0D0004', primary: '#FF2448', accent: '#FF6B6B', surface: 'rgba(20,0,6,0.75)' },
    vars: {
      '--color-primary':       '#FF2448',
      '--color-secondary':     '#FF4500',
      '--color-accent':        '#FF6B6B',
      '--color-background':    '#0D0004',
      '--color-surface':       'rgba(20,0,6,0.48)',
      '--color-border':        'rgba(255,36,72,0.20)',
      '--color-glow':          'rgba(255,36,72,0.55)',
      '--color-text-primary':  '#FFE0E8',
      '--color-text-secondary':'#FF9AAA',
      '--color-text-muted':    '#8E3345',
      '--color-text-disabled': '#5A1A26',
      '--color-primary-rgb':   '255, 36, 72',
      '--color-accent-rgb':    '255, 107, 107',
      '--color-bg-rgb':        '13, 0, 4',
      '--glow-intensity':      '1.0',
      '--particle-opacity':    '0.55',
    },
  },
  {
    id: 'ice-blue', name: 'Ice Blue',
    mood: 'Arctic · Precise',
    performance: 'HIGH',
    swatches: ['#00C8FF', '#80EAFF', '#0058FF', '#010816'],
    preview: { bg: '#010816', primary: '#00C8FF', accent: '#80EAFF', surface: 'rgba(0,16,32,0.75)' },
    vars: {
      '--color-primary':       '#00C8FF',
      '--color-secondary':     '#0058FF',
      '--color-accent':        '#80EAFF',
      '--color-background':    '#010816',
      '--color-surface':       'rgba(0,16,32,0.48)',
      '--color-border':        'rgba(0,200,255,0.20)',
      '--color-glow':          'rgba(0,200,255,0.55)',
      '--color-text-primary':  '#E0F8FF',
      '--color-text-secondary':'#80EAFF',
      '--color-text-muted':    '#3A7A92',
      '--color-text-disabled': '#1A3A48',
      '--color-primary-rgb':   '0, 200, 255',
      '--color-accent-rgb':    '128, 234, 255',
      '--color-bg-rgb':        '1, 8, 22',
      '--glow-intensity':      '1.0',
      '--particle-opacity':    '0.6',
    },
  },
]

export const BACKGROUND_STYLES = [
  { id: 'deep-space',        name: 'Deep Space',        sym: '✦' },
  { id: 'tactical-grid',     name: 'Tactical Grid',     sym: '⊞' },
  { id: 'neural-network',    name: 'Neural Net',        sym: '◈' },
  { id: 'matrix-rain',       name: 'Matrix Rain',       sym: '⌗' },
  { id: 'cyberpunk-city',    name: 'Cyberpunk City',    sym: '⬡' },
  { id: 'minimal-black',     name: 'Minimal Black',     sym: '◾' },
  { id: 'orbital-particles', name: 'Pulse Radar',       sym: '◉' },
  { id: 'holographic-fog',   name: 'Holographic Fog',   sym: '◌' },
]

export function applyTheme(themeId) {
  const theme = THEMES.find(t => t.id === themeId)
  if (!theme) return
  const root = document.documentElement
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v))
}

// Read the current primary RGB from the live CSS var (for canvas use)
export function getPrimaryRGB() {
  return getComputedStyle(document.documentElement)
    .getPropertyValue('--color-primary-rgb').trim() || '123, 77, 255'
}

export function getBgRGB() {
  return getComputedStyle(document.documentElement)
    .getPropertyValue('--color-bg-rgb').trim() || '2, 3, 10'
}

export function isLightTheme() {
  const parts = getBgRGB().split(',').map(Number)
  return parts[0] + parts[1] + parts[2] > 400
}
