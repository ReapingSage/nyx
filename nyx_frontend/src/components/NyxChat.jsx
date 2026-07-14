import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { motion, AnimatePresence } from 'framer-motion'
import { resetConversation } from '../services/api.js'
import { useVoice, VOICE_STATUS } from '../hooks/useVoice.js'

const GLASS_MSG = {
  background: 'rgba(11,11,26,0.75)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(124,58,237,0.22)',
  borderRadius: 12,
}

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', ...GLASS_MSG, borderLeft: '2px solid #a78bfa', maxWidth: 120 }}
    >
      <span style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: '#a78bfa', letterSpacing: '0.1em' }}>NYX</span>
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        {[0,1,2].map(i => (
          <div
            key={i}
            className="typing-dot"
            style={{
              width: 5, height: 5, borderRadius: '50%',
              background: '#a78bfa',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </motion.div>
  )
}

function Message({ msg }) {
  const isNyx = msg.role === 'nyx'
  return (
    <motion.div
      initial={{ opacity: 0, x: isNyx ? -16 : 16, y: 4 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      style={{
        display: 'flex',
        justifyContent: isNyx ? 'flex-start' : 'flex-end',
        marginBottom: 10,
      }}
    >
      <div
        style={{
          maxWidth: '72%',
          padding: '10px 14px',
          ...GLASS_MSG,
          borderLeft: isNyx ? '2px solid #a78bfa' : 'none',
          borderRight: isNyx ? 'none' : '2px solid #6d28d9',
          background: isNyx ? 'rgba(11,11,26,0.75)' : 'rgba(76,29,149,0.15)',
          // Let the user select + copy message text (WebView defaults to off)
          userSelect: 'text', WebkitUserSelect: 'text', cursor: 'text',
        }}
      >
        <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: isNyx ? '#a78bfa' : '#6d28d9', letterSpacing: '0.12em', marginBottom: 5, userSelect: 'none' }}>
          {isNyx ? 'NYX' : 'YOU'}
          {msg.model && <span style={{ color: '#4a4680', marginLeft: 8 }}>{msg.model}</span>}
        </div>
        <div style={{ fontSize: 13, color: '#e2e0ff', lineHeight: 1.6, fontFamily: 'Exo 2, sans-serif',
          userSelect: 'text', WebkitUserSelect: 'text' }} className="nyx-markdown">
          <ReactMarkdown>{msg.text}</ReactMarkdown>
        </div>
      </div>
    </motion.div>
  )
}

export default function ChatOverlay({ visible, onOrbStateChange, onVoiceStatus, onRegisterVoice, isMobile }) {
  const [messages, setMessages]   = useState([
    { id: 0, role: 'nyx', text: 'Systems online. What do you need, Master?' }
  ])
  const [input, setInput]         = useState('')
  const [thinking, setThinking]   = useState(false)
  const scrollRef                  = useRef(null)
  const inputRef                   = useRef(null)

  // ── Voice hook ────────────────────────────────────────────────
  const addVoiceMessage = (msg) =>
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), ...msg }])

  const { status: voiceStatus, wakeMode, textOnly, setTextOnly, listenOnce, toggleWakeMode, stopAll, sendText } = useVoice({
    onMessage:  addVoiceMessage,
    onOrbState: onOrbStateChange,
  })

  // Propagate voice status up to App.jsx
  useEffect(() => {
    onVoiceStatus?.(voiceStatus)
  }, [voiceStatus, onVoiceStatus])

  // Register voice controls with App.jsx so dashboard mic button can reach them
  useEffect(() => {
    onRegisterVoice?.({ listenOnce, stopAll })
  }, [onRegisterVoice, listenOnce, stopAll])

  const isVoiceActive = voiceStatus !== VOICE_STATUS.IDLE

  useEffect(() => {
    if (visible) setTimeout(() => inputRef.current?.focus(), 400)
  }, [visible])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || thinking) return
    setInput('')
    setThinking(true)
    sendText(text)
    // voice hook manages message display, orb state, and audio — reset thinking on status change
    setTimeout(() => setThinking(false), 500)
  }

  const handleReset = async () => {
    try { await resetConversation() } catch {}
    setMessages([{ id: 0, role: 'nyx', text: 'Memory cleared. Fresh session initialized.' }])
    onOrbStateChange('idle')
  }

  // Never unmount — keeping this alive keeps the voice hook alive for wake word in any mode
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: visible ? 'none' : 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.4s ease',
        visibility: visible ? 'visible' : 'hidden',
      }}
    >
      {/* Message area — leaves room for docked orb and sidebar */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: isMobile
            ? '80px 16px 20px 16px'
            : '80px 380px 20px 240px',
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'auto',
        }}
      >
        {/* marginTop:auto pins messages to the bottom when there are only a
            few, but lets the list scroll fully once it overflows. The old
            justify-content:flex-end clipped older messages out of scroll
            reach — the top of the history became unreachable. */}
        <div style={{ marginTop: 'auto' }}>
          <AnimatePresence initial={false}>
            {messages.map(msg => <Message key={msg.id} msg={msg} />)}
            {thinking && <TypingIndicator key="typing" />}
          </AnimatePresence>
        </div>
      </div>

      {/* Input bar */}
      <div
        style={{
          padding: isMobile
            ? '0 16px calc(16px + env(safe-area-inset-bottom, 0px)) 16px'
            : '0 380px 32px 240px',
          pointerEvents: 'auto',
        }}
      >
        {/* Chat controls row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <button
            onClick={handleReset}
            style={{
              fontFamily: 'Share Tech Mono', fontSize: 9, color: '#4a4680',
              background: 'none', border: 'none', cursor: 'pointer',
              letterSpacing: '0.1em', padding: 0,
            }}
            onMouseEnter={e => e.target.style.color = '#a78bfa'}
            onMouseLeave={e => e.target.style.color = '#4a4680'}
          >↺ CLEAR MEMORY</button>

          {/* Voice status / wake mode toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontFamily: 'Share Tech Mono', fontSize: 9, letterSpacing: '0.10em',
              color: voiceStatus === VOICE_STATUS.SPEAKING  ? '#a78bfa'
                   : voiceStatus === VOICE_STATUS.RECORDING  ? '#7AA7FF'
                   : voiceStatus === VOICE_STATUS.THINKING   ? '#B96CFF'
                   : voiceStatus === VOICE_STATUS.WAKE_LISTEN? '#5E587A'
                   : '#4a4680',
              animation: isVoiceActive ? 'statusBlink 1.4s infinite' : 'none',
            }}>
              {isVoiceActive ? `● ${voiceStatus}` : (thinking ? '● PROCESSING' : '● READY')}
            </span>
            <button
              onClick={() => setTextOnly(v => !v)}
              title={textOnly ? 'Text only mode — click for voice' : 'Voice response mode — click for text only'}
              style={{
                fontFamily: 'Share Tech Mono', fontSize: 8, letterSpacing: '0.10em',
                color: textOnly ? '#7AA7FF' : '#a78bfa',
                background: textOnly ? 'rgba(47,107,255,0.12)' : 'rgba(124,58,237,0.14)',
                border: `1px solid ${textOnly ? 'rgba(122,167,255,0.4)' : 'rgba(124,58,237,0.4)'}`,
                borderRadius: 4, padding: '2px 7px', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >{textOnly ? '▤ TEXT' : '◈ VOICE'}</button>
            <button
              onClick={toggleWakeMode}
              title={wakeMode ? 'Disable wake-word mode' : 'Enable wake-word mode (say "Hey Nyx")'}
              style={{
                fontFamily: 'Share Tech Mono', fontSize: 8, letterSpacing: '0.10em',
                color: wakeMode ? '#a78bfa' : '#4a4680',
                background: wakeMode ? 'rgba(124,58,237,0.14)' : 'none',
                border: `1px solid ${wakeMode ? 'rgba(124,58,237,0.4)' : 'transparent'}`,
                borderRadius: 4, padding: '2px 7px', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >{wakeMode ? '◉ WAKE ON' : '◎ WAKE OFF'}</button>
          </div>
        </div>

        {/* Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            ...GLASS_MSG,
            padding: '10px 16px',
            boxShadow: thinking
              ? '0 0 30px rgba(124,58,237,0.25)'
              : '0 0 20px rgba(124,58,237,0.1)',
            transition: 'box-shadow 0.3s ease',
          }}
        >
          {/* Mic button — click to speak */}
          <button
            onClick={listenOnce}
            title="Click to speak"
            style={{
              width: isMobile ? 44 : 34, height: isMobile ? 44 : 34, borderRadius: '50%',
              background: voiceStatus === VOICE_STATUS.RECORDING
                ? 'rgba(124,58,237,0.40)'
                : 'rgba(124,58,237,0.12)',
              border: `1px solid ${voiceStatus === VOICE_STATUS.RECORDING
                ? 'rgba(167,139,250,0.7)'
                : 'rgba(124,58,237,0.3)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#a78bfa', flexShrink: 0,
              boxShadow: voiceStatus === VOICE_STATUS.RECORDING
                ? '0 0 16px rgba(124,58,237,0.45)'
                : 'none',
              transition: 'all 0.2s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
              <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
            </svg>
          </button>

          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Command NYX..."
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontFamily: 'Exo 2, sans-serif',
              fontSize: isMobile ? 16 : 13,
              color: '#e2e0ff',
              letterSpacing: '0.03em',
            }}
          />

          <button
            onClick={handleSend}
            disabled={thinking}
            style={{
              width: isMobile ? 44 : 34, height: isMobile ? 44 : 34, borderRadius: '50%',
              background: thinking ? 'rgba(124,58,237,0.08)' : 'rgba(124,58,237,0.2)',
              border: '1px solid rgba(124,58,237,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: thinking ? 'not-allowed' : 'pointer',
              color: '#a78bfa', flexShrink: 0,
              transition: 'all 0.2s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>

        {/* Label */}
        <div style={{
          textAlign: 'center',
          marginTop: 6,
          fontFamily: 'Share Tech Mono',
          fontSize: 9,
          color: '#4a4680',
          letterSpacing: '0.2em',
        }}>
          COMMAND NYX
        </div>
      </div>
    </div>
  )
}