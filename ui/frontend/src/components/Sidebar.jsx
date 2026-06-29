import { NAV_ITEMS } from '../utils/constants.js'

const ICONS = {
  grid: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  cpu: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
      <rect x="4" y="4" width="16" height="16" rx="2"/>
      <rect x="9" y="9" width="6" height="6"/>
      <line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/>
      <line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/>
      <line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/>
      <line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>
    </svg>
  ),
  'check-square': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>
  ),
  database: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
    </svg>
  ),
  'refresh-cw': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
      <polyline points="23 4 23 10 17 10"/>
      <polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  ),
}

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <nav
      className="flex flex-col h-full py-5"
      style={{
        width: 180,
        background: 'rgba(8,8,20,0.85)',
        backdropFilter: 'blur(16px)',
        borderRight: '1px solid rgba(124,58,237,0.14)',
        zIndex: 10,
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <div className="px-5 mb-8">
        <div
          style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '0.3em',
            color: '#a78bfa',
            textShadow: '0 0 20px rgba(167,139,250,0.5)',
          }}
        >
          N Y X
        </div>
        <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, letterSpacing: '0.18em', color: '#4a4680', marginTop: 2 }}>
          QUEEN OF THE NIGHT
        </div>
      </div>

      {/* Nav items */}
      <div className="flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map(item => {
          const active = activePage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 20px',
                background: active ? 'rgba(124,58,237,0.14)' : 'transparent',
                borderLeft: `2px solid ${active ? '#a78bfa' : 'transparent'}`,
                border: 'none',
                borderLeftWidth: 2,
                borderLeftStyle: 'solid',
                borderLeftColor: active ? '#a78bfa' : 'transparent',
                cursor: 'pointer',
                color: active ? '#a78bfa' : '#8b85cc',
                transition: 'all 0.2s ease',
                width: '100%',
                textAlign: 'left',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#a78bfa'; e.currentTarget.style.background = 'rgba(124,58,237,0.07)' }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#8b85cc'; e.currentTarget.style.background = 'transparent' }}}
            >
              <span style={{ opacity: active ? 1 : 0.65 }}>{ICONS[item.icon]}</span>
              <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 13, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div
        className="mx-4 mt-4 pt-4 text-center"
        style={{ borderTop: '1px solid rgba(124,58,237,0.15)' }}
      >
        <div style={{ fontSize: 22, filter: 'drop-shadow(0 0 8px rgba(167,139,250,0.6))' }}>♛</div>
        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 11, letterSpacing: '0.15em', color: '#a78bfa', marginTop: 4 }}>
          NYX CORE
        </div>
        <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: '#4a4680', marginTop: 2 }}>
          <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e', marginRight: 5, verticalAlign: 'middle' }}/>
          v1.0.0
        </div>
      </div>
    </nav>
  )
}