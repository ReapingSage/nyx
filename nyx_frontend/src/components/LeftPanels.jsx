import { useState, useEffect } from 'react'
import { MOCK_TASKS, MOCK_REMINDERS, MOCK_SYSTEM } from '../utils/constants.js'
import { getSystemStats } from '../services/api.js'

const STATUS_COLOR = {
  'IN PROGRESS': '#A874FF',
  'SCHEDULED':   '#4D8DFF',
  'PENDING':     '#5E587A',
  'DONE':        '#22c55e',
}

function CircularMeter({ label, value, color = '#8F5CFF', size = 56 }) {
  const r    = (size / 2) - 5
  const circ = 2 * Math.PI * r
  const off  = circ - (value / 100) * circ

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 11 }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r}
            fill="none" stroke="rgba(90,65,180,0.18)" strokeWidth="2.5" />
          <circle cx={size/2} cy={size/2} r={r}
            fill="none" stroke={color} strokeWidth="2.5"
            strokeDasharray={circ} strokeDashoffset={off}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 5px ${color})`, transition: 'stroke-dashoffset 1.2s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--color-accent)', fontWeight: 600,
        }}>{value}%</div>
      </div>
      <span style={{
        fontFamily: 'Rajdhani, sans-serif', fontSize: 10, fontWeight: 600,
        letterSpacing: '0.18em', color: 'var(--color-text-muted)', textTransform: 'uppercase', flex: 1,
      }}>{label}</span>
    </div>
  )
}

const PANEL_STYLE = {
  background: 'var(--color-surface)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(var(--color-primary-rgb),0.20)',
  borderRadius: 18,
  padding: '14px 16px',
  marginBottom: 11,
  boxShadow: '0 0 28px rgba(var(--color-primary-rgb),0.10), inset 0 0 18px rgba(var(--color-primary-rgb),0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
}

const TITLE_STYLE = {
  fontFamily: 'Rajdhani, sans-serif',
  fontSize: 10, fontWeight: 600,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
  display: 'block',
  marginBottom: 12,
}

export default function LeftPanels({ visible }) {
  const [stats, setStats] = useState(MOCK_SYSTEM)

  useEffect(() => {
    const load = async () => {
      try {
        const d = await getSystemStats()
        if (d.cpu) setStats({
          cpu: d.cpu.usage, memory: d.memory.usage,
          disk: d.disk.usage, network: Math.min(99, d.network?.bytes_recv_mb || 33),
        })
      } catch {}
    }
    load()
    const id = setInterval(load, 6000)
    return () => clearInterval(id)
  }, [])

  if (!visible) return null

  return (
    <div style={{
      width: 260, flexShrink: 0,
      padding: '14px 12px',
      overflowY: 'auto', overflowX: 'hidden',
    }}>

      {/* System Overview */}
      <div style={PANEL_STYLE} className="panel-anim">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={TITLE_STYLE}>System Overview</span>
          <span style={{ color: 'var(--color-text-disabled)', fontSize: 11, cursor: 'pointer' }}>×</span>
        </div>
        <CircularMeter label="CPU Usage"   value={stats.cpu}     color="#8F5CFF" />
        <CircularMeter label="Memory"      value={stats.memory}  color="#4D8DFF" />
        <CircularMeter label="Disk Space"  value={stats.disk}    color="#B96CFF" />
        <CircularMeter label="Network"     value={stats.network} color="#7AA7FF" />
      </div>

      {/* Active Tasks */}
      <div style={PANEL_STYLE} className="panel-anim">
        <span style={TITLE_STYLE}>Active Tasks</span>
        {MOCK_TASKS.map(task => (
          <div key={task.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '7px 0',
            borderBottom: '1px solid rgba(100,75,200,0.10)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                border: '1px solid rgba(140,100,255,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_COLOR[task.status] || '#5E587A' }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{task.name}</span>
            </div>
            <span style={{
              fontFamily: 'Share Tech Mono', fontSize: 8,
              color: STATUS_COLOR[task.status] || '#5E587A',
              letterSpacing: '0.06em',
            }}>{task.status}</span>
          </div>
        ))}
      </div>

      {/* Reminders */}
      <div style={PANEL_STYLE} className="panel-anim">
        <span style={TITLE_STYLE}>Reminders</span>
        {MOCK_REMINDERS.map(r => (
          <div key={r.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
            borderBottom: '1px solid rgba(100,75,200,0.10)',
          }}>
            <div style={{
              width: 12, height: 12, borderRadius: '50%',
              border: '1px solid rgba(140,100,255,0.30)', flexShrink: 0,
            }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{r.name}</div>
              <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'var(--color-text-disabled)', marginTop: 1 }}>{r.date}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
