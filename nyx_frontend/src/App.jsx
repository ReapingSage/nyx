import { useState, useEffect, useCallback, useRef } from 'react'
import { VOICE_STATUS } from './hooks/useVoice.js'
import { useBreakpoint } from './hooks/useBreakpoint.js'
import { motion, AnimatePresence } from 'framer-motion'
import Background   from './components/Background.jsx'
import Topbar       from './components/Topbar.jsx'
import Sidebar      from './components/Sidebar.jsx'
import NyxOrb       from './components/NyxOrb.jsx'
import NyxIdleOrb   from './components/NyxIdleOrb.jsx'
import LeftPanels   from './components/LeftPanels.jsx'
import RightPanels  from './components/RightPanels.jsx'
import NyxChat              from './components/NyxChat.jsx'
import MemoryConstellation  from './components/MemoryConstellation.jsx'
import NetworkPage          from './components/NetworkPage.jsx'
import GlobalView           from './components/GlobalView.jsx'
import SettingsPage         from './components/SettingsPage.jsx'
import SystemsPage          from './components/SystemsPage.jsx'
import TasksPage            from './components/TasksPage.jsx'
import UpdatesPage          from './components/UpdatesPage.jsx'
import { useTheme, NYX_PURPLE_FREEZE } from './utils/themeContext.jsx'

// ── Layout constants ──────────────────────────────
const TOPBAR_H   = 56
const SIDEBAR_W  = 190
const ORB_CANVAS = 580   // canvas stays this size always — scale changes visual size
const ORB_CHAT   = 96    // visual size when docked in chat mode (desktop)
const ORB_CHAT_M = 72    // visual size when docked in chat mode (mobile)
const ORB_M      = 280   // visual orb size on mobile (core mode)

const IDLE_TIMEOUT_MS = 10 * 60 * 1000  // 10 minutes → return to idle screen

export default function App() {
  const { visualPrefs } = useTheme()
  const [idleScreen,   setIdleScreen]   = useState(true)   // fullscreen eclipse on open
  const [chatMode,     setChatMode]     = useState(false)
  const [orbState,     setOrbState]     = useState('idle')
  const [activePage,   setActivePage]   = useState('dashboard')
  const [win,          setWin]          = useState({ w: window.innerWidth, h: window.innerHeight })
  const [voiceStatus,  setVoiceStatus]  = useState('IDLE')
  const [sidebarOpen,  setSidebarOpen]  = useState(false)
  const voiceCtrlRef  = useRef(null)
  const idleTimerRef  = useRef(null)
  const isMobile = useBreakpoint()

  // ── Idle screen management ────────────────────────
  const exitIdleScreen = useCallback(() => {
    setIdleScreen(false)
    resetIdleTimer()
  }, [])

  const returnToIdleScreen = useCallback(() => {
    setIdleScreen(true)
    setChatMode(false)
    setOrbState('idle')
    setActivePage('dashboard')
  }, [])

  function resetIdleTimer() {
    clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(returnToIdleScreen, IDLE_TIMEOUT_MS)
  }

  // Reset idle timer on any user activity while in active mode
  useEffect(() => {
    if (idleScreen) return
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart']
    const reset = () => resetIdleTimer()
    events.forEach(e => window.addEventListener(e, reset))
    resetIdleTimer()
    return () => {
      events.forEach(e => window.removeEventListener(e, reset))
      clearTimeout(idleTimerRef.current)
    }
  }, [idleScreen])

  const handleMicToggle = useCallback(() => {
    const isRecording = voiceStatus === VOICE_STATUS.RECORDING || voiceStatus === VOICE_STATUS.WAKE_LISTEN
    if (isRecording) {
      voiceCtrlRef.current?.stopAll()
    } else {
      voiceCtrlRef.current?.listenOnce()
    }
  }, [voiceStatus])

  // Track window size for orb positioning
  useEffect(() => {
    const handler = () => setWin({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Deep-link support — e.g. tray app opens ?page=settings directly
  useEffect(() => {
    const page = new URLSearchParams(window.location.search).get('page')
    if (page) {
      setActivePage(page)
      setIdleScreen(false)
    }
  }, [])

  // Close sidebar when switching to desktop
  useEffect(() => {
    if (!isMobile) setSidebarOpen(false)
  }, [isMobile])

  const { w, h } = win
  const mainH = h - TOPBAR_H

  // ── Orb position calculations ─────────────────────
  // Idle screen: perfectly centered in the full viewport
  const idleL = w / 2 - ORB_CANVAS / 2
  const idleT = h / 2 - ORB_CANVAS / 2

  // Core mode: centered in main content area (accounts for sidebar on desktop)
  const sidebarOffset = isMobile ? 0 : SIDEBAR_W
  const mainW  = isMobile ? w : w - SIDEBAR_W
  const coreL  = sidebarOffset + mainW / 2 - ORB_CANVAS / 2
  const coreT  = TOPBAR_H + mainH / 2 - ORB_CANVAS / 2 - 38

  // Chat mode: bottom-right corner docked, size differs by platform
  const chatOrbVis = isMobile ? ORB_CHAT_M : ORB_CHAT
  const chatPad    = isMobile ? 16 : 28
  const chatL  = w - chatOrbVis / 2 - chatPad - ORB_CANVAS / 2
  const chatT  = h - chatOrbVis / 2 - chatPad - ORB_CANVAS / 2

  // Current scale — 1.0 on desktop core mode, same as before
  const orbScale = chatMode
    ? chatOrbVis / ORB_CANVAS
    : (isMobile && !idleScreen ? ORB_M / ORB_CANVAS : 1)

  // Orb target position — stays in content area, idle overlay handles idle visuals
  const orbL = chatMode ? chatL : coreL
  const orbT = chatMode ? chatT : coreT

  // ── Mode transitions ─────────────────────────────
  const enterChat = useCallback(() => {
    if (idleScreen) { exitIdleScreen(); return }
    setOrbState('thinking')
    setTimeout(() => { setChatMode(true); setOrbState('idle') }, 400)
  }, [idleScreen, exitIdleScreen])

  const exitChat = useCallback(() => {
    setChatMode(false)
    setOrbState('idle')
  }, [])

  const handleNav = useCallback((page) => {
    if (idleScreen) exitIdleScreen()
    setActivePage(page)
    if (chatMode) exitChat()
    if (isMobile) setSidebarOpen(false)
  }, [idleScreen, exitIdleScreen, chatMode, exitChat, isMobile])

  const handleOrbState = useCallback((s) => setOrbState(s), [])

  return (
    <div style={{ height: '100vh', overflow: 'hidden', position: 'relative', background: '#02030A' }}>

      {/* Cinematic background */}
      <Background />

      {/* ── IDLE SCREEN — cinematic eclipse fills viewport ── */}
      <AnimatePresence>
        {idleScreen && (
          <motion.div
            key="idle-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1 }}
            onClick={exitIdleScreen}
            style={{
              position: 'fixed', inset: 0, zIndex: 300,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'flex-end',
              paddingBottom: 52,
              cursor: 'pointer',
              background: '#00000E',
            }}
          >
            {/* Full-viewport eclipse canvas */}
            <NyxIdleOrb w={win.w} h={win.h} state={orbState} />
            {/* Tiny hint at bottom */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4, duration: 0.6 }}
              style={{
                fontFamily: 'Share Tech Mono, monospace',
                fontSize: 10, letterSpacing: '0.32em',
                color: 'rgba(160,120,220,0.45)',
                textTransform: 'uppercase',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            >
              <StatusText voiceStatus={voiceStatus} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* UI layer — fades out while idle screen is active */}
      <div style={{
        position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100vh',
        opacity: idleScreen ? 0 : 1,
        pointerEvents: idleScreen ? 'none' : 'auto',
        transition: 'opacity 0.6s ease',
      }}>

        <Topbar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(o => !o)}
        />

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          <Sidebar
            activePage={activePage}
            onNavigate={handleNav}
            sidebarOpen={sidebarOpen}
            onCloseSidebar={() => setSidebarOpen(false)}
          />

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
                  {activePage === 'memory' ? (
                    <SyncWrap locked={!visualPrefs.syncMemory}>
                      <MemoryConstellation />
                    </SyncWrap>
                  ) : activePage === 'network' ? (
                    <SyncWrap locked={!visualPrefs.syncNetwork}>
                      <NetworkPage activePage={activePage} onNavigate={handleNav} />
                    </SyncWrap>
                  ) : activePage === 'globalview' ? (
                    <SyncWrap locked={!visualPrefs.syncGlobalView}>
                      <GlobalView onClose={() => handleNav('dashboard')} />
                    </SyncWrap>
                  ) : activePage === 'settings' ? (
                    <SettingsPage />
                  ) : activePage === 'systems' ? (
                    <SystemsPage />
                  ) : activePage === 'tasks' ? (
                    <TasksPage />
                  ) : activePage === 'updates' ? (
                    <UpdatesPage />
                  ) : (
                    <>
                      {!isMobile && <LeftPanels visible />}

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
                        <div style={{
                          width:  isMobile ? ORB_M : ORB_CANVAS,
                          height: isMobile ? ORB_M : ORB_CANVAS,
                          flexShrink: 0,
                        }} />

                        {/* Control buttons */}
                        <ControlButtons
                          onActivate={enterChat}
                          onVoiceTrigger={handleMicToggle}
                          voiceActive={voiceStatus !== 'IDLE'}
                        />

                        {/* Status text — shows voice phase when active */}
                        <StatusText voiceStatus={voiceStatus} />

                        {/* Waveform — reacts to voice state */}
                        {!isMobile && <StaticWaveform voiceStatus={voiceStatus} />}

                        {/* Command input */}
                        <CommandInput onSubmit={enterChat} isMobile={isMobile} />
                      </div>

                      {!isMobile && <RightPanels visible onOpenGlobalView={() => handleNav('globalview')} />}
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* CHAT MODE overlay */}
            <NyxChat
              visible={chatMode}
              onOrbStateChange={handleOrbState}
              onVoiceStatus={setVoiceStatus}
              onRegisterVoice={(fns) => { voiceCtrlRef.current = fns }}
              isMobile={isMobile}
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
                    left: isMobile ? 16 : SIDEBAR_W + 20,
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
          Transitions between idle (fullscreen center),
          core (dashboard center), and chat (corner).
      ══════════════════════════════════════════════ */}
      <motion.div
        initial={false}
        animate={{
          left:    orbL,
          top:     orbT,
          scale:   orbScale,
          opacity: idleScreen ? 0 : ((['memory','network','globalview','settings','systems','tasks','updates'].includes(activePage)) ? 0 : 1),
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
          pointerEvents: 'none',
          cursor: 'default',
        }}
      >
        {/* Circular click zone — active mode only (idle overlay handles idle clicks) */}
        {!chatMode && !idleScreen && (
          <div
            onClick={enterChat}
            style={{
              position: 'absolute',
              left: '50%', top: '50%',
              transform: 'translate(-50%, -50%)',
              width: isMobile ? 140 : 180,
              height: isMobile ? 140 : 180,
              borderRadius: '50%',
              cursor: 'pointer',
              pointerEvents: 'auto',
              zIndex: 5,
            }}
          />
        )}
        <NyxOrb size={ORB_CANVAS} state={orbState} chatMode={chatMode} onHover={() => {}} />

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
              <div style={{
                fontSize: 22, marginBottom: 10,
                filter: 'drop-shadow(0 0 14px rgba(220,200,255,0.9))',
                color: '#E9D8FF',
              }}>♛</div>
              <div style={{
                fontFamily: 'Rajdhani, sans-serif',
                fontSize: 38, fontWeight: 700,
                letterSpacing: '0.50em',
                color: '#F3EDFF',
                textShadow: '0 0 32px rgba(220,200,255,0.95), 0 0 70px rgba(140,80,255,0.55)',
                lineHeight: 1,
                paddingLeft: '0.50em',
              }}>N Y X</div>
              <div style={{
                fontFamily: 'Share Tech Mono',
                fontSize: 11, letterSpacing: '0.30em',
                color: '#C7A6FF',
                marginTop: 10, opacity: 0.88,
                paddingLeft: '0.30em',
                textShadow: '0 0 16px rgba(199,166,255,0.60)',
              }}>QUEEN OF THE NIGHT</div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

    </div>
  )
}

// ── SyncWrap — freezes CSS vars to nyx-purple when locked=true ──
function SyncWrap({ locked, children }) {
  return (
    <div style={{
      flex: 1, height: '100%', overflow: 'hidden', position: 'relative',
      ...(locked ? NYX_PURPLE_FREEZE : {}),
    }}>
      {children}
    </div>
  )
}

// ── Sub-components ────────────────────────────────

function ControlButtons({ onActivate, onVoiceTrigger, voiceActive }) {
  const btns = [
    { icon: voiceActive ? '⏹' : '🎤', label: 'Voice', action: onVoiceTrigger, active: voiceActive },
    { icon: '⌨',  label: 'Command',  action: onActivate },
    { icon: '≋',  label: 'Waveform', action: onActivate },
    { icon: '⋮⋮', label: 'Grid',     action: onActivate },
  ]
  return (
    <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
      {btns.map(b => (
        <div
          key={b.label} title={b.label} onClick={b.action}
          style={{
            width: 48, height: 48, borderRadius: '50%',
            border: b.active ? '1px solid rgba(194,155,255,0.75)' : '1px solid rgba(140,100,255,0.32)',
            background: b.active ? 'rgba(100,40,220,0.32)' : 'rgba(8,10,24,0.70)',
            backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, cursor: 'pointer',
            boxShadow: b.active
              ? '0 0 28px rgba(140,65,255,0.55), inset 0 1px 0 rgba(255,255,255,0.10)'
              : '0 0 16px rgba(110,65,230,0.14), inset 0 1px 0 rgba(255,255,255,0.06)',
            transition: 'all 0.25s ease',
            animation: b.active ? 'glowPulse 1.4s ease-in-out infinite' : 'none',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'rgba(194,155,255,0.65)'
            e.currentTarget.style.boxShadow   = '0 0 24px rgba(123,77,255,0.35), inset 0 1px 0 rgba(255,255,255,0.08)'
            e.currentTarget.style.background  = 'rgba(80,40,180,0.18)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = b.active ? 'rgba(194,155,255,0.75)' : 'rgba(140,100,255,0.32)'
            e.currentTarget.style.boxShadow   = b.active
              ? '0 0 28px rgba(140,65,255,0.55), inset 0 1px 0 rgba(255,255,255,0.10)'
              : '0 0 16px rgba(110,65,230,0.14), inset 0 1px 0 rgba(255,255,255,0.06)'
            e.currentTarget.style.background  = b.active ? 'rgba(100,40,220,0.32)' : 'rgba(8,10,24,0.70)'
          }}
        >{b.icon}</div>
      ))}
    </div>
  )
}

function StatusText({ voiceStatus }) {
  const isWake     = voiceStatus === 'LISTENING FOR WAKE WORD'
  const isActive   = voiceStatus && voiceStatus !== 'IDLE' && !isWake
  const color      = isActive ? '#a78bfa' : isWake ? '#5E587A' : '#7E739E'
  const label      = isActive ? voiceStatus : isWake ? '● HEY NYX...' : 'AWAITING COMMAND'
  return (
    <div style={{
      marginTop: 14,
      fontFamily: 'Share Tech Mono', fontSize: 10,
      color,
      letterSpacing: '0.28em',
      textShadow: `0 0 12px rgba(140,100,220,${isActive ? 0.7 : 0.25})`,
      transition: 'color 0.4s, text-shadow 0.4s',
      animation: isActive ? 'statusBlink 1.4s ease-in-out infinite' : 'none',
    }}>
      {label}
    </div>
  )
}

function StaticWaveform({ voiceStatus }) {
  const isRecording = voiceStatus === 'LISTENING...'
  const isSpeaking  = voiceStatus === 'SPEAKING'
  const isWake      = voiceStatus === 'LISTENING FOR WAKE WORD'
  const isThinking  = voiceStatus === 'THINKING'

  const barColor = isSpeaking  ? '185,108,255'
                 : isRecording ? '122,167,255'
                 : isThinking  ? '185,108,255'
                 : isWake      ? '150,110,220'
                 : '170,120,255'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 9, height: 28 }}>
      {Array.from({ length: 34 }, (_, i) => {
        const base   = 2 + Math.abs(Math.sin(i * 0.68) * 13 + Math.cos(i * 1.25) * 5)
        const bright = 0.14 + Math.abs(Math.sin(i * 0.48)) * (isRecording || isSpeaking ? 0.75 : isWake ? 0.50 : 0.40)
        const spd    = isRecording ? 0.5 + (i % 5) * 0.09
                     : isSpeaking  ? 0.4 + (i % 5) * 0.07
                     : isWake      ? 1.2 + (i % 5) * 0.18
                     : 1.4 + (i % 5) * 0.22
        return (
          <div key={i} style={{
            width: 2,
            height: base,
            background: `rgba(${barColor},${bright})`,
            borderRadius: 1,
            boxShadow: bright > 0.42 ? `0 0 5px rgba(${barColor},0.6)` : 'none',
            animationName: 'waveBar',
            animationDuration: `${spd}s`,
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
            animationDelay: `${(i * 0.05) % 0.8}s`,
            transition: 'background 0.4s, box-shadow 0.4s',
          }} />
        )
      })}
    </div>
  )
}

function CommandInput({ onSubmit, isMobile }) {
  const [val, setVal]       = useState('')
  const [focused, setFocused] = useState(false)

  return (
    <div style={{ marginTop: 18, width: isMobile ? 'calc(100vw - 48px)' : 420, maxWidth: 420 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        background: 'rgba(8,10,24,0.68)',
        backdropFilter: 'blur(18px)',
        border: `1px solid ${focused ? 'rgba(170,120,255,0.42)' : 'rgba(140,100,255,0.22)'}`,
        borderRadius: 14,
        padding: '13px 20px',
        boxShadow: focused
          ? '0 0 32px rgba(110,65,230,0.20), inset 0 0 24px rgba(140,100,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)'
          : '0 0 20px rgba(90,50,200,0.10), inset 0 1px 0 rgba(255,255,255,0.05)',
        transition: 'all 0.3s ease',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'Rajdhani, sans-serif', fontSize: 9, fontWeight: 600,
            letterSpacing: '0.24em', color: '#5C5575', marginBottom: 5, textTransform: 'uppercase',
          }}>Command NYX</div>
          <input
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && val.trim()) onSubmit() }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onClick={e => e.stopPropagation()}
            placeholder="Enter your command..."
            style={{
              background: 'none', border: 'none', outline: 'none',
              fontFamily: 'Exo 2, sans-serif', fontSize: 13,
              color: '#F3EDFF', width: '100%',
            }}
          />
        </div>
        <button
          onClick={e => { e.stopPropagation(); onSubmit() }}
          className="glow-pulse"
          style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'rgba(100,55,220,0.22)',
            border: '1px solid rgba(156,108,255,0.55)',
            color: '#C7A6FF', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, transition: 'all 0.22s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(100,55,220,0.42)'
            e.currentTarget.style.borderColor = 'rgba(194,155,255,0.8)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(100,55,220,0.22)'
            e.currentTarget.style.borderColor = 'rgba(156,108,255,0.55)'
          }}
        >→</button>
      </div>
    </div>
  )
}