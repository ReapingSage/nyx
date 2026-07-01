import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getModelsStatus, getModelsList, getRecommendedModels,
  assignModelRole, deleteModel, pullModel,
} from '../services/api.js'

// ── Shared styles — matches SettingsPage / NYX design language ──
const PANEL = {
  background: 'rgba(4,5,18,0.78)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(var(--color-primary-rgb), 0.16)',
  borderRadius: 16,
  padding: '18px 20px',
  marginBottom: 14,
  boxShadow: '0 0 24px rgba(var(--color-primary-rgb), 0.07), inset 0 1px 0 rgba(255,255,255,0.04)',
}
const SEC_TITLE = {
  fontFamily: 'Rajdhani, sans-serif',
  fontSize: 9, fontWeight: 700,
  letterSpacing: '0.26em', textTransform: 'uppercase',
  color: 'var(--color-text-disabled)', display: 'block', marginBottom: 16,
}
const PRIMARY_BTN = {
  fontFamily: 'Rajdhani, sans-serif', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.14em', textTransform: 'uppercase',
  color: '#fff', background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
  border: 'none', borderRadius: 8, padding: '9px 16px', cursor: 'pointer',
  boxShadow: '0 0 18px rgba(var(--color-primary-rgb),0.35)',
  transition: 'all 0.2s', whiteSpace: 'nowrap',
}
const SECONDARY_BTN = {
  fontFamily: 'Rajdhani, sans-serif', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.14em', textTransform: 'uppercase',
  color: 'var(--color-text-muted)', background: 'transparent',
  border: '1px solid rgba(var(--color-primary-rgb),0.25)', borderRadius: 8,
  padding: '9px 16px', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
}
const DANGER_BTN = {
  ...SECONDARY_BTN, color: '#f87171', borderColor: 'rgba(248,113,113,0.3)',
}

const ROLE_DEFS = [
  { id: 'main',   label: 'Main AI' },
  { id: 'coding', label: 'Coding AI' },
  { id: 'fast',   label: 'Fast / Light AI' },
]

function formatBytes(n) {
  if (!n) return '—'
  const gb = n / 1e9
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${(n / 1e6).toFixed(0)} MB`
}

function StatusDot({ ok }) {
  const color = ok ? '#22c55e' : '#f87171'
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, display: 'inline-block' }} />
}

// ── Not installed / not running state ──────────────────────────
function OllamaUnavailablePanel({ status, onRecheck, checking }) {
  const notInstalled = !status?.installed
  return (
    <div style={PANEL}>
      <span style={SEC_TITLE}>{notInstalled ? 'OLLAMA NOT DETECTED' : 'OLLAMA NOT RUNNING'}</span>
      <p style={{
        fontFamily: 'Exo 2, sans-serif', fontSize: 13, color: 'var(--color-text-secondary)',
        lineHeight: 1.6, marginBottom: 18, maxWidth: 560,
      }}>
        {notInstalled
          ? "NYX uses Ollama to run AI models locally on your machine, but Ollama doesn't appear to be installed. Install it, then re-check from here."
          : 'Ollama is installed but the service isn\'t responding. Make sure it\'s running, then re-check.'}
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        {notInstalled && (
          <button style={PRIMARY_BTN} onClick={() => window.open(status?.install_url || 'https://ollama.com/download', '_blank')}>
            Download Ollama
          </button>
        )}
        <button style={SECONDARY_BTN} onClick={onRecheck} disabled={checking}>
          {checking ? 'Checking...' : 'Re-check'}
        </button>
      </div>
    </div>
  )
}

// ── Role assignment card ─────────────────────────────────────
function RoleCard({ role, assignedModel, installed, onAssign }) {
  return (
    <div style={{
      flex: 1, minWidth: 180,
      background: 'rgba(8,10,26,0.72)',
      border: '1px solid rgba(120,90,220,0.20)',
      borderRadius: 12, padding: '13px 14px',
    }}>
      <div style={{
        fontFamily: 'Rajdhani, sans-serif', fontSize: 10.5, fontWeight: 700,
        letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-text-muted)',
        marginBottom: 8,
      }}>{role.label}</div>
      <select
        value={assignedModel || ''}
        onChange={e => onAssign(role.id, e.target.value)}
        disabled={installed.length === 0}
        style={{
          width: '100%', padding: '7px 10px',
          background: 'rgba(var(--color-bg-rgb), 0.70)',
          border: '1px solid rgba(var(--color-primary-rgb), 0.22)',
          borderRadius: 7, color: 'var(--color-accent)',
          fontFamily: 'Share Tech Mono', fontSize: 10.5,
          outline: 'none', cursor: 'pointer',
        }}
      >
        {installed.length === 0 && <option value="">No models installed</option>}
        {installed.map(m => (
          <option key={m.name} value={m.name} style={{ background: '#050716', color: '#C7A6FF' }}>{m.name}</option>
        ))}
      </select>
    </div>
  )
}

// ── Installed model row ──────────────────────────────────────
function ModelRow({ model, assignments, onCopy, onDelete, copied, deleting }) {
  const activeRoles = ROLE_DEFS.filter(r => assignments[r.id] === model.name)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 14px', borderRadius: 10,
      background: 'rgba(8,10,26,0.55)',
      border: '1px solid rgba(120,90,220,0.14)',
      marginBottom: 8,
    }}>
      <StatusDot ok={true} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'Share Tech Mono', fontSize: 12, color: 'var(--color-text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{model.name}</div>
        <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'var(--color-text-disabled)', marginTop: 2 }}>
          {formatBytes(model.size)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {activeRoles.length > 0 ? activeRoles.map(r => (
          <span key={r.id} style={{
            fontFamily: 'Rajdhani, sans-serif', fontSize: 8.5, fontWeight: 700,
            letterSpacing: '0.10em', textTransform: 'uppercase',
            color: 'var(--color-accent)', background: 'rgba(var(--color-primary-rgb),0.18)',
            border: '1px solid rgba(var(--color-primary-rgb),0.30)',
            borderRadius: 5, padding: '3px 7px',
          }}>{r.label}</span>
        )) : (
          <span style={{
            fontFamily: 'Rajdhani, sans-serif', fontSize: 8.5, fontWeight: 700,
            letterSpacing: '0.10em', textTransform: 'uppercase',
            color: 'var(--color-text-disabled)', background: 'rgba(100,75,200,0.08)',
            border: '1px solid rgba(100,75,200,0.16)', borderRadius: 5, padding: '3px 7px',
          }}>Installed</span>
        )}
      </div>

      <button
        onClick={() => onCopy(model.name)}
        title="Copy model name"
        style={{ ...SECONDARY_BTN, padding: '6px 10px', fontSize: 9.5 }}
      >{copied ? 'Copied' : 'Copy'}</button>

      <button
        onClick={() => onDelete(model.name)}
        disabled={deleting}
        title="Remove model"
        style={{ ...DANGER_BTN, padding: '6px 10px', fontSize: 9.5 }}
      >{deleting ? 'Removing...' : 'Remove'}</button>
    </div>
  )
}

// ── Recommended (missing) model row ──────────────────────────
function RecommendedRow({ rec, onDownload, isPulling, progress }) {
  const pct = progress?.total ? Math.round((progress.completed / progress.total) * 100) : null

  return (
    <div style={{
      padding: '11px 14px', borderRadius: 10,
      background: 'rgba(8,10,26,0.55)',
      border: '1px solid rgba(120,90,220,0.14)',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 12, color: 'var(--color-text)' }}>{rec.name}</div>
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'var(--color-text-disabled)', marginTop: 2 }}>
            recommended for {rec.role}
          </div>
        </div>
        <button
          onClick={() => onDownload(rec.name)}
          disabled={isPulling}
          style={{ ...PRIMARY_BTN, padding: '7px 14px', fontSize: 10.5 }}
        >{isPulling ? 'Downloading...' : 'Download'}</button>
      </div>

      {isPulling && (
        <div style={{ marginTop: 10 }}>
          <div style={{
            fontFamily: 'Share Tech Mono', fontSize: 9.5, color: 'var(--color-text-muted)', marginBottom: 5,
          }}>
            {progress?.status || 'starting...'}{pct !== null ? ` — ${pct}%` : ''}
          </div>
          {pct !== null && (
            <div style={{ height: 4, borderRadius: 2, background: 'rgba(100,75,200,0.18)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))',
                transition: 'width 0.3s ease',
              }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function ModelManagerPage() {
  const [status, setStatus]           = useState(null)
  const [installed, setInstalled]     = useState([])
  const [assignments, setAssignments] = useState({})
  const [profile, setProfile]         = useState('desktop') // overwritten by server on first load
  const [recommended, setRecommended] = useState([])
  const [loading, setLoading]         = useState(true)
  const [checking, setChecking]       = useState(false)
  const [pullingName, setPullingName] = useState(null)
  const [progress, setProgress]       = useState(null)
  const [copiedName, setCopiedName]   = useState(null)
  const [deletingName, setDeletingName] = useState(null)

  const refresh = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    try {
      const st = await getModelsStatus()
      setStatus(st)
      // Use server-reported profile on first load so laptop-lite users get lite recommendations
      const activeProfile = st.profile || profile
      if (activeProfile !== profile) setProfile(activeProfile)
      if (st.running) {
        const [list, recs] = await Promise.all([
          getModelsList(),
          getRecommendedModels(activeProfile),
        ])
        setInstalled(list.installed || [])
        setAssignments(list.assignments || {})
        setRecommended(recs.missing || [])
      } else {
        setInstalled([])
        setAssignments({})
        setRecommended([])
      }
    } catch {
      setStatus({ installed: false, running: false })
    } finally {
      setLoading(false)
      setChecking(false)
    }
  }, [profile])

  useEffect(() => { refresh() }, [refresh])

  async function handleRecheck() {
    setChecking(true)
    await refresh(false)
  }

  async function handleAssign(role, modelName) {
    const updated = await assignModelRole(role, modelName)
    setAssignments(updated)
  }

  async function handleCopy(name) {
    try { await navigator.clipboard.writeText(name) } catch { /* clipboard unavailable */ }
    setCopiedName(name)
    setTimeout(() => setCopiedName(null), 1500)
  }

  async function handleDelete(name) {
    setDeletingName(name)
    try {
      await deleteModel(name)
      await refresh(false)
    } finally {
      setDeletingName(null)
    }
  }

  async function handleDownload(name) {
    setPullingName(name)
    setProgress({ status: 'starting...' })
    try {
      await pullModel(name, p => setProgress(p))
    } catch (e) {
      setProgress({ status: `error: ${e.message}` })
    }
    setPullingName(null)
    setProgress(null)
    await refresh(false)
  }

  const ollamaReady = status?.running

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{
        flexShrink: 0, padding: '15px 24px 13px',
        borderBottom: '1px solid rgba(var(--color-primary-rgb), 0.12)',
        background: 'rgba(4,5,16,0.50)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', gap: 18,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 19, fontWeight: 700, letterSpacing: '0.30em', textTransform: 'uppercase', color: 'var(--color-accent)', textShadow: '0 0 22px rgba(var(--color-accent-rgb), 0.40)' }}>MODEL MANAGER</span>
            <span style={{ fontFamily: 'Share Tech Mono', fontSize: 8.5, color: 'var(--color-text-disabled)', letterSpacing: '0.14em' }}>OLLAMA MODEL CONTROL</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <StatusDot ok={!!ollamaReady} />
          <span style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'var(--color-text-muted)', letterSpacing: '0.10em' }}>
            {ollamaReady ? 'OLLAMA ONLINE' : 'OLLAMA OFFLINE'}
          </span>
        </div>

        <button onClick={() => refresh()} style={SECONDARY_BTN}>Refresh</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>
        {loading ? (
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--color-text-disabled)' }}>Loading...</div>
        ) : !ollamaReady ? (
          <OllamaUnavailablePanel status={status} onRecheck={handleRecheck} checking={checking} />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="model-manager-content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {/* Role assignment */}
              <div style={PANEL}>
                <span style={SEC_TITLE}>ROLE ASSIGNMENT</span>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {ROLE_DEFS.map(role => (
                    <RoleCard
                      key={role.id}
                      role={role}
                      assignedModel={assignments[role.id]}
                      installed={installed}
                      onAssign={handleAssign}
                    />
                  ))}
                </div>
                {installed.length === 1 && (
                  <div style={{ marginTop: 10, fontFamily: 'Share Tech Mono', fontSize: 9.5, color: 'var(--color-text-disabled)' }}>
                    Only one model installed — it's being used for every role.
                  </div>
                )}
              </div>

              {/* Installed models */}
              <div style={PANEL}>
                <span style={SEC_TITLE}>INSTALLED MODELS ({installed.length})</span>
                {installed.length === 0 ? (
                  <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--color-text-disabled)' }}>
                    No models installed yet. Download one of the recommended models below to get started.
                  </div>
                ) : (
                  installed.map(model => (
                    <ModelRow
                      key={model.name}
                      model={model}
                      assignments={assignments}
                      onCopy={handleCopy}
                      onDelete={handleDelete}
                      copied={copiedName === model.name}
                      deleting={deletingName === model.name}
                    />
                  ))
                )}
              </div>

              {/* Recommended models */}
              <div style={PANEL}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ ...SEC_TITLE, marginBottom: 0 }}>RECOMMENDED MODELS</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['laptop', 'desktop'].map(p => (
                      <button
                        key={p}
                        onClick={() => setProfile(p)}
                        style={{
                          ...SECONDARY_BTN, padding: '5px 12px', fontSize: 9.5,
                          color: profile === p ? 'var(--color-accent)' : 'var(--color-text-muted)',
                          borderColor: profile === p ? 'rgba(var(--color-primary-rgb),0.45)' : 'rgba(var(--color-primary-rgb),0.25)',
                        }}
                      >{p}</button>
                    ))}
                  </div>
                </div>

                {recommended.length === 0 ? (
                  <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--color-text-disabled)' }}>
                    All recommended {profile} models are already installed.
                  </div>
                ) : (
                  recommended.map(rec => (
                    <RecommendedRow
                      key={rec.name}
                      rec={rec}
                      onDownload={handleDownload}
                      isPulling={pullingName === rec.name}
                      progress={pullingName === rec.name ? progress : null}
                    />
                  ))
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
