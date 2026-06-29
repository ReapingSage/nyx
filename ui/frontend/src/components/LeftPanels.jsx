import { useState, useEffect } from 'react'
import { MOCK_TASKS, MOCK_REMINDERS, MOCK_SYSTEM } from '../utils/constants.js'
import { getSystemStats } from '../services/api.js'

const STATUS_COLORS = {
  'IN PROGRESS': '#a78bfa',
  'SCHEDULED':   '#22d3ee',
  'PENDING':     '#4a4680',
  'DONE':        '#22c55e',
}

function StatRow({ label, value, pct }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: '#8b85cc', letterSpacing: '0.06em' }}>{label}</span>
        <span style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: '#a78bfa', fontWeight: 600 }}>{value}%</span>
      </div>
      <div className="stat-bar">
        <div className="stat-fill" style={{ width: `${pct}%` }}/>
      </div>
    </div>
  )
}

export default function LeftPanels({ visible }) {
  const [stats, setStats] = useState(MOCK_SYSTEM)

  useEffect(() => {
    const load = async () => {
      try {
        const d = await getSystemStats()
        if (d.cpu) setStats({ cpu: d.cpu.usage, memory: d.memory.usage, disk: d.disk.usage, network: d.network?.bytes_recv_mb || 33 })
      } catch {}
    }
    load()
    const id = setInterval(load, 6000)
    return () => clearInterval(id)
  }, [])

  if (!visible) return null

  return (
    <div
      style={{
        width: 270,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '16px 12px',
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      {/* System Overview */}
      <div className="glass" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span className="panel-title">System Overview</span>
          <span style={{ color: '#4a4680', cursor: 'pointer', fontSize: 12 }}>×</span>
        </div>
        <StatRow label="CPU USAGE"  value={stats.cpu}     pct={stats.cpu} />
        <StatRow label="MEMORY"     value={stats.memory}  pct={stats.memory} />
        <StatRow label="DISK SPACE" value={stats.disk}    pct={stats.disk} />
        <StatRow label="NETWORK"    value={stats.network} pct={stats.network} />
      </div>

      {/* Active Tasks */}
      <div className="glass" style={{ padding: '14px 16px' }}>
        <span className="panel-title" style={{ display: 'block', marginBottom: 10 }}>Active Tasks</span>
        {MOCK_TASKS.map(task => (
          <div
            key={task.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 0',
              borderBottom: '1px solid rgba(124,58,237,0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid #4a4680', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_COLORS[task.status] || '#4a4680' }}/>
              </div>
              <span style={{ fontSize: 11, color: '#8b85cc' }}>{task.name}</span>
            </div>
            <span style={{ fontFamily: 'Share Tech Mono', fontSize: 8, color: STATUS_COLORS[task.status] || '#4a4680', letterSpacing: '0.06em' }}>
              {task.status}
            </span>
          </div>
        ))}
      </div>

      {/* Reminders */}
      <div className="glass" style={{ padding: '14px 16px' }}>
        <span className="panel-title" style={{ display: 'block', marginBottom: 10 }}>Reminders</span>
        {MOCK_REMINDERS.map(r => (
          <div
            key={r.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 0',
              borderBottom: '1px solid rgba(124,58,237,0.08)',
            }}
          >
            <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid #4a4680', flexShrink: 0 }}/>
            <div>
              <div style={{ fontSize: 11, color: '#8b85cc' }}>{r.name}</div>
              <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: '#4a4680', marginTop: 1 }}>{r.date}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}