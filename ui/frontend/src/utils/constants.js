// ── Nyx design tokens ─────────────────────────────
export const COLORS = {
  nyxCore:   '#7c3aed',
  nyxBright: '#a78bfa',
  nyxDim:    '#4c1d95',
  nyxGlow:   '#6d28d9',
  nyxPulse:  '#c4b5fd',
  bgVoid:    '#05050f',
  bgDeep:    '#080814',
  bgPanel:   '#0b0b1a',
  bgSurface: '#0f0f22',
  textPrim:  '#e2e0ff',
  textSec:   '#8b85cc',
  textDim:   '#4a4680',
  border:    'rgba(124,58,237,0.18)',
  borderGlow:'rgba(124,58,237,0.45)',
}

// ── Orb ring definitions ──────────────────────────
// speed: radians per second  |  pc: particle count
export const ORB_RINGS = [
  { rxR: 1.00, ryR: 0.28, speed:  0.50, color: '#a78bfa', opacity: 0.75, lw: 1.5, pc: 15 },
  { rxR: 0.88, ryR: 0.88, speed: -0.30, color: '#7c3aed', opacity: 0.45, lw: 1.2, pc: 10 },
  { rxR: 1.06, ryR: 0.22, speed:  0.80, color: '#c4b5fd', opacity: 0.40, lw: 1.0, pc: 12 },
  { rxR: 0.75, ryR: 0.38, speed: -0.60, color: '#6d28d9', opacity: 0.32, lw: 1.5, pc:  8 },
  { rxR: 1.16, ryR: 0.15, speed:  0.35, color: '#a78bfa', opacity: 0.22, lw: 0.8, pc:  6 },
]

// ── Navigation items ──────────────────────────────
export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',  icon: 'grid' },
  { id: 'systems',   label: 'Systems',    icon: 'cpu' },
  { id: 'tasks',     label: 'Tasks',      icon: 'check-square' },
  { id: 'memory',    label: 'Memory',     icon: 'database' },
  { id: 'network',   label: 'Network',    icon: 'globe' },
  { id: 'updates',   label: 'Updates',    icon: 'refresh-cw' },
  { id: 'settings',  label: 'Settings',   icon: 'settings' },
]

// ── Mock data ─────────────────────────────────────
export const MOCK_TASKS = [
  { id: 1, name: 'Market Analysis',    status: 'IN PROGRESS' },
  { id: 2, name: 'Content Generation', status: 'IN PROGRESS' },
  { id: 3, name: 'Email Automation',   status: 'SCHEDULED' },
  { id: 4, name: 'Social Media Sync',  status: 'IN PROGRESS' },
  { id: 5, name: 'Financial Report',   status: 'PENDING' },
]

export const MOCK_REMINDERS = [
  { id: 1, name: 'Client Meeting',      date: 'Tomorrow 10:00 AM' },
  { id: 2, name: 'Product Launch',      date: 'June 2, 2025' },
  { id: 3, name: 'Subscription Renewal',date: 'June 5, 2025' },
]

export const MOCK_EVENTS = [
  { id: 1, name: 'Team Sync',        date: 'May 29  09:00 AM' },
  { id: 2, name: 'Project Deadline', date: 'May 30  11:59 PM' },
  { id: 3, name: 'Strategy Call',    date: 'June 1  03:00 PM' },
]

export const MOCK_SYSTEM = {
  cpu:     78,
  memory:  62,
  disk:    91,
  network: 33,
}

export const MOCK_INTELLIGENCE = {
  dataPoints:  '1.2M',
  opportunities: 3,
  optimalTime:   '01:30 AM',
}

// ── API base URL ──────────────────────────────────
export const API_URL = 'http://localhost:8000'