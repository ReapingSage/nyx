/**
 * UpdatesPage.jsx — Nyx Operational Event Feed
 * A live timeline of system events, AI activity, and operational history.
 * Quiet. Intelligent. Not a social feed.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, Database, Bot, Zap, Shield, Cpu, CheckCircle2,
  Activity, RefreshCw, Lock, GitBranch, Volume2, Brain,
  Shuffle, Layers, Server, ChevronDown,
} from 'lucide-react'
import { getEvents, getNetworkStatus, getSystemStats } from '../services/api.js'

// ─────────────────────────────────────────────────────────────
// CATEGORY METADATA
// ─────────────────────────────────────────────────────────────

const CAT = {
  VOICE:    { color:'#f472b6', glow:'rgba(244,114,182,0.25)', bg:'rgba(244,114,182,0.07)', label:'VOICE',    icon:<Mic size={11}/>      },
  MEMORY:   { color:'#22c55e', glow:'rgba(34,197,94,0.25)',   bg:'rgba(34,197,94,0.07)',   label:'MEMORY',   icon:<Database size={11}/> },
  WORKER:   { color:'#34d399', glow:'rgba(52,211,153,0.25)',  bg:'rgba(52,211,153,0.07)',  label:'WORKER',   icon:<Bot size={11}/>      },
  PROVIDER: { color:'#FF9555', glow:'rgba(255,149,85,0.25)',  bg:'rgba(255,149,85,0.07)',  label:'PROVIDER', icon:<Zap size={11}/>      },
  SECURITY: { color:'#ef4444', glow:'rgba(239,68,68,0.25)',   bg:'rgba(239,68,68,0.07)',   label:'SECURITY', icon:<Shield size={11}/>   },
  AI:       { color:'#4DC8FF', glow:'rgba(77,200,255,0.25)',  bg:'rgba(77,200,255,0.07)',  label:'AI',       icon:<Cpu size={11}/>      },
  TASK:     { color:'#facc15', glow:'rgba(250,204,21,0.25)',  bg:'rgba(250,204,21,0.07)',  label:'TASK',     icon:<CheckCircle2 size={11}/>},
  SYSTEM:   { color:'#a874ff', glow:'rgba(168,116,255,0.25)', bg:'rgba(168,116,255,0.07)', label:'SYSTEM',   icon:<Activity size={11}/> },
}

const STATUS_DOT = {
  ok:   { color:'#22c55e' },
  warn: { color:'#facc15' },
  err:  { color:'#ef4444' },
}

// ─────────────────────────────────────────────────────────────
// FEED EVENT DATA — fetched live from /api/events (core/event_log.py)
// ─────────────────────────────────────────────────────────────

// Maps core/event_log.py's free-form lowercase categories to this page's
// fixed display categories (CAT, above). Real backend events come through
// getEvents() — nothing here is fabricated.
const CATEGORY_MAP = {
  voice: 'VOICE', memory: 'MEMORY', worker: 'WORKER',
  provider: 'PROVIDER', model: 'PROVIDER', security: 'SECURITY',
  ai: 'AI', chat: 'AI', tasks: 'TASK', reminders: 'TASK',
  settings: 'SYSTEM', system: 'SYSTEM', backup: 'SYSTEM',
  automation: 'WORKER', network: 'SYSTEM',
}

const STATUS_MAP = { ok: 'ok', warning: 'warn', error: 'err' }

function transformEvent(e) {
  return {
    id: e.id,
    category: CATEGORY_MAP[e.category] || 'SYSTEM',
    title: e.title,
    description: e.detail || '',
    ts: new Date(e.timestamp).getTime(),
    status: STATUS_MAP[e.status] || 'ok',
    source: e.category,
  }
}

const CATEGORIES = ['ALL', ...Object.keys(CAT)]

// ─────────────────────────────────────────────────────────────
// SYSTEM STATUS DATA
// ─────────────────────────────────────────────────────────────

// STATUS_ITEMS and INSIGHT_ITEMS are no longer static — SystemStatusPanel and
// InsightsPanel below build these from real /api/network/status + /api/system data.

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function formatAge(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60)        return `${s}s ago`
  if (s < 3600)      return `${Math.floor(s/60)}m ago`
  if (s < 86400)     return `${Math.floor(s/3600)}h ago`
  if (s < 86400 * 7) return `${Math.floor(s/86400)}d ago`
  return `${Math.floor(s/86400/7)}w ago`
}

// ─────────────────────────────────────────────────────────────
// EVENT CARD
// ─────────────────────────────────────────────────────────────

function EventCard({ event, isFirst, index }) {
  const cat = CAT[event.category] || CAT.SYSTEM
  const sd  = STATUS_DOT[event.status] || STATUS_DOT.ok

  return (
    <motion.div
      initial={{ opacity:0, y:8 }}
      animate={{ opacity:1, y:0 }}
      transition={{ duration:0.32, delay: index * 0.03, ease:'easeOut' }}
      style={{ position:'relative', paddingLeft:32, marginBottom:2 }}
    >
      {/* Timeline dot */}
      <div style={{
        position:   'absolute',
        left:       0,
        top:        14,
        width:      isFirst ? 8 : 5,
        height:     isFirst ? 8 : 5,
        borderRadius: '50%',
        background: cat.color,
        boxShadow:  isFirst ? `0 0 8px ${cat.glow}` : 'none',
        zIndex:     2,
        marginLeft: isFirst ? -1.5 : 0,
        transition: 'all 0.3s',
      }}>
        {isFirst && (
          <motion.div
            animate={{ scale:[1, 1.9, 1], opacity:[0.7, 0, 0.7] }}
            transition={{ duration:2.4, repeat:Infinity }}
            style={{
              position:'absolute', inset:-3, borderRadius:'50%',
              border:`1px solid ${cat.color}`,
            }}
          />
        )}
      </div>

      {/* Card */}
      <motion.div
        whileHover={{ borderColor:'rgba(var(--color-primary-rgb),0.22)', y:-1 }}
        style={{
          background:     'rgba(6,5,24,0.65)',
          border:         '1px solid rgba(var(--color-primary-rgb),0.08)',
          borderRadius:   8,
          padding:        '9px 12px 9px 10px',
          display:        'flex',
          alignItems:     'center',
          gap:            10,
          transition:     'border-color 0.22s, box-shadow 0.22s',
          cursor:         'default',
        }}
      >
        {/* Category icon */}
        <div style={{
          width:32, height:32, borderRadius:7, flexShrink:0,
          background: cat.bg,
          border:    `1px solid ${cat.glow}`,
          display:   'flex', alignItems:'center', justifyContent:'center',
          color:     cat.color,
        }}>
          {cat.icon}
        </div>

        {/* Text */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{
            fontFamily:'Rajdhani,sans-serif', fontSize:12.5, fontWeight:700,
            letterSpacing:'0.03em', color:'var(--color-text-primary)',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          }}>
            {event.title}
          </div>
          <div style={{
            fontFamily:'Share Tech Mono,monospace', fontSize:8.5,
            color:'rgba(var(--color-primary-rgb),0.36)',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            marginTop:2, lineHeight:1.4,
          }}>
            {event.description}
          </div>
        </div>

        {/* Right: tag + time + status */}
        <div style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
          <div style={{
            padding:'2px 7px',
            background: cat.bg,
            border:`1px solid ${cat.glow}`,
            borderRadius:3,
            fontFamily:'Rajdhani,sans-serif', fontSize:7.5, fontWeight:700,
            letterSpacing:'0.16em', textTransform:'uppercase',
            color: cat.color,
          }}>
            {cat.label}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{
              fontFamily:'Share Tech Mono,monospace', fontSize:7.5,
              color:'rgba(var(--color-primary-rgb),0.28)', letterSpacing:'0.06em',
            }}>
              {formatAge(event.ts)}
            </span>
            <div style={{
              width:4, height:4, borderRadius:'50%',
              background: sd.color,
              boxShadow: `0 0 4px ${sd.color}`,
            }}/>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────
// FILTER PILLS
// ─────────────────────────────────────────────────────────────

function FilterPills({ active, onChange }) {
  return (
    <div style={{ display:'flex', gap:5, overflowX:'auto', scrollbarWidth:'none' }}>
      {CATEGORIES.map(cat => {
        const isActive = active === cat
        const meta = CAT[cat]
        return (
          <button
            key={cat}
            onClick={() => onChange(cat)}
            style={{
              padding:    '4px 11px',
              borderRadius: 5,
              border:    `1px solid ${isActive ? (meta ? meta.glow : 'rgba(var(--color-primary-rgb),0.35)') : 'rgba(var(--color-primary-rgb),0.12)'}`,
              background: isActive ? (meta ? meta.bg : 'rgba(var(--color-primary-rgb),0.12)') : 'transparent',
              cursor:    'pointer',
              fontFamily:'Rajdhani,sans-serif', fontSize:9, fontWeight:700,
              letterSpacing:'0.16em', textTransform:'uppercase', whiteSpace:'nowrap',
              color: isActive ? (meta ? meta.color : 'var(--color-primary)') : 'rgba(var(--color-primary-rgb),0.38)',
              transition:'all 0.18s',
              flexShrink:0,
            }}
          >
            {cat}
          </button>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SYSTEM STATUS PANEL
// ─────────────────────────────────────────────────────────────

function buildStatusItems(networkStatus) {
  if (!networkStatus) return []
  const { providers, memory, voice } = networkStatus
  const dot = (online) => (online ? '#22c55e' : '#f87171')

  return [
    { label: 'Ollama', note: providers?.ollama?.online ? `${providers.ollama.latency_ms ?? '–'}ms` : 'offline', color: dot(providers?.ollama?.online) },
    { label: 'OpenClaw Agent', note: providers?.openclaw?.online ? 'connected' : 'offline', color: dot(providers?.openclaw?.online) },
    { label: 'Vault Bridge', note: memory?.vault_exists ? `${memory.vault_md_count} files` : 'not found', color: dot(memory?.vault_exists) },
    { label: 'Memory Notes', note: `${memory?.memory_count ?? 0} tracked`, color: '#22c55e' },
    { label: 'Voice Pipeline', note: voice?.enabled ? 'enabled' : 'disabled', color: dot(voice?.enabled) },
    { label: 'Internet', note: networkStatus.internet?.online ? `${networkStatus.internet.latency_ms ?? '–'}ms` : 'offline', color: dot(networkStatus.internet?.online) },
  ]
}

function SystemStatusPanel() {
  const [networkStatus, setNetworkStatus] = useState(null)

  useEffect(() => {
    const load = () => getNetworkStatus().then(setNetworkStatus).catch(() => {})
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [])

  const statusItems = buildStatusItems(networkStatus)

  return (
    <div style={{
      background:     'rgba(6,5,24,0.72)',
      backdropFilter: 'blur(18px)',
      border:         '1px solid rgba(var(--color-primary-rgb),0.12)',
      borderRadius:   10,
      overflow:       'hidden',
    }}>
      <div style={{
        padding:'11px 14px 8px',
        borderBottom:'1px solid rgba(var(--color-primary-rgb),0.08)',
        display:'flex', alignItems:'center', gap:7,
      }}>
        <Server size={10} color="rgba(var(--color-primary-rgb),0.45)"/>
        <span style={{
          fontFamily:'Rajdhani,sans-serif', fontSize:8.5, fontWeight:700,
          letterSpacing:'0.26em', textTransform:'uppercase',
          color:'var(--color-text-muted)',
        }}>
          SYSTEM STATUS
        </span>
        <div style={{ flex:1, height:1, background:'rgba(var(--color-primary-rgb),0.08)'}}/>
      </div>

      <div style={{ padding:'6px 0' }}>
        {statusItems.length === 0 ? (
          <div style={{ padding: '10px 14px', fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: 'var(--color-text-disabled)' }}>Loading...</div>
        ) : statusItems.map((item, i) => (
          <div
            key={i}
            style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'6px 14px',
              borderBottom: i < statusItems.length - 1
                ? '1px solid rgba(var(--color-primary-rgb),0.05)' : 'none',
            }}
          >
            <span style={{
              fontFamily:'Share Tech Mono,monospace', fontSize:9.5,
              color:'rgba(var(--color-primary-rgb),0.55)',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1,
            }}>
              {item.label}
            </span>
            <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0, marginLeft:8 }}>
              <span style={{
                fontFamily:'Share Tech Mono,monospace', fontSize:7.5,
                color:'rgba(var(--color-primary-rgb),0.28)', letterSpacing:'0.06em',
              }}>
                {item.note}
              </span>
              <div style={{
                width:5, height:5, borderRadius:'50%',
                background: item.color,
                boxShadow: `0 0 5px ${item.color}`,
              }}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// INSIGHTS PANEL
// ─────────────────────────────────────────────────────────────

// Builds real, conditional insights from actual system/network data —
// no fabricated text. Returns fewer items (or none) if there's nothing to say.
function buildInsights(sysStats, networkStatus) {
  const insights = []

  if (sysStats?.gpu && !sysStats.gpu.available) {
    insights.push({
      title: 'No GPU detected', icon: <Cpu size={12}/>, color: '#FF9555',
      body: 'Inference is running on CPU only. Responses from larger models will be slower than on a GPU-equipped machine.',
    })
  } else if (sysStats?.gpu?.available) {
    insights.push({
      title: 'GPU active', icon: <Cpu size={12}/>, color: '#4DC8FF',
      body: `${sysStats.gpu.name} — ${sysStats.gpu.usage}% utilization, ${sysStats.gpu.vram_used_mb}/${sysStats.gpu.vram_total_mb} MB VRAM in use.`,
    })
  }

  if (networkStatus?.memory) {
    const { memory_count, conv_log_count } = networkStatus.memory
    if (conv_log_count > 50) {
      insights.push({
        title: 'Conversation history growing', icon: <Database size={12}/>, color: '#a874ff',
        body: `${conv_log_count} conversation logs stored. Consider exporting a backup from Settings → Providers → Backup.`,
      })
    } else {
      insights.push({
        title: 'Memory tracking active', icon: <Activity size={12}/>, color: '#a874ff',
        body: `${memory_count} memory notes and ${conv_log_count} conversation logs tracked so far.`,
      })
    }
  }

  if (networkStatus?.providers?.ollama && !networkStatus.providers.ollama.online) {
    insights.push({
      title: 'Ollama unreachable', icon: <Zap size={12}/>, color: '#f87171',
      body: `Could not reach Ollama at ${networkStatus.providers.ollama.base_url}. Chat requests will fail until it's running.`,
    })
  }

  return insights
}

function InsightsPanel() {
  const [sysStats, setSysStats] = useState(null)
  const [networkStatus, setNetworkStatus] = useState(null)

  useEffect(() => {
    const load = () => {
      getSystemStats().then(setSysStats).catch(() => {})
      getNetworkStatus().then(setNetworkStatus).catch(() => {})
    }
    load()
    const id = setInterval(load, 20000)
    return () => clearInterval(id)
  }, [])

  const insights = buildInsights(sysStats, networkStatus)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, padding:'0 2px' }}>
        <Brain size={10} color="rgba(var(--color-primary-rgb),0.45)"/>
        <span style={{
          fontFamily:'Rajdhani,sans-serif', fontSize:8.5, fontWeight:700,
          letterSpacing:'0.26em', textTransform:'uppercase',
          color:'var(--color-text-muted)',
        }}>
          INSIGHTS
        </span>
        <div style={{ flex:1, height:1, background:'rgba(var(--color-primary-rgb),0.08)'}}/>
      </div>

      {insights.length === 0 ? (
        <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9.5, color: 'var(--color-text-disabled)', padding: '4px 2px' }}>Nothing to report.</div>
      ) : insights.map((ins, i) => (
        <motion.div
          key={i}
          initial={{ opacity:0, y:6 }}
          animate={{ opacity:1, y:0 }}
          transition={{ duration:0.4, delay: 0.2 + i * 0.1 }}
          style={{
            background:'rgba(6,5,24,0.65)',
            border:'1px solid rgba(var(--color-primary-rgb),0.10)',
            borderRadius:9,
            padding:'10px 12px',
          }}
        >
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
            <div style={{
              width:22, height:22, borderRadius:5, flexShrink:0,
              background:`${ins.color}18`,
              border:`1px solid ${ins.color}40`,
              display:'flex', alignItems:'center', justifyContent:'center',
              color: ins.color,
            }}>
              {ins.icon}
            </div>
            <span style={{
              fontFamily:'Rajdhani,sans-serif', fontSize:11, fontWeight:700,
              letterSpacing:'0.04em', color:'var(--color-text-primary)',
            }}>
              {ins.title}
            </span>
          </div>
          <p style={{
            fontFamily:'system-ui,sans-serif', fontSize:10.5, lineHeight:1.55,
            color:'rgba(var(--color-primary-rgb),0.42)',
            margin:0,
          }}>
            {ins.body}
          </p>
        </motion.div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN UPDATES PAGE
// ─────────────────────────────────────────────────────────────

export default function UpdatesPage() {
  const [activeFilter,  setActiveFilter]  = useState('ALL')
  const [visibleCount,  setVisibleCount]  = useState(10)
  const [tick,          setTick]          = useState(0)
  const [allEvents,     setAllEvents]     = useState([])

  // Re-render timestamps every 60s
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  // Pull real events from core/event_log.py — refreshed every 10s
  useEffect(() => {
    const load = async () => {
      try {
        const { events } = await getEvents(100)
        setAllEvents((events || []).map(transformEvent))
      } catch {}
    }
    load()
    const id = setInterval(load, 10_000)
    return () => clearInterval(id)
  }, [])

  const filtered = activeFilter === 'ALL'
    ? allEvents
    : allEvents.filter(e => e.category === activeFilter)

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  const handleFilter = useCallback(cat => {
    setActiveFilter(cat)
    setVisibleCount(10)
  }, [])

  const recentCount = allEvents.filter(e => Date.now() - e.ts < 60*60*1000).length

  return (
    <div style={{
      width:'100%', height:'100%', display:'flex', flexDirection:'column',
      overflow:'hidden', position:'relative', background:'rgba(2,2,14,0.4)',
    }}>
      {/* Tactical grid */}
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none', zIndex:0,
        backgroundImage:`
          linear-gradient(rgba(var(--color-primary-rgb),0.018) 1px, transparent 1px),
          linear-gradient(90deg, rgba(var(--color-primary-rgb),0.018) 1px, transparent 1px)`,
        backgroundSize:'72px 72px',
      }}/>

      {/* ── HEADER ─────────────────────────────────────────── */}
      <div style={{
        position:'relative', zIndex:10, flexShrink:0,
        height:42, display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 20px',
        borderBottom:'1px solid rgba(var(--color-primary-rgb),0.09)',
        background:'rgba(2,2,16,0.70)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <motion.div
            animate={{ opacity:[1,0.25,1] }}
            transition={{ duration:3.5, repeat:Infinity }}
            style={{ width:5, height:5, borderRadius:'50%',
              background:'var(--color-primary)', boxShadow:'0 0 7px var(--color-primary)' }}
          />
          <span style={{
            fontFamily:'Rajdhani,sans-serif', fontSize:11, fontWeight:700,
            letterSpacing:'0.28em', textTransform:'uppercase', color:'var(--color-text-muted)',
          }}>
            OPERATIONAL FEED
          </span>
          {recentCount > 0 && (
            <div style={{
              padding:'2px 7px',
              background:'rgba(168,116,255,0.10)',
              border:'1px solid rgba(168,116,255,0.22)',
              borderRadius:4,
            }}>
              <span style={{
                fontFamily:'Share Tech Mono,monospace', fontSize:7.5,
                color:'#a874ff', letterSpacing:'0.12em',
              }}>
                {recentCount} RECENT
              </span>
            </div>
          )}
        </div>
        <span style={{
          fontFamily:'Share Tech Mono,monospace', fontSize:8.5,
          color:'rgba(var(--color-primary-rgb),0.32)', letterSpacing:'0.10em',
        }}>
          {allEvents.length} EVENTS · LIVE
        </span>
      </div>

      {/* ── FILTER BAR ─────────────────────────────────────── */}
      <div style={{
        position:'relative', zIndex:9, flexShrink:0,
        height:40, display:'flex', alignItems:'center',
        padding:'0 20px',
        borderBottom:'1px solid rgba(var(--color-primary-rgb),0.06)',
        background:'rgba(2,2,14,0.40)',
      }}>
        <FilterPills active={activeFilter} onChange={handleFilter} />
      </div>

      {/* ── CONTENT ─────────────────────────────────────────── */}
      <div style={{
        flex:1, display:'flex', gap:14, padding:'14px 16px',
        overflow:'hidden', position:'relative', zIndex:5, minHeight:0,
      }}>

        {/* ── TIMELINE FEED ──────────────────────────────── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

          {/* Timeline line + events */}
          <div style={{
            flex:1, overflowY:'auto', overflowX:'hidden',
            paddingRight:4, paddingLeft:4,
            scrollbarWidth:'thin',
            scrollbarColor:'rgba(var(--color-primary-rgb),0.15) transparent',
            position:'relative',
          }}>
            {/* Vertical timeline spine */}
            <div style={{
              position:'absolute',
              left:4,
              top:0,
              bottom:0,
              width:1,
              background:`linear-gradient(180deg,
                rgba(var(--color-primary-rgb),0.18) 0%,
                rgba(var(--color-primary-rgb),0.08) 40%,
                rgba(var(--color-primary-rgb),0.03) 100%)`,
              zIndex:1,
              pointerEvents:'none',
            }}/>

            <AnimatePresence mode="popLayout">
              {visible.map((event, i) => (
                <EventCard
                  key={event.id + activeFilter}
                  event={event}
                  isFirst={i === 0}
                  index={i}
                />
              ))}
            </AnimatePresence>

            {/* Load more */}
            {hasMore && (
              <motion.div
                initial={{ opacity:0 }}
                animate={{ opacity:1 }}
                style={{ paddingLeft:32, paddingTop:6, paddingBottom:12 }}
              >
                <button
                  onClick={() => setVisibleCount(c => c + 10)}
                  style={{
                    display:'flex', alignItems:'center', gap:5,
                    padding:'7px 14px', borderRadius:7,
                    background:'rgba(var(--color-primary-rgb),0.06)',
                    border:'1px solid rgba(var(--color-primary-rgb),0.12)',
                    cursor:'pointer',
                    fontFamily:'Rajdhani,sans-serif', fontSize:9.5, fontWeight:700,
                    letterSpacing:'0.16em', textTransform:'uppercase',
                    color:'rgba(var(--color-primary-rgb),0.45)',
                    transition:'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(var(--color-primary-rgb),0.12)'
                    e.currentTarget.style.color = 'rgba(var(--color-primary-rgb),0.70)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(var(--color-primary-rgb),0.06)'
                    e.currentTarget.style.color = 'rgba(var(--color-primary-rgb),0.45)'
                  }}
                >
                  <ChevronDown size={11}/>
                  Load {Math.min(filtered.length - visibleCount, 10)} more
                </button>
              </motion.div>
            )}

            {visible.length === 0 && (
              <motion.div
                initial={{ opacity:0 }}
                animate={{ opacity:1 }}
                style={{
                  paddingLeft:32, paddingTop:32,
                  fontFamily:'Share Tech Mono,monospace', fontSize:9.5,
                  color:'rgba(var(--color-primary-rgb),0.22)', letterSpacing:'0.12em',
                }}
              >
                No events in this category.
              </motion.div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL ────────────────────────────────── */}
        <div style={{
          width:252, flexShrink:0, display:'flex', flexDirection:'column',
          gap:16, overflowY:'auto', overflowX:'hidden',
          scrollbarWidth:'none',
        }}>
          <SystemStatusPanel />
          <InsightsPanel />

          {/* Uptime counter */}
          <div style={{
            background:'rgba(6,5,24,0.55)',
            border:'1px solid rgba(var(--color-primary-rgb),0.08)',
            borderRadius:9, padding:'10px 14px',
            display:'flex', justifyContent:'space-between', alignItems:'center',
          }}>
            <span style={{
              fontFamily:'Share Tech Mono,monospace', fontSize:9,
              color:'rgba(var(--color-primary-rgb),0.35)', letterSpacing:'0.08em',
            }}>
              SESSION UPTIME
            </span>
            <UptimeBadge />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// UPTIME BADGE — live counter
// ─────────────────────────────────────────────────────────────

const SESSION_START = Date.now()

function UptimeBadge() {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - SESSION_START) / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  const str = h > 0
    ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`

  return (
    <span style={{
      fontFamily:'Share Tech Mono,monospace', fontSize:11,
      color:'rgba(34,197,94,0.7)', letterSpacing:'0.08em',
    }}>
      {str}
    </span>
  )
}
