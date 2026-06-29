import { useState, useEffect } from 'react'
import { useBreakpoint } from '../hooks/useBreakpoint.js'

export default function Topbar({ sidebarOpen, onToggleSidebar }) {
  const [time, setTime]         = useState('')
  const [date, setDate]         = useState('')
  const [greeting, setGreeting] = useState('')
  const isMobile = useBreakpoint()

  useEffect(() => {
    const update = () => {
      const now  = new Date()
      const h    = String(now.getHours()).padStart(2, '0')
      const m    = String(now.getMinutes()).padStart(2, '0')
      const hour = now.getHours()
      setTime(`${h}:${m}`)
      setDate(now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase())
      setGreeting(hour < 12 ? 'GOOD MORNING' : hour < 17 ? 'GOOD AFTERNOON' : 'GOOD EVENING')
    }
    update()
    const id = setInterval(update, 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: isMobile ? '0 16px' : '0 28px',
      height: 56, flexShrink: 0, position: 'relative', zIndex: 20,
      background: 'rgba(4,5,18,0.72)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(var(--color-primary-rgb),0.18)',
      boxShadow: '0 1px 0 rgba(var(--color-primary-rgb),0.10)',
    }}>

      {/* Left: hamburger (mobile) + NYX logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 10 }}>
        {isMobile && (
          <button
            onClick={onToggleSidebar}
            aria-label="Toggle menu"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: sidebarOpen ? '#C7A6FF' : '#8E86B8',
              padding: '6px 2px',
              display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center',
              transition: 'color 0.2s',
            }}
          >
            <span style={{ display: 'block', width: 18, height: 1.5, background: 'currentColor', borderRadius: 1 }} />
            <span style={{ display: 'block', width: 14, height: 1.5, background: 'currentColor', borderRadius: 1 }} />
            <span style={{ display: 'block', width: 18, height: 1.5, background: 'currentColor', borderRadius: 1 }} />
          </button>
        )}
        {!isMobile && (
          <>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-primary)', boxShadow: '0 0 10px var(--color-primary)' }} />
            <div style={{ width: 48, height: 1, background: 'linear-gradient(90deg, rgba(var(--color-primary-rgb),0.8), transparent)' }} />
          </>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: isMobile ? 16 : 18,
            fontWeight: 700,
            letterSpacing: '0.40em', color: '#C7A6FF',
            textShadow: '0 0 22px rgba(199,166,255,0.55)',
          }}>N Y X</span>
          {!isMobile && (
            <span style={{
              fontFamily: 'Share Tech Mono', fontSize: 8, letterSpacing: '0.22em',
              color: '#5E587A', marginTop: 1,
            }}>QUEEN OF THE NIGHT</span>
          )}
        </div>
      </div>

      {/* Center greeting — desktop only */}
      {!isMobile && (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: 'Rajdhani, sans-serif', fontSize: 14, fontWeight: 500,
            letterSpacing: '0.18em', color: '#B9A6FF',
            textShadow: '0 0 14px rgba(185,166,255,0.40)',
          }}>
            {greeting}, MASTER.
          </div>
          <div style={{
            fontFamily: 'Share Tech Mono', fontSize: 9, letterSpacing: '0.12em',
            color: '#5E587A', marginTop: 2,
          }}>
            WHAT SHALL WE CONQUER TONIGHT?
          </div>
        </div>
      )}

      {/* Right clock */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14 }}>
        {!isMobile && (
          <div style={{ width: 48, height: 1, background: 'linear-gradient(270deg, rgba(var(--color-primary-rgb),0.8), transparent)' }} />
        )}
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          border: '1px solid rgba(var(--color-primary-rgb),0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, background: 'rgba(var(--color-primary-rgb),0.10)',
          boxShadow: '0 0 12px rgba(var(--color-primary-rgb),0.25)',
        }}>🌙</div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: 'Share Tech Mono',
            fontSize: isMobile ? 17 : 21,
            color: '#EDE8FF',
            textShadow: '0 0 14px rgba(199,166,255,0.45)', lineHeight: 1,
          }}>{time}</div>
          {!isMobile && (
            <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: '#5E587A', marginTop: 2, letterSpacing: '0.06em' }}>
              {date}
            </div>
          )}
        </div>
        {!isMobile && (
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-primary)', boxShadow: '0 0 10px var(--color-primary)' }} />
        )}
      </div>
    </header>
  )
}
