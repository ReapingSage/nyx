import { useBreakpoint } from '../hooks/useBreakpoint.js'
import { NAV_ITEMS } from '../utils/constants.js'

const ICONS = {
  grid: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
  </svg>,
  cpu: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
    <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/>
    <line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/>
    <line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/>
    <line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/>
    <line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>
  </svg>,
  'check-square': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
    <polyline points="9 11 12 14 22 4"/>
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
  </svg>,
  database: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
    <ellipse cx="12" cy="5" rx="9" ry="3"/>
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
  </svg>,
  globe: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
  </svg>,
  'refresh-cw': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
  </svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>,
  box: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>,
}

function NavItems({ activePage, onNavigate }) {
  return (
    <div style={{ flex: 1, padding: '18px 0', overflowY: 'auto' }}>
      {NAV_ITEMS.map(item => {
        const active = activePage === item.id
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '12px 20px',
              background: active
                ? 'linear-gradient(90deg, rgba(var(--color-primary-rgb),0.22), rgba(var(--color-primary-rgb),0.05))'
                : 'transparent',
              border: 'none',
              borderLeft: `2px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
              cursor: 'pointer',
              color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
              transition: 'all 0.22s ease',
              boxShadow: active ? '0 0 8px rgba(var(--color-primary-rgb),0.08) inset' : 'none',
              animation: active ? 'navGlow 2.5s ease-in-out infinite' : 'none',
            }}
            onMouseEnter={e => {
              if (!active) {
                e.currentTarget.style.background = 'rgba(var(--color-primary-rgb),0.09)'
                e.currentTarget.style.color = 'var(--color-text-secondary)'
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--color-text-muted)'
              }
            }}
          >
            <span style={{ opacity: active ? 1 : 0.6 }}>{ICONS[item.icon]}</span>
            <span style={{
              fontFamily: 'Rajdhani, sans-serif', fontSize: 13, fontWeight: 600,
              letterSpacing: '0.14em', textTransform: 'uppercase',
            }}>
              {item.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function SidebarFooter() {
  return (
    <div style={{
      padding: '16px 0 20px',
      borderTop: '1px solid rgba(100,70,200,0.14)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
    }}>
      <div style={{ fontSize: 20, filter: 'drop-shadow(0 0 8px rgba(199,166,255,0.7))' }}>♛</div>
      <div style={{
        fontFamily: 'Rajdhani, sans-serif', fontSize: 11, fontWeight: 600,
        letterSpacing: '0.18em', color: '#B9A6FF',
      }}>NYX CORE</div>
      <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: '#5E587A', display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', display: 'inline-block', animation: 'statusBlink 2.5s infinite' }} />
        v2.7.1
      </div>
    </div>
  )
}

export default function Sidebar({ activePage, onNavigate, sidebarOpen, onCloseSidebar }) {
  const isMobile = useBreakpoint()

  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        <div
          onClick={onCloseSidebar}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 290,
            opacity: sidebarOpen ? 1 : 0,
            pointerEvents: sidebarOpen ? 'auto' : 'none',
            transition: 'opacity 0.3s ease',
          }}
        />

        {/* Drawer */}
        <nav style={{
          position: 'fixed',
          top: 0,
          left: sidebarOpen ? 0 : -210,
          width: 200,
          height: '100%',
          zIndex: 300,
          transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          background: 'rgba(4,5,18,0.97)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRight: '1px solid rgba(var(--color-primary-rgb),0.22)',
          boxShadow: sidebarOpen ? '4px 0 40px rgba(100,60,220,0.25)' : 'none',
          display: 'flex', flexDirection: 'column',
          paddingTop: 56,
        }}>
          <NavItems activePage={activePage} onNavigate={onNavigate} />
          <SidebarFooter />
        </nav>
      </>
    )
  }

  return (
    <nav style={{
      width: 190, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      height: '100%',
      background: 'rgba(4,5,18,0.65)',
      backdropFilter: 'blur(22px)',
      borderRight: '1px solid rgba(var(--color-primary-rgb),0.18)',
      boxShadow: '1px 0 0 rgba(100,70,220,0.08)',
      zIndex: 10, position: 'relative',
    }}>
      <NavItems activePage={activePage} onNavigate={onNavigate} />
      <SidebarFooter />
    </nav>
  )
}
