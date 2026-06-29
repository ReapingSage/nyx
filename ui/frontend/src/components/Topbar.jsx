import { useState, useEffect } from 'react'

export default function Topbar() {
  const [time, setTime]         = useState('')
  const [date, setDate]         = useState('')
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    const update = () => {
      const now  = new Date()
      const h    = String(now.getHours()).padStart(2, '0')
      const m    = String(now.getMinutes()).padStart(2, '0')
      const hour = now.getHours()

      setTime(`${h}:${m}`)
      setDate(now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase())

      if (hour < 12)      setGreeting('GOOD MORNING, MASTER.')
      else if (hour < 17) setGreeting('GOOD AFTERNOON, MASTER.')
      else                setGreeting('GOOD EVENING, MASTER.')
    }
    update()
    const id = setInterval(update, 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        height: 58,
        background: 'rgba(8,8,20,0.88)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(124,58,237,0.14)',
        zIndex: 20,
        flexShrink: 0,
      }}
    >
      {/* Left — decorative corner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', boxShadow: '0 0 8px #7c3aed' }}/>
        <div style={{ width: 40, height: 1, background: 'linear-gradient(90deg, #7c3aed, transparent)' }}/>
      </div>

      {/* Center — greeting */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: 'Rajdhani, sans-serif',
          fontSize: 15,
          fontWeight: 500,
          letterSpacing: '0.2em',
          color: '#a78bfa',
          textShadow: '0 0 15px rgba(167,139,250,0.4)',
        }}>
          {greeting}
        </div>
        <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: '#4a4680', letterSpacing: '0.1em', marginTop: 1 }}>
          WHAT SHALL WE CONQUER TONIGHT?
        </div>
      </div>

      {/* Right — clock */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 1, background: 'linear-gradient(270deg, #7c3aed, transparent)' }}/>
        <div style={{
          width: 34, height: 34,
          borderRadius: '50%',
          border: '1px solid rgba(124,58,237,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
          background: 'rgba(124,58,237,0.08)',
          boxShadow: '0 0 10px rgba(124,58,237,0.2)',
        }}>
          🌙
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: 'Share Tech Mono',
            fontSize: 22,
            color: '#ffffff',
            textShadow: '0 0 12px rgba(167,139,250,0.4)',
            lineHeight: 1,
          }}>
            {time}
          </div>
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: '#4a4680', marginTop: 2, letterSpacing: '0.05em' }}>
            {date}
          </div>
        </div>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', boxShadow: '0 0 8px #7c3aed' }}/>
      </div>
    </header>
  )
}