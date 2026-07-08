/**
 * CommandPalette.jsx — NYX Universal Search (Ctrl+K)
 *
 * A floating search bar that opens from anywhere with Ctrl+K (or ⌘K), or by
 * dispatching the `nyx:command-palette` window event. Type to search across
 * pages, your music library, tasks, and marketplace plugins; Enter jumps
 * there (or plays the track). Arrow keys move, Esc closes.
 *
 * Mounted once at the app root so it works on every page.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import * as player from '../utils/musicPlayer.js'
import { getMusicLibrary, getTasks, getPlugins } from '../services/api.js'

const MONO = { fontFamily: 'Share Tech Mono, monospace' }
const RAJ  = { fontFamily: 'Rajdhani, sans-serif' }

// Core pages — always searchable. `keywords` widen what matches each one.
const PAGES = [
  { id: 'dashboard', label: 'Dashboard',  keywords: 'home orb main',                 page: 'dashboard' },
  { id: 'systems',   label: 'Systems',    keywords: 'cpu gpu ram stats performance', page: 'systems' },
  { id: 'tasks',     label: 'Tasks',      keywords: 'todo queue jobs',               page: 'tasks' },
  { id: 'memory',    label: 'Memory',     keywords: 'constellation notes vault',     page: 'memory' },
  { id: 'network',   label: 'Network',    keywords: 'connections providers status',  page: 'network' },
  { id: 'models',    label: 'Models',     keywords: 'ollama llm ai model manager',   page: 'models' },
  { id: 'plugins',   label: 'Plugins',    keywords: 'marketplace sagetech install extensions store', page: 'plugins' },
  { id: 'updates',   label: 'Updates',    keywords: 'events changelog activity',     page: 'updates' },
  { id: 'settings',  label: 'Settings',   keywords: 'preferences config theme voice privacy appearance backup logs', page: 'settings' },
  { id: 'globalview', label: 'Global View', keywords: 'network graph holographic',   page: 'globalview' },
]

function score(hayParts, needle) {
  const hay = hayParts.filter(Boolean).join(' ').toLowerCase()
  if (!hay.includes(needle)) return -1
  const label = (hayParts[0] || '').toLowerCase()
  if (label.startsWith(needle)) return 3
  if (label.includes(needle)) return 2
  return 1
}

export default function CommandPalette({ onNavigate, onOpenCalendar }) {
  const [open, setOpen] = useState(false)
  const [q, setQ]       = useState('')
  const [sel, setSel]   = useState(0)
  const [music, setMusic]     = useState([])
  const [tasks, setTasks]     = useState([])
  const [musicOn, setMusicOn] = useState(false)
  const inputRef = useRef(null)
  const listRef  = useRef(null)

  // Global open: Ctrl/Cmd+K, or a custom event any button can fire
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    const onEvt = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('nyx:command-palette', onEvt)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('nyx:command-palette', onEvt)
    }
  }, [])

  // On open: reset, focus, and pull live data to search
  useEffect(() => {
    if (!open) { setQ(''); setSel(0); return }
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    getPlugins().then(d => {
      const on = (d.plugins || []).some(p => p.id === 'music' && p.installed)
      setMusicOn(on)
      if (on) getMusicLibrary().then(m => setMusic(m.tracks || [])).catch(() => {})
    }).catch(() => {})
    getTasks().then(d => setTasks(d.tasks || [])).catch(() => {})
    return () => clearTimeout(t)
  }, [open])

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const out = []

    // Pages — shown as suggestions even with an empty box
    for (const p of PAGES) {
      if (p.id === 'globalview' && !needle) continue  // keep the empty state tidy
      const s = needle ? score([p.label, p.keywords], needle) : 0
      if (s >= 0) out.push({ key: 'p:' + p.id, group: 'Pages', label: p.label, icon: '▸', s,
        run: () => onNavigate(p.page) })
    }

    if (needle) {
      // Music tracks (only when the Music plugin is installed)
      if (musicOn) {
        for (const t of music) {
          const s = score([t.title, t.artist, t.album], needle)
          if (s >= 0) out.push({ key: 'm:' + t.id, group: 'Music', label: t.title,
            sublabel: t.artist || '', icon: '♪', s,
            run: () => { onNavigate('music'); player.loadLibrary().then(() => player.playTrack(t.id)) } })
        }
      }
      // Tasks
      for (const t of tasks) {
        const s = score([t.name, t.type, t.status], needle)
        if (s >= 0) out.push({ key: 't:' + t.id, group: 'Tasks', label: t.name,
          sublabel: t.status, icon: '☑', s, run: () => onNavigate('tasks') })
      }
      // Quick action: set a reminder from whatever was typed
      out.push({ key: 'act:reminder', group: 'Actions', label: `Set a reminder: “${q.trim()}”`,
        icon: '⏰', s: 0.5, run: () => onOpenCalendar?.() })
    }

    out.sort((a, b) => b.s - a.s)
    return out.slice(0, 12)
  }, [q, music, tasks, musicOn, onNavigate, onOpenCalendar])

  // Typing always jumps selection back to the best (top) match — so Enter
  // hits the most relevant result, not whatever was highlighted before.
  useEffect(() => { setSel(0) }, [q])
  useEffect(() => { setSel(s => Math.max(0, Math.min(s, results.length - 1))) }, [results.length])

  const run = useCallback((r) => { setOpen(false); r?.run?.() }, [])

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); run(results[sel]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  // Keep the highlighted row in view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${sel}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  if (!open) return null

  let lastGroup = null

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(3,2,12,0.6)', backdropFilter: 'blur(6px)',
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        paddingTop: '12vh',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(600px, 92vw)', maxHeight: '70vh', display: 'flex', flexDirection: 'column',
          background: 'rgba(10,8,26,0.97)', border: '1px solid rgba(150,110,255,0.35)',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 20px 70px rgba(0,0,0,0.6), 0 0 40px rgba(110,60,240,0.2)',
        }}
      >
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 18px',
          borderBottom: '1px solid rgba(140,100,255,0.18)' }}>
          <span style={{ fontSize: 16, color: '#B96CFF' }}>⌕</span>
          <input
            ref={inputRef} value={q}
            onChange={e => setQ(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Search NYX — pages, music, tasks…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#EDE8FF', fontSize: 15, ...RAJ, fontWeight: 500 }}
          />
          <span style={{ ...MONO, fontSize: 9, color: '#5E587A', border: '1px solid rgba(140,100,255,0.25)',
            borderRadius: 5, padding: '2px 6px' }}>ESC</span>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: 'auto', padding: '6px 0' }}>
          {results.length === 0 && (
            <div style={{ ...MONO, fontSize: 11, color: '#5E587A', padding: '18px 20px' }}>
              No matches.
            </div>
          )}
          {results.map((r, i) => {
            const header = r.group !== lastGroup ? (lastGroup = r.group) : null
            const active = i === sel
            return (
              <div key={r.key}>
                {header && (
                  <div style={{ ...MONO, fontSize: 8.5, letterSpacing: '0.28em', color: '#5E587A',
                    padding: '8px 20px 4px' }}>{header.toUpperCase()}</div>
                )}
                <div
                  data-idx={i}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => run(r)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '9px 20px',
                    cursor: 'pointer',
                    background: active ? 'rgba(100,50,220,0.22)' : 'transparent',
                    borderLeft: `2px solid ${active ? '#B96CFF' : 'transparent'}`,
                  }}
                >
                  <span style={{ fontSize: 13, color: active ? '#E9D8FF' : '#8E86B8', width: 16, textAlign: 'center' }}>{r.icon}</span>
                  <span style={{ flex: 1, fontSize: 13.5, color: active ? '#F3EDFF' : '#EDE8FF',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                  {r.sublabel && (
                    <span style={{ ...MONO, fontSize: 10, color: '#8E86B8', flexShrink: 0 }}>{r.sublabel}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer hint */}
        <div style={{ display: 'flex', gap: 16, padding: '9px 18px', borderTop: '1px solid rgba(140,100,255,0.14)',
          ...MONO, fontSize: 9, color: '#5E587A' }}>
          <span>↑↓ navigate</span><span>↵ open</span><span>esc close</span>
          <span style={{ marginLeft: 'auto' }}>Ctrl+K anywhere</span>
        </div>
      </div>
    </div>
  )
}
