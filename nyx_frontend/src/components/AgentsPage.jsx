/**
 * AgentsPage.jsx — The Forge › Agents
 *
 * A living space for NYX's AI agents. Each agent is a stylized character
 * (Path A: CSS/SVG, no external art) living in its own cozy room, cycling
 * through idle behaviors and showing real-time status. As you deploy more
 * agents, rooms tile out and the camera zooms to fit the whole facility.
 *
 * V1 ships one REAL agent — OpenClaw. Click it, Assign Task, and it runs
 * for real through NYX's OpenClaw pipeline; its status/room reflect what
 * it's genuinely doing (Idle vs. Working) and its activity is live.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { API_URL } from '../utils/constants.js'
import FacilityView from './FacilityView.jsx'

const MONO = { fontFamily: 'Share Tech Mono, monospace' }
const RAJ  = { fontFamily: 'Rajdhani, sans-serif' }

// Idle behaviors — each moves the character to a spot with an activity line.
const BEHAVIORS = [
  { id: 'pace',    label: 'Pacing around',            pos: 'center'  },
  { id: 'beanbag', label: 'Relaxing on the bean bag', pos: 'beanbag' },
  { id: 'nap',     label: 'Sleeping',                 pos: 'bed', sleep: true },
  { id: 'window',  label: 'Watching the rain',        pos: 'window'  },
  { id: 'shelf',   label: 'Browsing the shelf',       pos: 'shelf'   },
  { id: 'stretch', label: 'Stretching',               pos: 'center'  },
  { id: 'read',    label: 'Reading a book',           pos: 'beanbag' },
  { id: 'coffee',  label: 'Drinking coffee',          pos: 'rug'     },
  { id: 'plant',   label: 'Watering the plant',       pos: 'plant'   },
  { id: 'tinker',  label: 'Tinkering at the desk',    pos: 'deskSit' },
]

// Character floor position per spot (% of the room box). y is the FEET line.
const SPOTS = {
  center:  { x: 50, y: 82 },
  bed:     { x: 20, y: 74, sit: true },
  beanbag: { x: 37, y: 90, sit: true },
  window:  { x: 50, y: 66 },
  shelf:   { x: 84, y: 74 },
  deskSit: { x: 72, y: 70, sit: true },
  rug:     { x: 52, y: 88 },
  plant:   { x: 12, y: 82 },
}

// ── The character: a stylized hooded figure with glowing eyes ──────────
function Character({ accent, pose, working, waving }) {
  const sleeping = pose?.sleep
  const sit = pose?.sit && !sleeping
  return (
    <div style={{ position: 'relative', width: 44, height: sit ? 40 : 52 }}>
      {/* soft floor shadow */}
      <div style={{ position: 'absolute', bottom: -3, left: '50%', transform: 'translateX(-50%)',
        width: 34, height: 8, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', filter: 'blur(3px)' }} />
      {/* body / hoodie */}
      <div style={{
        position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
        width: 34, height: sit ? 30 : 40, borderRadius: '18px 18px 12px 12px',
        background: `linear-gradient(160deg, #241a38, #0c0a16)`,
        border: `1px solid ${accent}66`,
        boxShadow: `0 0 16px ${accent}33, inset 0 2px 6px rgba(255,255,255,0.04)`,
        animation: sleeping ? 'none' : 'nyxAgentBob 3.4s ease-in-out infinite',
      }}>
        {/* hood opening + glowing eyes */}
        <div style={{ position: 'absolute', top: 7, left: '50%', transform: 'translateX(-50%)',
          width: 23, height: 17, borderRadius: '12px 12px 10px 10px', background: '#040308' }}>
          {sleeping ? (
            <div style={{ position: 'absolute', top: 8, left: 5, right: 5, height: 2, borderRadius: 2,
              background: accent, opacity: 0.55, boxShadow: `0 0 6px ${accent}` }} />
          ) : (
            <>
              <span style={{ position: 'absolute', top: 6, left: 5, width: 4, height: 5, borderRadius: '50%',
                background: accent, boxShadow: `0 0 7px ${accent}, 0 0 12px ${accent}` }} />
              <span style={{ position: 'absolute', top: 6, right: 5, width: 4, height: 5, borderRadius: '50%',
                background: accent, boxShadow: `0 0 7px ${accent}, 0 0 12px ${accent}` }} />
            </>
          )}
        </div>
      </div>
      {waving && (
        <div style={{ position: 'absolute', top: -2, right: -8, fontSize: 13,
          animation: 'nyxAgentBob 0.5s ease-in-out infinite' }}>👋</div>
      )}
      {sleeping && (
        <div style={{ position: 'absolute', top: -10, right: -4, ...MONO, fontSize: 11, color: accent,
          opacity: 0.8, animation: 'nyxAgentZzz 2.4s ease-in-out infinite' }}>z</div>
      )}
    </div>
  )
}

// ── A single cozy room (2.5D diorama) ──────────────────────────────────
function Room({ agent, selected, onSelect, big }) {
  const [behavior, setBehavior] = useState(BEHAVIORS[0])
  const [objMsg, setObjMsg] = useState(null)   // transient label from clicking an object
  const [waving, setWaving] = useState(false)
  const working = agent.status === 'Working'
  const accent = agent.accent || '#7B4DFF'
  const W = big ? 620 : 300, H = big ? 420 : 200

  useEffect(() => {
    if (working) return
    const tick = () => setBehavior(BEHAVIORS[Math.floor(Math.random() * BEHAVIORS.length)])
    const id = setInterval(tick, 6500 + Math.random() * 4500)
    return () => clearInterval(id)
  }, [working])

  const pose = working ? { id: 'work', label: agent.current_task || 'Working…', pos: 'deskSit', sit: true } : behavior
  const spot = SPOTS[pose.pos] || SPOTS.center
  const activity = objMsg || pose.label

  const flash = (msg, e) => {
    if (e) e.stopPropagation()
    setObjMsg(msg); setTimeout(() => setObjMsg(null), 2200)
  }
  const wave = (e) => {
    e.stopPropagation(); onSelect(agent.id)
    setWaving(true); setTimeout(() => setWaving(false), 1600)
  }

  const px = (v, dim) => (v / 100) * dim
  const S = big ? 1 : 0.62   // scale furniture for the small facility tiles

  return (
    <div
      onClick={() => onSelect(agent.id)}
      style={{
        width: W, height: H, position: 'relative', flexShrink: 0, cursor: 'pointer',
        borderRadius: 20, overflow: 'hidden',
        border: `1px solid ${selected ? accent + 'aa' : 'rgba(150,110,255,0.28)'}`,
        boxShadow: selected ? `0 0 44px ${accent}44` : '0 10px 40px rgba(0,0,0,0.45)',
        transition: 'border-color 0.3s, box-shadow 0.3s',
        background: '#0a0816',
      }}
    >
      {/* ── Back wall ── */}
      <div style={{ position: 'absolute', inset: 0,
        background: `linear-gradient(180deg, #171029 0%, #120d22 55%), radial-gradient(90% 70% at 78% 30%, ${accent}22, transparent 60%)` }} />

      {/* ── Window with rain + moon + weather ── */}
      <div style={{ position: 'absolute', left: '46%', top: '10%', width: px(26, W), height: px(30, H),
        borderRadius: 8, overflow: 'hidden', border: '2px solid rgba(120,110,180,0.35)',
        background: 'linear-gradient(180deg, #1b2350 0%, #0e1330 100%)',
        boxShadow: 'inset 0 0 24px rgba(80,110,220,0.25)' }}
        onClick={e => flash('Weather · Rainy', e)} title="Weather">
        {/* moon */}
        <div style={{ position: 'absolute', top: '18%', right: '18%', width: 14, height: 14, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #eae6ff, #b9a6ff)', boxShadow: '0 0 14px rgba(200,190,255,0.7)' }} />
        {/* rain */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.5,
          background: 'repeating-linear-gradient(102deg, transparent 0 5px, rgba(180,200,255,0.28) 5px 6px)',
          animation: 'nyxRain 0.5s linear infinite' }} />
        {/* sill light */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(140,160,255,0.3)' }} />
      </div>

      {/* ── Wall decor (fills the back wall so it feels lived-in) ── */}
      {/* framed poster (left of window) */}
      <div style={{ position: 'absolute', left: px(20, W), top: px(14, H), width: 34 * S, height: 46 * S,
        borderRadius: 4, background: `linear-gradient(160deg, ${accent}55, #1a1230)`,
        border: '2px solid rgba(150,120,200,0.3)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
        <div style={{ position: 'absolute', inset: '30% 20% 45% 20%', borderRadius: 2, background: `${accent}88` }} />
      </div>
      {/* small round wall clock (right of window) */}
      <div style={{ position: 'absolute', right: px(22, W), top: px(16, H), width: 26 * S, height: 26 * S,
        borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #2a2142, #14102a)',
        border: '2px solid rgba(150,120,200,0.3)' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 1.5, height: 8 * S, background: accent,
          transformOrigin: 'top', transform: 'translate(-50%,0) rotate(40deg)' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 1.5, height: 6 * S, background: '#B9A6FF',
          transformOrigin: 'top', transform: 'translate(-50%,0) rotate(-90deg)' }} />
      </div>
      {/* string lights along the top */}
      <div style={{ position: 'absolute', top: 4, left: '8%', right: '8%', height: 10, display: 'flex',
        justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {[...Array(big ? 12 : 7)].map((_, i) => (
          <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', marginTop: (i % 2) * 4,
            background: i % 3 === 0 ? accent : '#c9a8ff', opacity: 0.75,
            boxShadow: `0 0 6px ${i % 3 === 0 ? accent : '#c9a8ff'}`,
            animation: `nyxBreathe ${3 + (i % 3)}s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>

      {/* ── Floor (subtle perspective band) ── */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '38%',
        background: 'linear-gradient(to bottom, #241a3a, #0d0a1a)',
        borderTop: '1px solid rgba(150,110,255,0.16)',
        boxShadow: 'inset 0 8px 20px rgba(0,0,0,0.4)' }} />
      {/* rug */}
      <div onClick={e => flash('Relaxing', e)} style={{ position: 'absolute', left: '50%', bottom: px(6, H),
        transform: 'translateX(-50%)', width: px(46, W) * S + 40, height: px(12, H),
        borderRadius: '50%', background: `radial-gradient(circle, ${accent}33, transparent 70%)`,
        border: `1px solid ${accent}22` }} />

      {/* ── Furniture (CSS art) ── */}
      {/* Bed */}
      <div onClick={e => flash('Sleeping', e)} title="Bed"
        style={{ position: 'absolute', left: px(6, W), bottom: px(20, H), width: 96 * S, height: 40 * S }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 8, background: 'linear-gradient(160deg, #2a2142, #191228)',
          border: '1px solid rgba(140,100,255,0.2)' }} />
        <div style={{ position: 'absolute', left: 4, top: 4, width: 22 * S, height: 14 * S, borderRadius: 4,
          background: `${accent}66` }} />{/* pillow */}
        <div style={{ position: 'absolute', right: 3, top: 8, left: 28 * S, bottom: 3, borderRadius: 5,
          background: 'linear-gradient(160deg, #3a2c5e, #241a3c)' }} />{/* blanket */}
      </div>

      {/* Desk + monitor + chair */}
      <div title="Computer" onClick={e => flash(working ? (agent.current_task || 'Working…') : 'Idle', e)}
        style={{ position: 'absolute', right: px(6, W), bottom: px(20, H), width: 92 * S, height: 50 * S }}>
        {/* monitor */}
        <div style={{ position: 'absolute', left: 14 * S, top: 0, width: 56 * S, height: 30 * S, borderRadius: 4,
          background: '#0a0812', border: `1px solid ${accent}55` }}>
          <div style={{ position: 'absolute', inset: 3, borderRadius: 2, background: `${accent}55`,
            animation: working ? 'nyxScreen 1.4s ease-in-out infinite' : 'none', opacity: working ? 1 : 0.5,
            boxShadow: working ? `0 0 18px ${accent}` : 'none' }} />
        </div>
        {/* desk surface */}
        <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0, height: 8 * S, borderRadius: 3,
          background: 'linear-gradient(#3a2c5e, #241a3c)' }} />
        <div style={{ position: 'absolute', bottom: -6, left: 6, width: 5, height: 12 * S, background: '#1c1530' }} />
        <div style={{ position: 'absolute', bottom: -6, right: 6, width: 5, height: 12 * S, background: '#1c1530' }} />
      </div>

      {/* Bean bag */}
      <div onClick={e => flash('Relaxing', e)} title="Bean bag"
        style={{ position: 'absolute', left: px(28, W), bottom: px(10, H), width: 42 * S, height: 30 * S,
          borderRadius: '50% 50% 46% 46%', background: 'radial-gradient(circle at 40% 30%, #4a3570, #241a3c)',
          border: '1px solid rgba(140,100,255,0.2)' }} />

      {/* Shelf with books */}
      <div onClick={e => flash('Knowledge', e)} title="Bookshelf"
        style={{ position: 'absolute', right: px(3, W), bottom: px(22, H), width: 26 * S, height: 66 * S,
          background: 'linear-gradient(#241a3c, #17102a)', borderRadius: 4, border: '1px solid rgba(140,100,255,0.18)',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', padding: 3 }}>
        {[['#B96CFF', 8], ['#7AA7FF', 5], ['#8F5CFF', 9], ['#FF7742', 6]].map(([c, h], i) => (
          <div key={i} style={{ display: 'flex', gap: 2 }}>
            {[0,1,2].map(j => <div key={j} style={{ flex: 1, height: 5 + (j % 2) * 2, background: c, opacity: 0.7, borderRadius: 1 }} />)}
          </div>
        ))}
      </div>

      {/* Plant */}
      <div onClick={e => flash('Watering the plant', e)} title="Plant"
        style={{ position: 'absolute', left: px(2, W), bottom: px(14, H), width: 22 * S, height: 30 * S }}>
        <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 14 * S, height: 12 * S,
          background: '#3a2c5e', borderRadius: '3px 3px 6px 6px' }} />
        <div style={{ position: 'absolute', bottom: 8 * S, left: '50%', transform: 'translateX(-50%)', width: 20 * S, height: 20 * S,
          borderRadius: '60% 40% 55% 45%', background: 'radial-gradient(circle at 40% 30%, #4caf7a, #1f5e3f)' }} />
      </div>

      {/* Lamp with warm glow */}
      <div title="Lamp" style={{ position: 'absolute', left: px(44, W), bottom: px(20, H), width: 18 * S, height: 40 * S }}>
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 16 * S, height: 12 * S,
          borderRadius: '8px 8px 3px 3px', background: 'linear-gradient(#c9a8ff, #7b4dff)',
          boxShadow: `0 0 26px ${accent}aa`, animation: 'nyxLampFlicker 5s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 3, height: 26 * S, background: '#2a2142' }} />
      </div>

      {/* ── The agent character ── */}
      <div onClick={wave}
        style={{ position: 'absolute', left: `${spot.x}%`, top: `${spot.y}%`,
          transform: 'translate(-50%,-100%)', transition: 'left 2s ease, top 2s ease', zIndex: 6 }}>
        <Character accent={accent} pose={pose} working={working} waving={waving} />
      </div>

      {/* ── Ambient particles ── */}
      {[...Array(big ? 10 : 4)].map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: `${(i * 37 + 12) % 92}%`, bottom: `${(i * 23) % 40 + 6}%`,
          width: 3, height: 3, borderRadius: '50%', background: accent, opacity: 0.5,
          animation: `nyxParticle ${4 + (i % 4)}s ease-in-out ${i * 0.6}s infinite` }} />
      ))}
      {/* breathing glow */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(60% 50% at 50% 90%, ${accent}18, transparent 70%)`,
        animation: 'nyxBreathe 6s ease-in-out infinite' }} />

      {/* ── Minimal UI overlay ── */}
      <div style={{ position: 'absolute', top: 12, left: 14, ...MONO, fontSize: big ? 10 : 8, letterSpacing: '0.22em',
        color: '#B9A6FF', textShadow: '0 1px 6px #000' }}>ROOM — {agent.name.toUpperCase()}</div>
      <div style={{ position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center',
        ...RAJ, fontSize: big ? 15 : 11, fontWeight: 600, letterSpacing: '0.04em',
        color: working ? accent : '#EDE8FF', textShadow: '0 1px 8px #000', pointerEvents: 'none' }}>
        {activity}{working ? '' : '…'}
      </div>
    </div>
  )
}

// ── Side panel ─────────────────────────────────────────────────────────
function AgentPanel({ agentId, onClose, onChanged }) {
  const [agent, setAgent] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const load = useCallback(() => {
    fetch(`${API_URL}/api/agents/${agentId}`).then(r => r.json()).then(setAgent).catch(() => {})
  }, [agentId])

  useEffect(() => {
    load()
    const id = setInterval(load, 3000)
    return () => clearInterval(id)
  }, [load])

  const assign = async () => {
    const task = prompt(`Assign a task to ${agent.name} — it runs for real via OpenClaw.\nTry: "take a screenshot", "what's using my cpu", "open notepad"`)
    if (!task || !task.trim()) return
    setBusy(true); setResult(null)
    try {
      const res = await fetch(`${API_URL}/api/agents/${agentId}/task`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: task.trim() }),
      })
      const data = await res.json()
      setResult(res.ok ? data.result : (data.detail || 'Task failed'))
    } catch (e) {
      setResult(String(e.message || e))
    } finally {
      setBusy(false); load(); onChanged?.()
    }
  }

  const rename = async () => {
    const name = prompt('Rename agent:', agent.name)
    if (name && name.trim()) {
      await fetch(`${API_URL}/api/agents/${agentId}`, { method: 'PUT',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) })
      load(); onChanged?.()
    }
  }

  const remove = async () => {
    if (!confirm(`Remove ${agent.name}?`)) return
    const r = await fetch(`${API_URL}/api/agents/${agentId}`, { method: 'DELETE' })
    if (r.ok) { onChanged?.(); onClose() } else alert("This agent can't be removed.")
  }

  if (!agent) return null
  const accent = agent.accent || '#7B4DFF'
  const row = (k, v) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0',
      borderBottom: '1px solid rgba(140,100,255,0.1)' }}>
      <span style={{ ...MONO, fontSize: 10, color: '#8E86B8' }}>{k}</span>
      <span style={{ ...MONO, fontSize: 10, color: '#EDE8FF', maxWidth: 170, textAlign: 'right',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
    </div>
  )

  return (
    <div style={{ width: 300, flexShrink: 0, borderLeft: '1px solid rgba(140,100,255,0.18)',
      padding: '20px 18px', overflowY: 'auto', height: '100%', background: 'rgba(8,6,20,0.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: `${accent}33`,
          border: `1px solid ${accent}88`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accent }}>◎</div>
        <div style={{ flex: 1 }}>
          <div style={{ ...RAJ, fontSize: 18, fontWeight: 700, color: '#F3EDFF' }}>{agent.name}</div>
          <div style={{ ...MONO, fontSize: 9, color: '#8E86B8' }}>{agent.personality}</div>
        </div>
        <div onClick={onClose} style={{ ...MONO, color: '#8E86B8', cursor: 'pointer', fontSize: 14 }}>✕</div>
      </div>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12,
        padding: '4px 10px', borderRadius: 20, background: agent.status === 'Working' ? `${accent}22` : 'rgba(20,14,40,0.6)',
        border: `1px solid ${agent.status === 'Working' ? accent + '77' : 'rgba(140,100,255,0.2)'}` }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: agent.status === 'Working' ? accent : '#22c55e',
          boxShadow: `0 0 8px ${agent.status === 'Working' ? accent : '#22c55e'}` }} />
        <span style={{ ...MONO, fontSize: 10, color: '#E9D8FF' }}>{agent.status}</span>
      </div>

      {row('Model', agent.model)}
      {row('Current task', agent.current_task || '—')}
      {row('Tools', (agent.tools || []).join(', '))}
      {row('OpenClaw', agent.engine === 'openclaw' ? 'built-in tool' : '—')}

      <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
        <div onClick={busy ? undefined : assign} style={{
          ...MONO, flex: 1, textAlign: 'center', fontSize: 10, letterSpacing: '0.12em', color: '#E9D8FF',
          padding: '10px 0', borderRadius: 10, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
          background: `linear-gradient(90deg, ${accent}aa, ${accent}66)`, border: `1px solid ${accent}88` }}>
          {busy ? 'WORKING…' : '⌘ ASSIGN TASK'}
        </div>
        <div onClick={rename} title="Rename" style={{ ...MONO, fontSize: 11, color: '#C7A6FF', cursor: 'pointer',
          padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(140,100,255,0.25)' }}>✎</div>
        {!agent.builtin && (
          <div onClick={remove} title="Remove" style={{ ...MONO, fontSize: 11, color: '#8E86B8', cursor: 'pointer',
            padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(140,100,255,0.25)' }}>✕</div>
        )}
      </div>

      {result && (
        <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 10, background: 'rgba(16,12,38,0.7)',
          border: '1px solid rgba(140,100,255,0.2)', fontSize: 11.5, color: '#D8C9FF', lineHeight: 1.5,
          maxHeight: 160, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>{result}</div>
      )}

      <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.25em', color: '#8E86B8', margin: '6px 0 8px' }}>ACTIVITY</div>
      {(agent.activity || []).length === 0 && (
        <div style={{ ...MONO, fontSize: 10, color: '#5E587A' }}>No activity yet.</div>
      )}
      {(agent.activity || []).map((a, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(140,100,255,0.07)' }}>
          <span style={{ ...MONO, fontSize: 12, color: a.kind === 'error' ? '#FF7AA2' : a.kind === 'result' ? '#22c55e' : accent }}>
            {a.kind === 'task' ? '▸' : a.kind === 'result' ? '✓' : a.kind === 'error' ? '!' : '·'}
          </span>
          <div style={{ flex: 1, fontSize: 11, color: '#B9A6FF', overflow: 'hidden' }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.text}</div>
            <div style={{ ...MONO, fontSize: 8, color: '#5E587A' }}>
              {new Date(a.time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────
export default function AgentsPage() {
  const [agents, setAgents]   = useState([])
  const [online, setOnline]   = useState(false)
  const [selected, setSelected] = useState(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [busy, setBusy]       = useState(false)
  const [toast, setToast]     = useState(null)
  const [dims, setDims]       = useState({ w: 0, h: 0 })
  const facilityRef           = useRef(null)

  // Measure the facility area so the PixiJS canvas fills it and stays crisp
  useEffect(() => {
    const el = facilityRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setDims({ w: Math.max(320, Math.round(r.width)), h: Math.max(240, Math.round(r.height)) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const load = useCallback(() => {
    fetch(`${API_URL}/api/agents`).then(r => r.json()).then(d => {
      setAgents(d.agents || [])
      setOnline(d.openclaw_online)
      setSelected(s => s || (d.agents?.[0]?.id ?? null))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 3000)
    return () => clearInterval(id)
  }, [load])

  const single = agents.length === 1
  const focused = agents.find(a => a.id === selected)

  const deploy = async () => {
    const name = prompt('Deploy a new agent — name:')
    if (!name || !name.trim()) return
    const personality = prompt('Personality (e.g. Focused, Playful, Quiet):', 'Curious') || 'Curious'
    const r = await fetch(`${API_URL}/api/agents`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), personality }) })
    const a = await r.json()
    load(); setSelected(a.id)
    setZoom(z => Math.max(0.55, z - 0.12))   // camera pulls back as the facility grows
  }

  const assignTask = async () => {
    if (!focused) return
    const task = prompt(`Assign a task to ${focused.name} — it runs for real via OpenClaw.\nTry: "take a screenshot", "what's using my cpu", "open notepad"`)
    if (!task || !task.trim()) return
    setBusy(true); setToast(`${focused.name} is working…`)
    try {
      const res = await fetch(`${API_URL}/api/agents/${focused.id}/task`, { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task: task.trim() }) })
      const data = await res.json()
      setToast(res.ok ? data.result : (data.detail || 'Task failed'))
    } catch (e) { setToast(String(e.message || e)) }
    finally { setBusy(false); load() }
  }

  const roomSettings = async () => {
    if (!focused) return
    const name = prompt('Room settings — rename this agent:', focused.name)
    if (name && name.trim()) {
      await fetch(`${API_URL}/api/agents/${focused.id}`, { method: 'PUT',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) })
      load()
    }
  }

  const ctrl = (label, onClick, primary) => (
    <div onClick={busy && primary ? undefined : onClick} style={{
      ...MONO, fontSize: 10, letterSpacing: '0.14em', cursor: busy && primary ? 'default' : 'pointer',
      padding: '9px 18px', borderRadius: 20, userSelect: 'none',
      color: primary ? '#E9D8FF' : '#B9A6FF',
      background: primary ? 'linear-gradient(90deg, rgba(123,77,255,0.55), rgba(185,108,255,0.4))' : 'rgba(14,10,30,0.7)',
      border: `1px solid ${primary ? 'rgba(199,166,255,0.5)' : 'rgba(140,100,255,0.25)'}`,
      opacity: busy && primary ? 0.6 : 1, backdropFilter: 'blur(8px)',
    }}>{label}</div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {/* Slim top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px' }}>
          <div style={{ ...RAJ, fontSize: 22, fontWeight: 700, letterSpacing: '0.14em', color: '#F3EDFF',
            textShadow: '0 0 22px rgba(199,166,255,0.35)' }}>AGENTS</div>
          <div style={{ ...MONO, fontSize: 9, color: '#8E86B8' }}>
            {agents.length} · OpenClaw {online ? 'online' : 'via Ollama'}
          </div>
          <div style={{ flex: 1 }} />
          <div onClick={deploy} style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: '#E9D8FF', cursor: 'pointer',
            padding: '8px 14px', borderRadius: 10, background: 'linear-gradient(90deg, rgba(123,77,255,0.5), rgba(185,108,255,0.38))',
            border: '1px solid rgba(170,120,255,0.5)' }}>+ DEPLOY</div>
        </div>

        {/* Top-down neon facility — fills the area, pans/zooms itself */}
        <div ref={facilityRef} style={{ flex: 1, overflow: 'hidden', padding: 14 }}>
          {dims.w > 0 && agents.length > 0 && (
            <FacilityView agents={agents} width={dims.w - 28} height={dims.h - 28}
              selected={selected} onSelect={setSelected} />
          )}
        </div>

        {/* Minimal bottom controls — act on the focused agent */}
        {focused && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: '4px 0 20px' }}>
            {ctrl('◉ Observe', () => setPanelOpen(true))}
            {ctrl(busy ? 'Working…' : '⌘ Assign Task', assignTask, true)}
            {ctrl('⚙ Room Settings', roomSettings)}
          </div>
        )}

        {/* Task result toast */}
        {toast && (
          <div onClick={() => setToast(null)} style={{ position: 'absolute', left: '50%', bottom: 72,
            transform: 'translateX(-50%)', maxWidth: 460, cursor: 'pointer',
            background: 'rgba(12,10,30,0.96)', border: '1px solid rgba(150,110,255,0.3)', borderRadius: 12,
            padding: '10px 16px', fontSize: 12, color: '#D8C9FF', lineHeight: 1.5, whiteSpace: 'pre-wrap',
            maxHeight: 180, overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', zIndex: 20 }}>
            {toast}
          </div>
        )}
      </div>

      {panelOpen && focused && (
        <AgentPanel agentId={focused.id} onClose={() => setPanelOpen(false)} onChanged={load} />
      )}
    </div>
  )
}
