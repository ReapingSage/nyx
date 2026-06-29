import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Background   from './components/Background.jsx'
import Topbar       from './components/Topbar.jsx'
import Sidebar      from './components/Sidebar.jsx'
import NyxOrb       from './components/NyxOrb.jsx'
import LeftPanels   from './components/LeftPanels.jsx'
import RightPanels  from './components/RightPanels.jsx'
import NyxChat  from './components/NyxChat.jsx'

// ── Layout constants ──────────────────────────────
const TOPBAR_H   = 58
const SIDEBAR_W  = 180
const ORB_CANVAS = 440   // canvas stays this size always — scale changes visual size
const ORB_CHAT   = 96    // visual size when docked in chat mode
const SCALE_CHAT = ORB_CHAT / ORB_CANVAS   // ≈ 0.218

export default function App() {
  const [chatMode,   setChatMode]   = useState(false)
  const [orbState,   setOrbState]   = useState('idle')   // 'idle' | 'thinking' | 'speaking'
  const [activePage, setActivePage] = useState('dashboard')
  const [win,        setWin]        = useState({ w: window.innerWidth, h: window.innerHeight })

  // Track window size for orb positioning
  useEffect(() => {
    const handler = () => setWin({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const { w, h } = win

  // ── Orb position calculations ─────────────────────
  // Core mode: centered in main content area (right of sidebar, below topbar)
  const mainW  = w - SIDEBAR_W
  const mainH  = h - TOPBAR_H
  const coreL  = SIDEBAR_W + mainW / 2 - ORB_CANVAS / 2
  const coreT  = TOPBAR_H  + mainH / 2 - ORB_CANVAS / 2 - 50  // shift up slightly for controls below

  // Chat mode: bottom-right corner. Account for scale so visual edge lands at 28px from edges.
  // When scaled by SCALE_CHAT, the 440px div appears as 96px.
  // We want the visual center at (w - 28 - 48, h - 28 - 48)
  const chatL  = w - ORB_CHAT / 2 - 28 - ORB_CANVAS / 2
  const chatT  = h - ORB_CHAT / 2 - 28 - ORB_CANVAS / 2

  // ── Mode transitions ─────────────────────────────
  const enterChat = useCallback(() => {
    setOrbState('thinking')
    setTimeout(() => { setChatMode(true); setOrbState('idle') }, 400)
  }, [])

  const exitChat = useCallback(() => {
    setChatMode(false)
    setOrbState('idle')
  }, [])

  const handleNav = useCallback((page) => {
    setActivePage(page)
    if (chatMode) exitChat()
  }, [chatMode, exitChat])

  const handleOrbState = useCallback((s) => setOrbState(s), [])

  return (
    <div style={{ height: '100vh', overflow: 'hidden', position: 'relative', background: '#05050f' }}>

      {/* Cinematic background */}
      <Background />

      {/* UI layer */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100vh' }}>

        <Topbar />

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          <Sidebar activePage={activePage} onNavigate={handleNav} />

          {/* ── MAIN CONTENT ── */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

            {/* CORE MODE — dashboard layout */}
            <AnimatePresence>
              {!chatMode && (
                <motion.div
                  key="core-mode"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45 }}
                  style={{ display: 'flex', height: '100%', overflow: 'hidden' }}
                >
                  <LeftPanels visible />

                  {/* Center column */}
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 0,
                      paddingBottom: 24,
                      position: 'relative',
                    }}
                  >
                    {/* Invisible orb placeholder — orb renders in fixed overlay */}
                    <div style={{ width: ORB_CANVAS, height: ORB_CANVAS, flexShrink: 0 }} />

                    {/* Control buttons */}
                    <ControlButtons onActivate={enterChat} />

                    {/* Status text */}
                    <StatusText />

                    {/* Static waveform visualization */}
                    <StaticWaveform />

                    {/* Command input */}
                    <CommandInput onSubmit={enterChat} />
                  </div>

                  <RightPanels visible />
                </motion.div>
              )}
            </AnimatePresence>

            {/* CHAT MODE overlay */}
            <NyxChat
              visible={chatMode}
              onOrbStateChange={handleOrbState}
            />

            {/* Return to core button — chat mode only */}
            <AnimatePresence>
              {chatMode && (
                <motion.button
                  key="exit-btn"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, delay: 0.6 }}
                  onClick={exitChat}
                  style={{
                    position: 'fixed',
                    top: TOPBAR_H + 16,
                    left: SIDEBAR_W + 20,
                    zIndex: 500,
                    background: 'rgba(11,11,26,0.85)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(124,58,237,0.3)',
                    borderRadius: 8,
                    padding: '7px 16px',
                    fontFamily: 'Rajdhani, sans-serif',
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '0.15em',
                    color: '#a78bfa',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                  }}
                >
                  ← Core Mode
                </motion.button>
              )}
            </AnimatePresence>

          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          THE NYX ORB — always rendered, always alive.
          Transitions between core (large, center) and
          chat (small, bottom-right) using spring physics.
      ══════════════════════════════════════════════ */}
      <motion.div
        initial={false}
        animate={{
          left:  chatMode ? chatL : coreL,
          top:   chatMode ? chatT : coreT,
          scale: chatMode ? SCALE_CHAT : 1,
        }}
        transition={{
          type: 'spring',
          damping: 28,
          stiffness: 85,
          mass: 1.1,
        }}
        style={{
          position: 'fixed',
          width: ORB_CANVAS,
          height: ORB_CANVAS,
          zIndex: 200,
          transformOrigin: 'center center',
          pointerEvents: chatMode ? 'none' : 'auto',
          cursor: chatMode ? 'default' : 'pointer',
        }}
        onClick={!chatMode ? enterChat : undefined}
      >
        <NyxOrb size={ORB_CANVAS} state={orbState} chatMode={chatMode} />

        {/* Text overlay — core mode only */}
        <AnimatePresence>
          {!chatMode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                position: 'absolute',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                pointerEvents: 'none',
                zIndex: 10,
                userSelect: 'none',
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 8, filter: 'drop-shadow(0 0 10px rgba(167,139,250,0.8))' }}>
                ♛
              </div>
              <div style={{
                fontFamily: 'Rajdhani, sans-serif',
                fontSize: 32,
                fontWeight: 700,
                letterSpacing: '0.45em',
                color: '#ffffff',
                textShadow: '0 0 30px rgba(167,139,250,0.9), 0 0 60px rgba(124,58,237,0.5)',
                lineHeight: 1,
                paddingLeft: '0.45em', // compensate letter-spacing centering
              }}>
                N Y X
              </div>
              <div style={{
                fontFamily: 'Share Tech Mono',
                fontSize: 8,
                letterSpacing: '0.28em',
                color: '#a78bfa',
                marginTop: 7,
                opacity: 0.75,
                paddingLeft: '0.28em',
              }}>
                QUEEN OF THE NIGHT
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

    </div>
  )
}

// ── Sub-components ────────────────────────────────

function ControlButtons({ onActivate }) {
  const btns = [
    { emoji: '🎤', label: 'Voice — Phase 4' },
    { emoji: '⌨',  label: 'Command' },
    { emoji: '≋',  label: 'Waveform' },
    { emoji: '⋮⋮', label: 'Grid' },
  ]
  return (
    <div style={{ display: 'flex', gap: 18, marginTop: 18 }}>
      {btns.map(b => (
        <div
          key={b.label}
          title={b.label}
          onClick={onActivate}
          style={{
            width: 50, height: 50,
            borderRadius: '50%',
            border: '1px solid rgba(124,58,237,0.4)',
            background: 'rgba(11,11,26,0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
            cursor: 'pointer',
            boxShadow: '0 0 14px rgba(124,58,237,0.12)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'rgba(167,139,250,0.7)'
            e.currentTarget.style.boxShadow   = '0 0 20px rgba(124,58,237,0.3)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'
            e.currentTarget.style.boxShadow   = '0 0 14px rgba(124,58,237,0.12)'
          }}
        >
          {b.emoji}
        </div>
      ))}
    </div>
  )
}

function StatusText() {
  return (
    <div style={{
      marginTop: 16,
      fontFamily: 'Share Tech Mono',
      fontSize: 11,
      color: '#8b85cc',
      letterSpacing: '0.22em',
    }}>
      LISTENING...
    </div>
  )
}

function StaticWaveform() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 10, height: 24 }}>
      {Array.from({ length: 28 }, (_, i) => {
        const h = 3 + Math.abs(Math.sin(i * 0.7) * 14 + Math.cos(i * 1.3) * 6)
        return (
          <div
            key={i}
            style={{
              width: 2,
              height: h,
              background: `rgba(167,139,250,${0.2 + Math.abs(Math.sin(i * 0.5)) * 0.35})`,
              borderRadius: 1,
            }}
          />
        )
      })}
    </div>
  )
}

function CommandInput({ onSubmit }) {
  const [val, setVal] = useState('')

  const handleKey = (e) => {
    if (e.key === 'Enter' && val.trim()) onSubmit()
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'rgba(11,11,26,0.75)',
          backdropFilter: 'blur(14px)',
          border: '1px solid rgba(124,58,237,0.28)',
          borderRadius: 10,
          padding: '12px 18px',
          width: 380,
          boxShadow: '0 0 24px rgba(124,58,237,0.08)',
          transition: 'border-color 0.3s, box-shadow 0.3s',
        }}
        onFocus={() => {}}
      >
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.2em',
            color: '#4a4680',
            marginBottom: 4,
          }}>
            COMMAND NYX
          </div>
          <input
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Enter your command..."
            onClick={e => e.stopPropagation()}
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              fontFamily: 'Exo 2, sans-serif',
              fontSize: 13,
              color: '#e2e0ff',
              width: '100%',
            }}
          />
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onSubmit() }}
          style={{
            width: 32, height: 32,
            borderRadius: '50%',
            background: 'rgba(124,58,237,0.2)',
            border: '1px solid rgba(124,58,237,0.5)',
            color: '#a78bfa',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.4)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(124,58,237,0.2)'}
        >
          →
        </button>
      </div>
    </div>
  )
}