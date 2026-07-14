export const COLORS = {
  bg1: '#02030A', bg2: '#050716', bg3: '#090B1F', bg4: '#0B0D24',
  primary: '#7B4DFF', primaryLt: '#A874FF', primaryHi: '#C7A6FF',
  electric: '#B96CFF', electricHi: '#F0E6FF',
  blue: '#2F6BFF', blueHi: '#7AA7FF',
  text: '#EDE8FF', textMuted: '#8E86B8', textPurple: '#B9A6FF', textDim: '#5E587A',
  glass: 'rgba(12,14,34,0.42)', glassBorder: 'rgba(150,110,255,0.22)',
}

export const ORB_RINGS = [
  { rxR: 1.02, ryR: 0.20, speed:  0.38, color: 'rgba(255,255,255,0.95)', glowColor: '#C7A6FF', opacity: 1.0,  lw: 1.5, blur: 28, pc: 32 },
  { rxR: 0.92, ryR: 0.92, speed: -0.20, color: 'rgba(196,166,255,0.88)', glowColor: '#8F5CFF', opacity: 0.88, lw: 1.3, blur: 22, pc: 24 },
  { rxR: 1.08, ryR: 0.14, speed:  0.72, color: 'rgba(255,255,255,0.92)', glowColor: '#A874FF', opacity: 0.92, lw: 1.4, blur: 30, pc: 26 },
  { rxR: 0.80, ryR: 0.46, speed: -0.50, color: 'rgba(180,150,255,0.88)', glowColor: '#7B4DFF', opacity: 0.88, lw: 1.4, blur: 20, pc: 20 },
  { rxR: 1.15, ryR: 0.10, speed:  0.26, color: 'rgba(226,210,255,0.75)', glowColor: '#B96CFF', opacity: 0.75, lw: 0.9, blur: 18, pc: 14 },
]

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',  icon: 'grid' },
  { id: 'systems',   label: 'Systems',    icon: 'cpu' },
  { id: 'tasks',     label: 'Tasks',      icon: 'check-square' },
  { id: 'memory',    label: 'Memory',     icon: 'database' },
  { id: 'network',   label: 'Network',    icon: 'globe' },
  { id: 'models',    label: 'Models',     icon: 'box' },
  { id: 'plugins',   label: 'Plugins',    icon: 'plug' },
  { id: 'updates',   label: 'Updates',    icon: 'refresh-cw' },
  { id: 'settings',  label: 'Settings',   icon: 'settings' },
]

// THE FORGE channels are no longer hardcoded — Sidebar.jsx derives them from
// which plugins are installed (SageTech MarketPlace). A plugin's catalog
// `sidebar` field ({section,id,label}) + `icon` drive its entry.

// Maps page id <-> URL path for browser routing (used by App.jsx)
export const PAGE_PATHS = {
  dashboard:  '/',
  systems:    '/systems',
  tasks:      '/tasks',
  memory:     '/memory',
  network:    '/network',
  models:     '/models',
  plugins:    '/plugins',
  updates:    '/updates',
  settings:   '/settings',
  globalview: '/global-view',
  music:      '/music',
  agents:     '/agents',
}

// Initial placeholder shown only until the first real /api/system response arrives.
export const MOCK_SYSTEM = { cpu: 0, memory: 0, disk: 0, network: 0 }

// 127.0.0.1, not localhost — same class of bug as the v1.14 Ollama fix:
// on Windows "localhost" can resolve to IPv6 (::1) first and stall before
// falling back to IPv4, and the backend binds to 127.0.0.1.
export const API_URL = 'http://127.0.0.1:8000'
