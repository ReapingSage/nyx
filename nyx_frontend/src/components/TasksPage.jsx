/**
 * TasksPage.jsx — Nyx Real Task Queue
 * State-driven task queue that executes via /api/chat.
 */

import { useReducer, useEffect, useCallback, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Cpu, Search, FileText, Bot, Mic, ShieldCheck, Zap, Brain,
  Plus, Upload, BarChart2, Play, Pause, X,
  CheckCircle2, AlertCircle, Clock, MessageSquare,
} from 'lucide-react'
import { API_URL } from '../utils/constants.js'

// ─────────────────────────────────────────────────────────────
// TASK STATE MACHINE
// ─────────────────────────────────────────────────────────────

export const TASK_STATUS = {
  QUEUED:    'queued',
  RUNNING:   'running',
  PAUSED:    'paused',
  COMPLETED: 'completed',
  FAILED:    'failed',
}

const SMETA = {
  queued:    { color:'#facc15', glow:'rgba(250,204,21,0.32)',   bg:'rgba(250,204,21,0.07)',   label:'QUEUED'  },
  running:   { color:'#a874ff', glow:'rgba(168,116,255,0.38)', bg:'rgba(168,116,255,0.09)',  label:'RUNNING' },
  paused:    { color:'#FF9555', glow:'rgba(255,149,85,0.32)',   bg:'rgba(255,149,85,0.07)',   label:'PAUSED'  },
  completed: { color:'#22c55e', glow:'rgba(34,197,94,0.32)',    bg:'rgba(34,197,94,0.07)',    label:'DONE'    },
  failed:    { color:'#ef4444', glow:'rgba(239,68,68,0.32)',    bg:'rgba(239,68,68,0.07)',    label:'FAILED'  },
}

const TASK_ICONS = {
  inference: <Cpu size={14} />,
  search:    <Search size={14} />,
  upload:    <FileText size={14} />,
  agent:     <Bot size={14} />,
  voice:     <Mic size={14} />,
  scan:      <ShieldCheck size={14} />,
  selftask:  <Brain size={14} />,
  custom:    <Zap size={14} />,
}

const TASK_TYPE_OPTIONS = [
  {
    id:'inference', label:'AI Task', icon:<Cpu size={11}/>,
    desc:'Sends your prompt directly to Nyx — the local AI model responds via Ollama. Best for questions, writing, analysis, and general tasks.',
  },
  {
    id:'search', label:'Search', icon:<Search size={11}/>,
    desc:'Searches your Obsidian vault and memory constellation for relevant notes and entries. Different from AI Task — it finds existing knowledge rather than generating new text.',
  },
  {
    id:'upload', label:'File', icon:<FileText size={11}/>,
    desc:'Analyzes a document or file. Nyx reads the content, extracts key information, and summarizes what it finds.',
  },
  {
    id:'agent', label:'Agent', icon:<Bot size={11}/>,
    desc:'Uses OpenClaw to automate desktop or browser tasks on your behalf. Can open apps, click buttons, and interact with your system.',
  },
  {
    id:'voice', label:'Voice', icon:<Mic size={11}/>,
    desc:'Transcribes or processes voice and audio using the local Whisper pipeline. Describe what to transcribe or process.',
  },
  {
    id:'scan', label:'Scan', icon:<ShieldCheck size={11}/>,
    desc:'Runs a diagnostics scan — checks CPU, memory, running processes, and system health. Good for monitoring or troubleshooting.',
  },
  {
    id:'selftask', label:'Self Task', icon:<Brain size={11}/>,
    desc:'Nyx autonomously decides how to handle this. Give it a goal and it figures out the approach — no need to specify how, just what you want.',
  },
  {
    id:'custom', label:'Custom', icon:<Zap size={11}/>,
    desc:'User-defined behavior. Describe exactly what you want Nyx to do and it will handle it however makes the most sense.',
  },
]

const DEFAULT_PROVIDERS = {
  inference: 'Ollama',
  search:    'Vector Search',
  upload:    'Local Parser',
  agent:     'OpenClaw Agent',
  voice:     'Whisper',
  scan:      'System Monitor',
  selftask:  'Nyx Autonomous',
  custom:    'Nyx',
}

// ── Reducer ───────────────────────────────────────────────────

function reducer(state, action) {
  const now = action.now || Date.now()

  switch (action.type) {
    case 'ADD':
      return {
        ...state,
        active: [
          ...state.active,
          {
            id: `t${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
            status:       TASK_STATUS.QUEUED,
            progress:     0,
            queuedAt:     now,
            runStart:     null,
            pausedAt:     null,
            pausedOffset: 0,
            endTime:      null,
            elapsed:      0,
            error:        null,
            result:       null,
            manual:       false,
            ...action.task,
          },
        ],
      }

    case 'TICK': {
      const completing = []
      const updated = state.active.map(t => {
        if (t.status === TASK_STATUS.QUEUED) {
          return now - t.queuedAt >= 1500
            ? { ...t, status: TASK_STATUS.RUNNING, runStart: now }
            : t
        }
        if (t.status === TASK_STATUS.RUNNING) {
          const net     = now - t.runStart - (t.pausedOffset || 0)
          const elapsed = Math.floor(net / 1000)
          const progress = t.targetMs ? Math.min((net / t.targetMs) * 100, 99.5) : t.progress
          if (t.targetMs && net >= t.targetMs) completing.push(t.id)
          return { ...t, elapsed, progress }
        }
        return t
      })

      if (!completing.length) return { ...state, active: updated }

      const done = updated
        .filter(t => completing.includes(t.id))
        .map(t => ({ ...t, status: TASK_STATUS.COMPLETED, endTime: now, progress: 100 }))

      return {
        active:  updated.filter(t => !completing.includes(t.id)),
        history: [...done, ...state.history].slice(0, 30),
      }
    }

    case 'TOGGLE_PAUSE':
      return {
        ...state,
        active: state.active.map(t => {
          if (t.id !== action.id) return t
          if (t.status === TASK_STATUS.PAUSED) {
            return {
              ...t,
              status:       TASK_STATUS.RUNNING,
              pausedAt:     null,
              pausedOffset: (t.pausedOffset || 0) + (now - t.pausedAt),
            }
          }
          return { ...t, status: TASK_STATUS.PAUSED, pausedAt: now }
        }),
      }

    case 'COMPLETE': {
      const task = state.active.find(t => t.id === action.id)
      if (!task) return state
      return {
        active:  state.active.filter(t => t.id !== action.id),
        history: [
          { ...task, status: TASK_STATUS.COMPLETED, endTime: now, progress: 100 },
          ...state.history,
        ].slice(0, 30),
      }
    }

    case 'CANCEL': {
      const task = state.active.find(t => t.id === action.id)
      if (!task) return state
      return {
        active:  state.active.filter(t => t.id !== action.id),
        history: [
          { ...task, status: TASK_STATUS.FAILED, endTime: now, error: 'Cancelled' },
          ...state.history,
        ].slice(0, 30),
      }
    }

    case 'SET_RESULT': {
      const task = state.active.find(t => t.id === action.id)
      if (!task) return state
      const completed = {
        ...task,
        status:   TASK_STATUS.COMPLETED,
        endTime:  now,
        progress: 100,
        result:   action.result,
      }
      return {
        active:  state.active.filter(t => t.id !== action.id),
        history: [completed, ...state.history].slice(0, 30),
      }
    }

    case 'SET_ERROR': {
      const task = state.active.find(t => t.id === action.id)
      if (!task) return state
      const failed = {
        ...task,
        status:  TASK_STATUS.FAILED,
        endTime: now,
        error:   action.error || 'Unknown error',
      }
      return {
        active:  state.active.filter(t => t.id !== action.id),
        history: [failed, ...state.history].slice(0, 30),
      }
    }

    case 'CLEAR':
      return { ...state, active: [] }

    case 'PAUSE_ALL':
      return {
        ...state,
        active: state.active.map(t =>
          t.status === TASK_STATUS.RUNNING
            ? { ...t, status: TASK_STATUS.PAUSED, pausedAt: now }
            : t
        ),
      }

    default: return state
  }
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function fmtTime(secs) {
  const m = Math.floor(secs / 60), s = secs % 60
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function timeAgo(ms) {
  if (!ms) return ''
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60)   return `${s}s ago`
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  return `${Math.floor(s/3600)}h ago`
}

// ─────────────────────────────────────────────────────────────
// TASK RESULT MODAL — chat view for a task
// ─────────────────────────────────────────────────────────────

function TaskResultModal({ task, onClose }) {
  const isWaiting = task.status === TASK_STATUS.RUNNING || task.status === TASK_STATUS.QUEUED
  const isPaused  = task.status === TASK_STATUS.PAUSED
  const hasFailed = task.status === TASK_STATUS.FAILED
  const hasResult = !!task.result
  const sm        = SMETA[task.status] || SMETA.running
  const typeOpt   = TASK_TYPE_OPTIONS.find(o => o.id === task.type)

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity:0 }}
      animate={{ opacity:1 }}
      exit={{ opacity:0 }}
      transition={{ duration:0.18 }}
      style={{
        position:'absolute', inset:0, zIndex:110,
        background:'rgba(1,1,14,0.82)',
        backdropFilter:'blur(10px)',
        WebkitBackdropFilter:'blur(10px)',
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:24,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity:0, scale:0.93, y:26 }}
        animate={{ opacity:1, scale:1, y:0 }}
        exit={{ opacity:0, scale:0.95, y:12 }}
        transition={{ type:'spring', damping:28, stiffness:220 }}
        onClick={e => e.stopPropagation()}
        style={{
          width:'100%', maxWidth:560,
          maxHeight:'80vh',
          background:'rgba(5,4,24,0.98)',
          backdropFilter:'blur(24px)',
          border:`1px solid ${sm.glow}`,
          borderRadius:14,
          overflow:'hidden',
          boxShadow:`0 28px 72px rgba(0,0,0,0.62), 0 0 56px ${sm.glow}`,
          display:'flex', flexDirection:'column',
          position:'relative',
        }}
      >
        {/* Top accent */}
        <div style={{
          position:'absolute', top:0, left:'8%', right:'8%', height:1,
          background:`linear-gradient(90deg,transparent,${sm.color},transparent)`,
        }}/>

        {/* Header */}
        <div style={{
          padding:'14px 18px',
          borderBottom:'1px solid rgba(var(--color-primary-rgb),0.10)',
          display:'flex', alignItems:'center', gap:10, flexShrink:0,
        }}>
          <div style={{
            width:30, height:30, borderRadius:7, flexShrink:0,
            background:sm.bg, border:`1px solid ${sm.glow}`,
            display:'flex', alignItems:'center', justifyContent:'center',
            color:sm.color,
          }}>
            {TASK_ICONS[task.type] || <Zap size={13}/>}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{
              fontFamily:'Rajdhani,sans-serif', fontSize:14, fontWeight:700,
              letterSpacing:'0.04em', color:'var(--color-text-primary)',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            }}>
              {task.title}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
              <span style={{
                fontFamily:'Share Tech Mono,monospace', fontSize:7.5,
                letterSpacing:'0.08em', textTransform:'uppercase',
                color:sm.color, padding:'1px 5px',
                background:sm.bg, borderRadius:3,
              }}>
                {sm.label}
              </span>
              <span style={{
                fontFamily:'Share Tech Mono,monospace', fontSize:7.5,
                color:'rgba(var(--color-primary-rgb),0.36)',
              }}>
                {task.provider}{typeOpt ? ` · ${typeOpt.label}` : ''}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width:26, height:26, borderRadius:6, border:'none', cursor:'pointer',
              background:'rgba(var(--color-primary-rgb),0.07)',
              color:'rgba(var(--color-primary-rgb),0.45)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            }}
          >
            <X size={13}/>
          </button>
        </div>

        {/* Chat body */}
        <div style={{
          flex:1, overflowY:'auto', padding:'20px 18px',
          display:'flex', flexDirection:'column', gap:14,
          scrollbarWidth:'thin',
          scrollbarColor:'rgba(var(--color-primary-rgb),0.15) transparent',
        }}>
          {/* User bubble */}
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <div style={{
              maxWidth:'78%',
              background:'rgba(var(--color-primary-rgb),0.10)',
              border:'1px solid rgba(var(--color-primary-rgb),0.22)',
              borderRadius:'10px 10px 3px 10px',
              padding:'10px 14px',
            }}>
              <div style={{
                fontFamily:'Share Tech Mono,monospace', fontSize:7.5,
                color:'rgba(var(--color-primary-rgb),0.42)', marginBottom:6,
                letterSpacing:'0.10em',
              }}>
                YOU
              </div>
              <div style={{
                fontFamily:'system-ui,sans-serif', fontSize:13,
                color:'var(--color-text-primary)', lineHeight:1.55,
              }}>
                {task.title}
              </div>
              {task.description && task.description !== `Task: ${task.title}` && (
                <div style={{
                  fontFamily:'system-ui,sans-serif', fontSize:11,
                  color:'rgba(var(--color-primary-rgb),0.42)', marginTop:5, lineHeight:1.4,
                }}>
                  {task.description}
                </div>
              )}
            </div>
          </div>

          {/* Nyx bubble */}
          <div style={{ display:'flex', justifyContent:'flex-start' }}>
            <div style={{
              maxWidth:'88%',
              background:'rgba(6,5,26,0.85)',
              border:`1px solid ${hasFailed ? 'rgba(239,68,68,0.22)' : isWaiting || isPaused ? 'rgba(var(--color-primary-rgb),0.14)' : 'rgba(34,197,94,0.18)'}`,
              borderRadius:'10px 10px 10px 3px',
              padding:'10px 14px',
            }}>
              <div style={{
                fontFamily:'Share Tech Mono,monospace', fontSize:7.5,
                color: hasFailed ? 'rgba(239,68,68,0.55)' : isWaiting || isPaused ? 'rgba(var(--color-primary-rgb),0.42)' : 'rgba(34,197,94,0.55)',
                marginBottom:6, letterSpacing:'0.10em',
              }}>
                NYX · {task.provider || 'AI'}
              </div>

              {isWaiting && (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {[0,1,2].map(i => (
                    <motion.div
                      key={i}
                      animate={{ opacity:[0.2,1,0.2], y:[0,-3,0] }}
                      transition={{ duration:1.2, repeat:Infinity, delay:i*0.2 }}
                      style={{ width:5, height:5, borderRadius:'50%', background:'var(--color-primary)' }}
                    />
                  ))}
                  <span style={{
                    fontFamily:'Share Tech Mono,monospace', fontSize:10,
                    color:'rgba(var(--color-primary-rgb),0.42)', letterSpacing:'0.06em',
                    marginLeft:4,
                  }}>
                    Processing...
                  </span>
                </div>
              )}

              {isPaused && (
                <div style={{
                  fontFamily:'Share Tech Mono,monospace', fontSize:10,
                  color:'rgba(255,149,85,0.55)', letterSpacing:'0.06em',
                }}>
                  Task paused — resume to continue.
                </div>
              )}

              {hasFailed && (
                <div style={{
                  fontFamily:'system-ui,sans-serif', fontSize:12.5,
                  color:'rgba(239,68,68,0.75)', lineHeight:1.5,
                }}>
                  {task.error === 'Cancelled'
                    ? 'This task was cancelled before it completed.'
                    : task.error || 'Task failed. Make sure the Nyx backend is running on port 8000.'}
                </div>
              )}

              {!isWaiting && !isPaused && !hasFailed && hasResult && (
                <div style={{
                  fontFamily:'system-ui,sans-serif', fontSize:13,
                  color:'var(--color-text-primary)', lineHeight:1.65,
                  whiteSpace:'pre-wrap', wordBreak:'break-word',
                }}>
                  {task.result}
                </div>
              )}

              {!isWaiting && !isPaused && !hasFailed && !hasResult && (
                <div style={{
                  fontFamily:'Share Tech Mono,monospace', fontSize:10,
                  color:'rgba(var(--color-primary-rgb),0.32)',
                }}>
                  No response recorded.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding:'10px 18px',
          borderTop:'1px solid rgba(var(--color-primary-rgb),0.09)',
          display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0,
        }}>
          <span style={{
            fontFamily:'Share Tech Mono,monospace', fontSize:7.5,
            color:'rgba(var(--color-primary-rgb),0.28)', letterSpacing:'0.08em',
          }}>
            {task.endTime
              ? `Completed ${timeAgo(task.endTime)}`
              : `Running for ${fmtTime(task.elapsed || 0)}`}
          </span>
          <button
            onClick={onClose}
            style={{
              padding:'6px 16px', borderRadius:7,
              background:'rgba(var(--color-primary-rgb),0.07)',
              border:'1px solid rgba(var(--color-primary-rgb),0.16)',
              cursor:'pointer',
              fontFamily:'Rajdhani,sans-serif', fontSize:10, fontWeight:700,
              letterSpacing:'0.14em', textTransform:'uppercase',
              color:'rgba(var(--color-primary-rgb),0.55)',
            }}
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────
// TASK CREATE MODAL
// ─────────────────────────────────────────────────────────────

const inputBase = {
  width:'100%',
  background:'rgba(var(--color-primary-rgb),0.05)',
  border:'1px solid rgba(var(--color-primary-rgb),0.18)',
  borderRadius:8,
  padding:'9px 12px',
  fontFamily:'system-ui, sans-serif',
  fontSize:13,
  color:'var(--color-text-primary)',
  outline:'none',
  boxSizing:'border-box',
  transition:'border-color 0.2s, box-shadow 0.2s',
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{
        fontFamily:'Rajdhani,sans-serif', fontSize:9, fontWeight:700,
        letterSpacing:'0.20em', textTransform:'uppercase',
        color:'rgba(var(--color-primary-rgb),0.5)', marginBottom:6,
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function TaskCreateModal({ prefillType = 'inference', onSubmit, onClose }) {
  const [title,      setTitle]      = useState('')
  const [description,setDescription]= useState('')
  const [type,       setType]       = useState(prefillType)
  const [provider,   setProvider]   = useState('')
  const [titleFocus, setTitleFocus] = useState(true)
  const [descFocus,  setDescFocus]  = useState(false)
  const [provFocus,  setProvFocus]  = useState(false)
  const titleRef = useRef(null)

  useEffect(() => {
    setTimeout(() => titleRef.current?.focus(), 50)
  }, [])

  useEffect(() => { setType(prefillType) }, [prefillType])

  const canSubmit  = title.trim().length > 0
  const activeDesc = TASK_TYPE_OPTIONS.find(o => o.id === type)?.desc || ''

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit({
      title:       title.trim(),
      description: description.trim() || `Task: ${title.trim()}`,
      type,
      provider:    provider.trim() || DEFAULT_PROVIDERS[type] || 'Nyx',
      manual:      true,
    })
    onClose()
  }

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA') handleSubmit()
    if (e.key === 'Escape') onClose()
  }

  return (
    <motion.div
      initial={{ opacity:0 }}
      animate={{ opacity:1 }}
      exit={{ opacity:0 }}
      transition={{ duration:0.18 }}
      style={{
        position:'absolute', inset:0, zIndex:100,
        background:'rgba(1,1,14,0.72)',
        backdropFilter:'blur(8px)',
        WebkitBackdropFilter:'blur(8px)',
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:20,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity:0, scale:0.93, y:22 }}
        animate={{ opacity:1, scale:1, y:0 }}
        exit={{ opacity:0, scale:0.95, y:10 }}
        transition={{ type:'spring', damping:26, stiffness:220 }}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          width:'100%', maxWidth:480,
          background:'rgba(6,5,28,0.97)',
          backdropFilter:'blur(24px)',
          WebkitBackdropFilter:'blur(24px)',
          border:'1px solid rgba(var(--color-primary-rgb),0.26)',
          borderRadius:14,
          padding:'22px 24px 20px',
          boxShadow:'0 24px 64px rgba(0,0,0,0.55), 0 0 48px rgba(var(--color-primary-rgb),0.07)',
          position:'relative', overflow:'hidden',
        }}
      >
        {/* Top accent */}
        <div style={{
          position:'absolute', top:0, left:'12%', right:'12%', height:1,
          background:'linear-gradient(90deg,transparent,rgba(var(--color-primary-rgb),0.55),transparent)',
        }}/>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <motion.div
              animate={{ opacity:[1,0.3,1] }}
              transition={{ duration:2, repeat:Infinity }}
              style={{ width:6, height:6, borderRadius:'50%',
                background:'var(--color-primary)', boxShadow:'0 0 8px var(--color-primary)' }}
            />
            <span style={{
              fontFamily:'Rajdhani,sans-serif', fontSize:11, fontWeight:700,
              letterSpacing:'0.26em', textTransform:'uppercase', color:'var(--color-text-muted)',
            }}>
              CREATE TASK
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width:24, height:24, borderRadius:6, border:'none', cursor:'pointer',
              background:'rgba(var(--color-primary-rgb),0.07)',
              color:'rgba(var(--color-primary-rgb),0.45)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}
          >
            <X size={12}/>
          </button>
        </div>

        {/* Title */}
        <Field label="Task Title *">
          <input
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onFocus={() => setTitleFocus(true)}
            onBlur={() => setTitleFocus(false)}
            placeholder="What do you want Nyx to do?"
            style={{
              ...inputBase,
              borderColor: titleFocus ? 'rgba(var(--color-primary-rgb),0.55)' : 'rgba(var(--color-primary-rgb),0.18)',
              boxShadow:   titleFocus ? '0 0 0 2px rgba(var(--color-primary-rgb),0.10)' : 'none',
            }}
          />
        </Field>

        {/* Description */}
        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onFocus={() => setDescFocus(true)}
            onBlur={() => setDescFocus(false)}
            placeholder="Add details about this task…"
            rows={2}
            style={{
              ...inputBase, resize:'none', lineHeight:1.5,
              borderColor: descFocus ? 'rgba(var(--color-primary-rgb),0.55)' : 'rgba(var(--color-primary-rgb),0.18)',
              boxShadow:   descFocus ? '0 0 0 2px rgba(var(--color-primary-rgb),0.10)' : 'none',
            }}
          />
        </Field>

        {/* Type selector */}
        <Field label="Task Type">
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom: activeDesc ? 8 : 0 }}>
            {TASK_TYPE_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setType(opt.id)}
                style={{
                  padding:'5px 10px', borderRadius:6,
                  border:`1px solid ${type===opt.id ? 'rgba(var(--color-primary-rgb),0.55)' : 'rgba(var(--color-primary-rgb),0.13)'}`,
                  background: type===opt.id ? 'rgba(var(--color-primary-rgb),0.15)' : 'rgba(var(--color-primary-rgb),0.04)',
                  cursor:'pointer',
                  color: type===opt.id ? 'var(--color-primary)' : 'rgba(var(--color-primary-rgb),0.45)',
                  fontFamily:'Rajdhani,sans-serif', fontSize:10, fontWeight:700,
                  letterSpacing:'0.10em', textTransform:'uppercase',
                  display:'flex', alignItems:'center', gap:5,
                  transition:'all 0.15s',
                }}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
          {/* Description of selected type */}
          <AnimatePresence mode="wait">
            {activeDesc && (
              <motion.div
                key={type}
                initial={{ opacity:0, y:4 }}
                animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:-2 }}
                transition={{ duration:0.18 }}
                style={{
                  fontFamily:'system-ui,sans-serif', fontSize:11, lineHeight:1.5,
                  color:'rgba(var(--color-primary-rgb),0.45)',
                  background:'rgba(var(--color-primary-rgb),0.04)',
                  border:'1px solid rgba(var(--color-primary-rgb),0.10)',
                  borderRadius:7, padding:'7px 10px',
                }}
              >
                {activeDesc}
              </motion.div>
            )}
          </AnimatePresence>
        </Field>

        {/* Provider */}
        <Field label={`Provider (default: ${DEFAULT_PROVIDERS[type] || 'Nyx'})`}>
          <input
            value={provider}
            onChange={e => setProvider(e.target.value)}
            onFocus={() => setProvFocus(true)}
            onBlur={() => setProvFocus(false)}
            placeholder={DEFAULT_PROVIDERS[type] || 'Nyx'}
            style={{
              ...inputBase,
              borderColor: provFocus ? 'rgba(var(--color-primary-rgb),0.55)' : 'rgba(var(--color-primary-rgb),0.18)',
              boxShadow:   provFocus ? '0 0 0 2px rgba(var(--color-primary-rgb),0.10)' : 'none',
            }}
          />
        </Field>

        {/* Footer */}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:4 }}>
          <button
            onClick={onClose}
            style={{
              padding:'8px 16px', borderRadius:8,
              background:'rgba(var(--color-primary-rgb),0.06)',
              border:'1px solid rgba(var(--color-primary-rgb),0.14)',
              cursor:'pointer',
              fontFamily:'Rajdhani,sans-serif', fontSize:11, fontWeight:700,
              letterSpacing:'0.14em', textTransform:'uppercase',
              color:'rgba(var(--color-primary-rgb),0.5)',
              transition:'all 0.18s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(var(--color-primary-rgb),0.10)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(var(--color-primary-rgb),0.06)'}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              padding:'8px 20px', borderRadius:8,
              background: canSubmit ? 'rgba(var(--color-primary-rgb),0.20)' : 'rgba(var(--color-primary-rgb),0.06)',
              border:`1px solid ${canSubmit ? 'rgba(var(--color-primary-rgb),0.45)' : 'rgba(var(--color-primary-rgb),0.10)'}`,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontFamily:'Rajdhani,sans-serif', fontSize:11, fontWeight:700,
              letterSpacing:'0.14em', textTransform:'uppercase',
              color: canSubmit ? 'var(--color-primary)' : 'rgba(var(--color-primary-rgb),0.25)',
              boxShadow: canSubmit ? '0 0 16px rgba(var(--color-primary-rgb),0.18)' : 'none',
              transition:'all 0.18s',
            }}
            onMouseEnter={e => { if (canSubmit) e.currentTarget.style.background = 'rgba(var(--color-primary-rgb),0.28)' }}
            onMouseLeave={e => { if (canSubmit) e.currentTarget.style.background = 'rgba(var(--color-primary-rgb),0.20)' }}
          >
            Create Task →
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────
// TASK CARD
// ─────────────────────────────────────────────────────────────

function TaskCard({ task, onTogglePause, onCancel, onViewResult }) {
  const m        = SMETA[task.status] || SMETA.running
  const isRunning = task.status === TASK_STATUS.RUNNING
  const isPaused  = task.status === TASK_STATUS.PAUSED
  const isQueued  = task.status === TASK_STATUS.QUEUED
  const isActive  = isRunning || isPaused || isQueued
  const hasResult = !!task.result

  return (
    <motion.div
      layout
      initial={{ opacity:0, y:-20, scale:0.97 }}
      animate={{ opacity:1, y:0, scale:1 }}
      exit={{ opacity:0, y:-12, scale:0.96, transition:{ duration:0.22 } }}
      transition={{ type:'spring', damping:26, stiffness:200 }}
      onClick={() => onViewResult(task.id)}
      style={{
        position:       'relative',
        background:     'rgba(6,5,26,0.82)',
        backdropFilter: 'blur(18px)',
        border:         `1px solid ${isRunning ? m.glow : 'rgba(var(--color-primary-rgb),0.13)'}`,
        borderRadius:   10,
        padding:        '11px 14px 0',
        marginBottom:   7,
        boxShadow:      isRunning ? `0 4px 22px ${m.glow}` : 'none',
        overflow:       'hidden',
        transition:     'border-color 0.35s, box-shadow 0.35s',
        cursor:         'pointer',
      }}
      whileHover={{ borderColor: isRunning ? m.glow : 'rgba(var(--color-primary-rgb),0.28)' }}
    >
      {/* Accent line — running only */}
      {isRunning && (
        <div style={{
          position:'absolute', top:0, left:0, right:0, height:1,
          background:`linear-gradient(90deg,transparent,${m.color},transparent)`,
          opacity:0.55,
        }}/>
      )}

      {/* Badges: manual USER + result indicator */}
      {task.manual && (
        <div style={{
          position:'absolute', top:8, right:14,
          fontFamily:'Share Tech Mono,monospace', fontSize:7,
          letterSpacing:'0.12em', color:'rgba(var(--color-primary-rgb),0.28)',
          textTransform:'uppercase',
        }}>
          USER
        </div>
      )}
      {hasResult && (
        <div style={{
          position:'absolute', top:8, right: task.manual ? 46 : 14,
          display:'flex', alignItems:'center',
        }}>
          <MessageSquare size={8} color="rgba(34,197,94,0.45)"/>
        </div>
      )}

      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
        {/* Icon */}
        <div style={{
          width:36, height:36, borderRadius:8, flexShrink:0,
          background:m.bg,
          border:`1px solid ${isRunning ? m.glow : 'rgba(var(--color-primary-rgb),0.10)'}`,
          display:'flex', alignItems:'center', justifyContent:'center',
          color:m.color,
          transition:'border-color 0.3s',
        }}>
          {TASK_ICONS[task.type] || <Zap size={14}/>}
        </div>

        {/* Title + desc */}
        <div style={{ flex:1, minWidth:0, paddingRight: task.manual ? 36 : 0 }}>
          <div style={{
            fontFamily:'Rajdhani,sans-serif', fontSize:13.5, fontWeight:700,
            letterSpacing:'0.04em', color:'var(--color-text-primary)',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          }}>
            {task.title}
          </div>
          <div style={{
            fontFamily:'Share Tech Mono,monospace', fontSize:9,
            color:'rgba(var(--color-primary-rgb),0.38)', marginTop:2,
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          }}>
            {task.description}
          </div>
        </div>

        {/* Right: provider + status + timer + controls */}
        <div style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{
              fontFamily:'Share Tech Mono,monospace', fontSize:8.5,
              color:'rgba(var(--color-primary-rgb),0.38)', letterSpacing:'0.04em',
            }}>
              {task.provider}
            </span>
            <motion.div
              animate={{ opacity: isRunning ? [1,0.2,1] : 1 }}
              transition={{ duration:1.5, repeat: isRunning ? Infinity : 0 }}
              style={{ width:6, height:6, borderRadius:'50%',
                background:m.color, boxShadow:`0 0 5px ${m.glow}` }}
            />
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{
              fontFamily:'Share Tech Mono,monospace', fontSize:9,
              color: isActive ? 'rgba(var(--color-primary-rgb),0.48)' : m.color,
              letterSpacing:'0.08em', minWidth:38, textAlign:'right',
            }}>
              {isQueued ? '··:··' : fmtTime(task.elapsed || 0)}
            </span>
            {isActive && (
              <>
                {/* Pause/Resume */}
                <button
                  onClick={e => { e.stopPropagation(); onTogglePause(task.id) }}
                  title={isPaused ? 'Resume' : 'Pause'}
                  style={{
                    width:18, height:18, borderRadius:4, border:'none', cursor:'pointer',
                    background:'rgba(var(--color-primary-rgb),0.08)',
                    color:'rgba(var(--color-primary-rgb),0.55)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}
                >
                  {isPaused ? <Play size={9}/> : <Pause size={9}/>}
                </button>
                {/* Cancel */}
                <button
                  onClick={e => { e.stopPropagation(); onCancel(task.id) }}
                  title="Cancel"
                  style={{
                    width:18, height:18, borderRadius:4, border:'none', cursor:'pointer',
                    background:'rgba(239,68,68,0.08)',
                    color:'rgba(239,68,68,0.5)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}
                >
                  <X size={10}/>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height:3, background:'rgba(var(--color-primary-rgb),0.07)',
        margin:'9px -14px 0', borderRadius:'0 0 9px 9px',
        overflow:'hidden', position:'relative',
      }}>
        <div style={{
          position:'absolute', top:0, left:0, bottom:0,
          width:`${Math.round(task.progress)}%`,
          background: isRunning
            ? `linear-gradient(90deg, ${m.color}90, ${m.color})`
            : m.color,
          boxShadow: isRunning ? `0 0 6px ${m.glow}` : 'none',
          transition:'width 0.45s linear',
        }}/>
        {isRunning && (
          <motion.div
            animate={{ x:['-100%','400%'] }}
            transition={{ duration:2, repeat:Infinity, ease:'linear', repeatDelay:1 }}
            style={{
              position:'absolute', top:0, bottom:0, left:0,
              width:'25%',
              background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)',
              pointerEvents:'none',
            }}
          />
        )}
      </div>

      {/* Pulse idle bar for manual running tasks at 0% */}
      {task.manual && task.progress === 0 && isRunning && (
        <motion.div
          animate={{ opacity:[0.3,0.6,0.3] }}
          transition={{ duration:2.5, repeat:Infinity }}
          style={{
            position:'absolute', bottom:0, left:'5%', right:'5%', height:2,
            background:`linear-gradient(90deg,transparent,${m.color},transparent)`,
            borderRadius:1,
          }}
        />
      )}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────
// EMPTY TASK SLOT
// ─────────────────────────────────────────────────────────────

const IDLE_TEXTS = [
  { title:'No active tasks',        sub:'Use quick actions to begin' },
  { title:'Waiting for operation…', sub:'Idle · ready'              },
  { title:'Tasks will appear here', sub:'Queue is empty'            },
]

function EmptyTaskSlot({ index }) {
  const txt = IDLE_TEXTS[index] || IDLE_TEXTS[0]
  return (
    <motion.div
      initial={{ opacity:0 }}
      animate={{ opacity: 0.28 + index * 0.06 }}
      transition={{ duration:0.5, delay: index * 0.08 }}
      style={{
        position:'relative',
        background:'rgba(6,5,26,0.45)',
        border:'1px solid rgba(var(--color-primary-rgb),0.07)',
        borderRadius:10, padding:'11px 14px 0', marginBottom:7, overflow:'hidden',
      }}
    >
      <motion.div
        animate={{ x:['-100%','220%'] }}
        transition={{ duration:3, repeat:Infinity, ease:'linear', delay: index*0.9, repeatDelay:2 }}
        style={{
          position:'absolute', inset:0,
          background:'linear-gradient(90deg,transparent,rgba(var(--color-primary-rgb),0.05),transparent)',
          pointerEvents:'none', width:'45%',
        }}
      />
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{
          width:36, height:36, borderRadius:8, flexShrink:0,
          background:'rgba(var(--color-primary-rgb),0.04)',
          border:'1px solid rgba(var(--color-primary-rgb),0.07)',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <motion.div
            animate={{ opacity:[0.15,0.30,0.15] }}
            transition={{ duration:3.5, repeat:Infinity, delay: index*0.6 }}
            style={{ width:14, height:14, borderRadius:3, background:'rgba(var(--color-primary-rgb),0.3)' }}
          />
        </div>
        <div style={{ flex:1 }}>
          <motion.div
            animate={{ opacity:[0.3,0.5,0.3] }}
            transition={{ duration:3.5, repeat:Infinity, delay: index*0.6 }}
            style={{ fontFamily:'Rajdhani,sans-serif', fontSize:12.5, fontWeight:600,
              letterSpacing:'0.06em', color:'rgba(var(--color-primary-rgb),0.4)' }}
          >
            {txt.title}
          </motion.div>
          <div style={{ fontFamily:'Share Tech Mono,monospace', fontSize:8.5,
            color:'rgba(var(--color-primary-rgb),0.18)', marginTop:2 }}>
            {txt.sub}
          </div>
        </div>
        <span style={{ flexShrink:0, fontFamily:'Share Tech Mono,monospace', fontSize:9,
          color:'rgba(var(--color-primary-rgb),0.18)', letterSpacing:'0.08em' }}>
          --:--
        </span>
      </div>
      <div style={{ height:3, background:'rgba(var(--color-primary-rgb),0.05)',
        margin:'9px -14px 0', borderRadius:'0 0 9px 9px' }}/>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────
// QUICK ACTIONS PANEL
// ─────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { id:'new',       icon:<Plus size={20}/>,     label:'New Task',      desc:'Create your own task',      color:'var(--color-primary)',  bg:'rgba(var(--color-primary-rgb),0.10)', openModal:true },
  { id:'upload',    icon:<Upload size={20}/>,    label:'Upload File',   desc:'Analyze a file',            color:'#4DC8FF',               bg:'rgba(77,200,255,0.10)',              openModal:true, prefill:'upload' },
  { id:'search',    icon:<BarChart2 size={20}/>, label:'Start Analysis',desc:'Scan vault or data',        color:'#FF9555',               bg:'rgba(255,149,85,0.10)',              openModal:true, prefill:'search' },
  { id:'agent',     icon:<Bot size={20}/>,       label:'Launch Agent',  desc:'Start a worker agent',      color:'#22c55e',               bg:'rgba(34,197,94,0.10)',               openModal:true, prefill:'agent' },
  { id:'selftask',  icon:<Brain size={20}/>,     label:'Self Task',     desc:'Let Nyx decide',            color:'#818cf8',               bg:'rgba(129,140,248,0.10)',             openModal:true, prefill:'selftask' },
  { id:'clear',     icon:<X size={20}/>,         label:'Clear Queue',   desc:'Remove all active tasks',   color:'#ef4444',               bg:'rgba(239,68,68,0.08)',               destructive:true },
  { id:'pause-all', icon:<Pause size={20}/>,     label:'Pause Workers', desc:'Pause all running tasks',   color:'#facc15',               bg:'rgba(250,204,21,0.08)' },
]

function QuickActionsPanel({ onAction }) {
  return (
    <div style={{
      background:'rgba(6,5,26,0.72)',
      backdropFilter:'blur(18px)',
      border:'1px solid rgba(var(--color-primary-rgb),0.14)',
      borderRadius:12, padding:'12px 14px',
      height:'100%', display:'flex', flexDirection:'column',
    }}>
      <div style={{
        fontFamily:'Rajdhani,sans-serif', fontSize:8.5, fontWeight:700,
        letterSpacing:'0.28em', textTransform:'uppercase',
        color:'var(--color-text-muted)', marginBottom:12,
        display:'flex', alignItems:'center', gap:8,
      }}>
        <div style={{ flex:1, height:1, background:'linear-gradient(90deg,transparent,rgba(var(--color-primary-rgb),0.35))' }}/>
        QUICK ACTIONS
        <div style={{ flex:1, height:1, background:'linear-gradient(90deg,rgba(var(--color-primary-rgb),0.35),transparent)' }}/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, flex:1, alignContent:'start' }}>
        {QUICK_ACTIONS.map(a => (
          <button
            key={a.id}
            onClick={() => onAction(a)}
            style={{
              background:a.bg,
              border:`1px solid ${a.destructive ? 'rgba(239,68,68,0.18)' : 'rgba(var(--color-primary-rgb),0.14)'}`,
              borderRadius:10, padding:'13px 12px',
              cursor:'pointer',
              display:'flex', flexDirection:'column', alignItems:'flex-start', gap:6,
              textAlign:'left', transition:'all 0.2s',
              position:'relative', overflow:'hidden',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = a.destructive ? 'rgba(239,68,68,0.38)' : 'rgba(var(--color-primary-rgb),0.30)'
              e.currentTarget.style.boxShadow = `0 4px 16px ${a.destructive ? 'rgba(239,68,68,0.12)' : 'rgba(var(--color-primary-rgb),0.10)'}`
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = a.destructive ? 'rgba(239,68,68,0.18)' : 'rgba(var(--color-primary-rgb),0.14)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ color:a.color }}>{a.icon}</div>
            <div>
              <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:12, fontWeight:700,
                letterSpacing:'0.06em', color:'var(--color-text-primary)' }}>
                {a.label}
              </div>
              <div style={{ fontFamily:'Share Tech Mono,monospace', fontSize:7.5,
                color:'rgba(var(--color-primary-rgb),0.35)', marginTop:2 }}>
                {a.desc}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TASK HISTORY PANEL
// ─────────────────────────────────────────────────────────────

function TaskHistoryPanel({ history, onViewResult }) {
  return (
    <div style={{
      borderTop:'1px solid rgba(var(--color-primary-rgb),0.09)',
      padding:'10px 20px 8px',
      background:'rgba(2,2,14,0.55)',
      height:'100%', display:'flex', flexDirection:'column',
    }}>
      <div style={{
        fontFamily:'Rajdhani,sans-serif', fontSize:8.5, fontWeight:700,
        letterSpacing:'0.28em', textTransform:'uppercase',
        color:'var(--color-text-muted)', marginBottom:8, flexShrink:0,
        display:'flex', alignItems:'center', gap:8,
      }}>
        <Clock size={11} color="rgba(var(--color-primary-rgb),0.4)"/>
        TASK HISTORY
        {history.length > 0 && (
          <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:7.5,
            color:'rgba(var(--color-primary-rgb),0.32)' }}>
            · {history.length}
          </span>
        )}
      </div>

      {history.length === 0 ? (
        <div style={{ flex:1, display:'flex', alignItems:'center',
          fontFamily:'Share Tech Mono,monospace', fontSize:9,
          color:'rgba(var(--color-primary-rgb),0.22)', letterSpacing:'0.10em' }}>
          No completed tasks yet
        </div>
      ) : (
        <div style={{ flex:1, display:'flex', gap:8, overflowX:'auto',
          scrollbarWidth:'none', alignItems:'flex-start' }}>
          {history.map(task => {
            const m = SMETA[task.status] || SMETA.completed
            return (
              <motion.div
                key={task.id}
                initial={{ opacity:0, scale:0.92, y:8 }}
                animate={{ opacity:1, scale:1, y:0 }}
                transition={{ type:'spring', damping:22, stiffness:180 }}
                onClick={() => onViewResult(task.id)}
                style={{
                  flexShrink:0, width:172,
                  background:'rgba(6,5,26,0.78)',
                  border:`1px solid ${m.glow}`,
                  borderRadius:8, padding:'9px 11px',
                  cursor:'pointer', transition:'border-color 0.2s',
                }}
                whileHover={{ scale:1.02 }}
              >
                <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3 }}>
                  {task.status === TASK_STATUS.COMPLETED
                    ? <CheckCircle2 size={11} color="#22c55e"/>
                    : <AlertCircle  size={11} color="#ef4444"/>
                  }
                  <span style={{
                    fontFamily:'Rajdhani,sans-serif', fontSize:11, fontWeight:700,
                    letterSpacing:'0.04em', color:'var(--color-text-primary)',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1,
                  }}>
                    {task.title}
                  </span>
                  {task.result && (
                    <MessageSquare size={8} color="rgba(34,197,94,0.45)"/>
                  )}
                </div>
                <div style={{ fontFamily:'Share Tech Mono,monospace', fontSize:7.5,
                  color:'rgba(var(--color-primary-rgb),0.32)', marginBottom:3 }}>
                  {task.provider}
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:7.5,
                    color:m.color, letterSpacing:'0.08em' }}>
                    {m.label}
                  </span>
                  <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:7.5,
                    color:'rgba(var(--color-primary-rgb),0.28)' }}>
                    {timeAgo(task.endTime)}
                  </span>
                </div>
                {task.error && task.error !== 'Cancelled' && (
                  <div style={{ marginTop:3, fontFamily:'Share Tech Mono,monospace',
                    fontSize:7, color:'rgba(239,68,68,0.45)' }}>
                    {task.error}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN TASKS PAGE
// ─────────────────────────────────────────────────────────────

export default function TasksPage() {
  const [state, dispatch]  = useReducer(reducer, { active: [], history: [] })
  const [modal, setModal]  = useState(null)       // null | { prefillType }
  const [viewTaskId, setViewTaskId] = useState(null)
  const pendingRef = useRef(new Set())            // task IDs with in-flight API calls

  // The task to display in the result modal — look up in active or history
  const viewTask = viewTaskId
    ? (state.active.find(t => t.id === viewTaskId) || state.history.find(t => t.id === viewTaskId))
    : null

  // Tick every 400ms to drive task progress
  useEffect(() => {
    const id = setInterval(() => dispatch({ type:'TICK', now: Date.now() }), 400)
    return () => clearInterval(id)
  }, [])

  // Fire API calls when manual tasks become RUNNING
  useEffect(() => {
    state.active.forEach(task => {
      if (task.status !== TASK_STATUS.RUNNING) return
      if (!task.manual) return
      if (pendingRef.current.has(task.id)) return

      pendingRef.current.add(task.id)

      const prompt = task.type === 'selftask'
        ? `[Self Task] ${task.title}${task.description && task.description !== `Task: ${task.title}` ? ` — ${task.description}` : ''}`
        : task.title

      fetch(`${API_URL}/api/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: prompt }),
      })
        .then(r => {
          if (!r.ok) throw new Error(`Server error ${r.status}`)
          return r.json()
        })
        .then(data => {
          dispatch({ type:'SET_RESULT', id: task.id, result: data.response, now: Date.now() })
        })
        .catch(err => {
          dispatch({ type:'SET_ERROR', id: task.id, error: err.message, now: Date.now() })
        })
        .finally(() => {
          pendingRef.current.delete(task.id)
        })
    })
  }, [state.active])

  const handleTogglePause = useCallback(id => {
    dispatch({ type:'TOGGLE_PAUSE', id, now: Date.now() })
  }, [])

  const handleCancel = useCallback(id => {
    dispatch({ type:'CANCEL', id, now: Date.now() })
    if (viewTaskId === id) setViewTaskId(null)
  }, [viewTaskId])

  const handleViewResult = useCallback(id => {
    setViewTaskId(id)
  }, [])

  const handleAction = useCallback(action => {
    const now = Date.now()
    if (action.id === 'clear')     { dispatch({ type:'CLEAR',     now }); return }
    if (action.id === 'pause-all') { dispatch({ type:'PAUSE_ALL', now }); return }
    setModal({ prefillType: action.prefill || 'inference' })
  }, [])

  const handleModalSubmit = useCallback(taskData => {
    dispatch({ type:'ADD', task: taskData, now: Date.now() })
  }, [])

  const runningCount = state.active.filter(t => t.status === TASK_STATUS.RUNNING).length
  const activeCount  = state.active.length
  const isEmpty      = activeCount === 0

  return (
    <div style={{
      width:'100%', height:'100%', display:'flex', flexDirection:'column',
      overflow:'hidden', position:'relative', background:'rgba(2,2,14,0.4)',
    }}>
      {/* Tactical grid */}
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none', zIndex:0,
        backgroundImage:`linear-gradient(rgba(var(--color-primary-rgb),0.022) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(var(--color-primary-rgb),0.022) 1px, transparent 1px)`,
        backgroundSize:'64px 64px',
      }}/>

      {/* ── HEADER ─────────────────────────────────────────── */}
      <div style={{
        position:'relative', zIndex:10, flexShrink:0,
        height:42, display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 20px',
        borderBottom:'1px solid rgba(var(--color-primary-rgb),0.10)',
        background:'rgba(2,2,16,0.70)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <motion.div
            animate={{ opacity:[1,0.3,1] }}
            transition={{ duration:2.5, repeat:Infinity }}
            style={{ width:6, height:6, borderRadius:'50%',
              background:'var(--color-primary)', boxShadow:'0 0 8px var(--color-primary)' }}
          />
          <span style={{ fontFamily:'Rajdhani,sans-serif', fontSize:11, fontWeight:700,
            letterSpacing:'0.28em', textTransform:'uppercase', color:'var(--color-text-muted)' }}>
            TASK QUEUE
          </span>
          {runningCount > 0 && (
            <div style={{ padding:'2px 8px',
              background:'rgba(168,116,255,0.12)', border:'1px solid rgba(168,116,255,0.28)', borderRadius:4 }}>
              <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:8,
                color:'#a874ff', letterSpacing:'0.12em' }}>
                {runningCount} RUNNING
              </span>
            </div>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:9,
            color:'rgba(var(--color-primary-rgb),0.40)', letterSpacing:'0.10em' }}>
            {activeCount} ACTIVE · {state.history.length} COMPLETED
          </span>
          {activeCount > 0 && (
            <button
              onClick={() => dispatch({ type:'CLEAR', now: Date.now() })}
              style={{
                fontFamily:'Rajdhani,sans-serif', fontSize:9, fontWeight:700,
                letterSpacing:'0.14em', textTransform:'uppercase',
                color:'rgba(239,68,68,0.5)', background:'none', border:'none',
                cursor:'pointer', padding:'3px 8px', borderRadius:4,
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(239,68,68,0.8)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(239,68,68,0.5)'}
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT ────────────────────────────────────── */}
      <div style={{
        flex:1, display:'flex', gap:12, padding:'12px 14px',
        overflow:'hidden', position:'relative', zIndex:5, minHeight:0,
      }}>
        {/* Active tasks */}
        <div style={{ flex:1.85, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
            marginBottom:10, flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <span style={{ fontFamily:'Rajdhani,sans-serif', fontSize:9, fontWeight:700,
                letterSpacing:'0.24em', textTransform:'uppercase', color:'var(--color-text-muted)' }}>
                ACTIVE TASKS
              </span>
              <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:8,
                color:'rgba(var(--color-primary-rgb),0.38)' }}>
                · {activeCount} Running
              </span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <motion.div
                animate={{ opacity: runningCount > 0 ? [1,0.2,1] : 0.25 }}
                transition={{ duration:1.8, repeat: runningCount > 0 ? Infinity : 0 }}
                style={{
                  width:5, height:5, borderRadius:'50%',
                  background: runningCount > 0 ? '#a874ff' : 'rgba(var(--color-primary-rgb),0.3)',
                  boxShadow: runningCount > 0 ? '0 0 6px rgba(168,116,255,0.6)' : 'none',
                }}
              />
              <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:8,
                color: runningCount > 0 ? '#a874ff' : 'rgba(var(--color-primary-rgb),0.3)',
                letterSpacing:'0.10em' }}>
                {runningCount > 0 ? 'PROCESSING' : 'IDLE'}
              </span>
            </div>
          </div>

          <div style={{
            flex:1, overflowY:'auto', overflowX:'hidden', paddingRight:4,
            scrollbarWidth:'thin',
            scrollbarColor:'rgba(var(--color-primary-rgb),0.18) transparent',
          }}>
            <AnimatePresence mode="popLayout">
              {isEmpty
                ? [0,1,2].map(i => <EmptyTaskSlot key={i} index={i}/>)
                : state.active.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onTogglePause={handleTogglePause}
                      onCancel={handleCancel}
                      onViewResult={handleViewResult}
                    />
                  ))
              }
            </AnimatePresence>
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ width:260, flexShrink:0 }}>
          <QuickActionsPanel onAction={handleAction} />
        </div>
      </div>

      {/* ── TASK HISTORY ────────────────────────────────────── */}
      <div style={{ flexShrink:0, height:152, position:'relative', zIndex:10 }}>
        <TaskHistoryPanel history={state.history} onViewResult={handleViewResult} />
      </div>

      {/* ── MODALS ─────────────────────────────────────────── */}
      <AnimatePresence>
        {modal && (
          <TaskCreateModal
            key="create"
            prefillType={modal.prefillType}
            onSubmit={handleModalSubmit}
            onClose={() => setModal(null)}
          />
        )}
        {viewTask && (
          <TaskResultModal
            key={`result-${viewTask.id}`}
            task={viewTask}
            onClose={() => setViewTaskId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
