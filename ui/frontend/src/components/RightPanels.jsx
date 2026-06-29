import { MOCK_EVENTS, MOCK_INTELLIGENCE } from '../utils/constants.js'

function WorldMapSVG() {
  return (
    <div
      style={{
        width: '100%',
        height: 100,
        background: 'rgba(8,8,24,0.8)',
        borderRadius: 8,
        border: '1px solid rgba(124,58,237,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: 10,
      }}
    >
      {/* Minimal world map dots */}
      <svg viewBox="0 0 320 100" style={{ width: '100%', height: '100%', opacity: 0.5 }}>
        {/* Simplified continent shapes */}
        <ellipse cx="80"  cy="45" rx="28" ry="20" fill="rgba(124,58,237,0.3)" stroke="rgba(167,139,250,0.4)" strokeWidth="0.5"/>
        <ellipse cx="155" cy="40" rx="40" ry="25" fill="rgba(124,58,237,0.3)" stroke="rgba(167,139,250,0.4)" strokeWidth="0.5"/>
        <ellipse cx="155" cy="70" rx="15" ry="12" fill="rgba(124,58,237,0.25)" stroke="rgba(167,139,250,0.3)" strokeWidth="0.5"/>
        <ellipse cx="240" cy="40" rx="30" ry="18" fill="rgba(124,58,237,0.3)" stroke="rgba(167,139,250,0.4)" strokeWidth="0.5"/>
        <ellipse cx="260" cy="65" rx="15" ry="15" fill="rgba(124,58,237,0.25)" stroke="rgba(167,139,250,0.3)" strokeWidth="0.5"/>
        {/* Connection nodes */}
        {[[80,45],[155,40],[240,40],[155,70],[260,65]].map(([x,y],i)=>(
          <circle key={i} cx={x} cy={y} r="2" fill="#a78bfa" style={{ filter: 'drop-shadow(0 0 4px #7c3aed)' }}/>
        ))}
        {/* Connection lines */}
        <line x1="80"  y1="45" x2="155" y2="40" stroke="rgba(167,139,250,0.3)" strokeWidth="0.5"/>
        <line x1="155" y1="40" x2="240" y2="40" stroke="rgba(167,139,250,0.3)" strokeWidth="0.5"/>
        <line x1="155" y1="40" x2="155" y2="70" stroke="rgba(167,139,250,0.2)" strokeWidth="0.5"/>
      </svg>
    </div>
  )
}

export default function RightPanels({ visible }) {
  if (!visible) return null

  return (
    <div
      style={{
        width: 280,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '16px 12px',
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      {/* Network Status */}
      <div className="glass" style={{ padding: '14px 16px' }}>
        <span className="panel-title" style={{ display: 'block', marginBottom: 12 }}>Network Status</span>
        <WorldMapSVG />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11 }}>🔒</span>
            <span style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: '#8b85cc', letterSpacing: '0.06em' }}>GLOBAL CONNECTION</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 11 }}>◈</span>
            <span style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: '#22c55e', letterSpacing: '0.06em' }}>SECURE</span>
          </div>
        </div>
      </div>

      {/* Nyx Intelligence */}
      <div className="glass" style={{ padding: '14px 16px' }}>
        <span className="panel-title" style={{ display: 'block', marginBottom: 10 }}>NYX Intelligence</span>
        <div style={{ fontSize: 11, color: '#8b85cc', lineHeight: 1.8 }}>
          <div>Analyzed <span style={{ color: '#a78bfa', fontWeight: 600 }}>{MOCK_INTELLIGENCE.dataPoints}</span> data points.</div>
          <div><span style={{ color: '#a78bfa', fontWeight: 600 }}>{MOCK_INTELLIGENCE.opportunities}</span> opportunities detected.</div>
          <div style={{ marginTop: 2 }}>
            Optimal time to act:
            <span style={{ color: '#a78bfa', fontFamily: 'Share Tech Mono', fontSize: 10, marginLeft: 4 }}>
              {MOCK_INTELLIGENCE.optimalTime}
            </span>
          </div>
        </div>
        <button
          style={{
            marginTop: 10,
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: 11,
            letterSpacing: '0.12em',
            color: '#7c3aed',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            textTransform: 'uppercase',
          }}
          onMouseEnter={e => e.target.style.color = '#a78bfa'}
          onMouseLeave={e => e.target.style.color = '#7c3aed'}
        >
          View Insights →
        </button>
      </div>

      {/* Upcoming Events */}
      <div className="glass" style={{ padding: '14px 16px' }}>
        <span className="panel-title" style={{ display: 'block', marginBottom: 10 }}>Upcoming Events</span>
        {MOCK_EVENTS.map(ev => (
          <div
            key={ev.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '7px 0',
              borderBottom: '1px solid rgba(124,58,237,0.08)',
            }}
          >
            <div style={{
              width: 28, height: 28,
              borderRadius: 6,
              border: '1px solid rgba(124,58,237,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, flexShrink: 0,
            }}>
              📅
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#e2e0ff' }}>{ev.name}</div>
              <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: '#4a4680', marginTop: 1 }}>{ev.date}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tool Activity placeholder */}
      <div className="glass" style={{ padding: '14px 16px' }}>
        <span className="panel-title" style={{ display: 'block', marginBottom: 8 }}>Tool Activity</span>
        <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: '#4a4680', fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>
          OpenClaw — Phase 7
        </div>
      </div>
    </div>
  )
}