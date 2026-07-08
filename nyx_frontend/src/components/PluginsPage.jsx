/**
 * PluginsPage.jsx — SageTech MarketPlace
 *
 * NYX's plugin store. NYX ships as a lean core; every optional capability
 * (Music today, more later) is a plugin you install here. Clicking Download
 * installs its Python deps with live progress, flips it on, and reveals its
 * sidebar entry — some plugins ask for a NYX restart to finish.
 *
 * The catalog comes from the SageTech MarketPlace repo (with a bundled
 * fallback), so listings can be updated without shipping a NYX update.
 */

import { useState, useEffect, useCallback } from 'react'
import { getPlugins, installPlugin, uninstallPlugin } from '../services/api.js'

const MONO = { fontFamily: 'Share Tech Mono, monospace' }
const RAJ  = { fontFamily: 'Rajdhani, sans-serif' }

// Icon set keyed by catalog `icon` field (mirrors Sidebar icons)
const ICONS = {
  music: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="26" height="26">
    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
  </svg>,
  plug: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="26" height="26">
    <path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 01-12 0V8zM12 17v5" />
  </svg>,
  agents: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="26" height="26">
    <circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0112 0" /><circle cx="17" cy="10" r="2.2" /><path d="M15 20a5 5 0 016-4" />
  </svg>,
}

function PluginCard({ plugin, onChanged }) {
  const [busy, setBusy]       = useState(false)
  const [progress, setProgress] = useState(null)   // { status, pct, done, error, requires_restart }

  const install = useCallback(async () => {
    setBusy(true); setProgress({ status: 'Starting…', pct: 0 })
    try {
      await installPlugin(plugin.id, (p) => setProgress(p))
    } catch (e) {
      setProgress({ status: `Failed: ${e.message}`, pct: 100, done: true, error: true })
    } finally {
      setBusy(false)
      onChanged()
    }
  }, [plugin.id, onChanged])

  const uninstall = useCallback(async () => {
    if (!confirm(`Remove the ${plugin.name} plugin?`)) return
    setBusy(true)
    try {
      const r = await uninstallPlugin(plugin.id)
      setProgress({ status: r.message, pct: 100, done: true, requires_restart: r.requires_restart })
    } catch (e) {
      setProgress({ status: `Failed: ${e.message}`, done: true, error: true })
    } finally {
      setBusy(false)
      onChanged()
    }
  }, [plugin.id, plugin.name, onChanged])

  const installed = plugin.installed
  const restartNote = progress?.done && progress?.requires_restart

  return (
    <div style={{
      background: 'rgba(12,10,30,0.6)', border: '1px solid rgba(150,110,255,0.22)',
      borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
      boxShadow: installed ? '0 0 24px rgba(123,77,255,0.12)' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 13, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, rgba(123,77,255,0.5), rgba(185,108,255,0.22))',
          border: '1px solid rgba(170,120,255,0.4)', color: '#E9D8FF',
          boxShadow: '0 0 22px rgba(123,77,255,0.25)',
        }}>{ICONS[plugin.icon] || ICONS.plug}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...RAJ, fontSize: 19, fontWeight: 700, color: '#F3EDFF' }}>{plugin.name}</span>
            {installed && (
              <span style={{ ...MONO, fontSize: 8, letterSpacing: '0.12em', color: '#22c55e',
                border: '1px solid rgba(34,197,94,0.4)', borderRadius: 4, padding: '1px 6px' }}>INSTALLED</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#B9A6FF', marginTop: 2 }}>{plugin.tagline}</div>
          <div style={{ ...MONO, fontSize: 9, color: '#5E587A', marginTop: 4 }}>
            v{plugin.version} · {plugin.author} · {plugin.size_mb > 0 ? `${plugin.size_mb} MB` : 'bundled'}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: '#C9BFE8', lineHeight: 1.5 }}>{plugin.description}</div>

      {plugin.features?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {plugin.features.map((f, i) => (
            <div key={i} style={{ fontSize: 11.5, color: '#8E86B8', display: 'flex', gap: 8 }}>
              <span style={{ color: '#B96CFF' }}>▹</span>{f}
            </div>
          ))}
        </div>
      )}

      {/* Progress / status */}
      {progress && (
        <div>
          {!progress.done && (
            <div style={{ height: 5, borderRadius: 3, background: 'rgba(140,100,255,0.16)', overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ width: `${progress.pct || 0}%`, height: '100%',
                background: 'linear-gradient(90deg, #7B4DFF, #B96CFF)', transition: 'width 0.3s ease',
                boxShadow: '0 0 8px rgba(150,90,255,0.6)' }} />
            </div>
          )}
          <div style={{ ...MONO, fontSize: 10, color: progress.error ? '#FF7AA2' : restartNote ? '#FFC876' : '#C7A6FF' }}>
            {progress.status}
          </div>
        </div>
      )}

      {/* Action */}
      <div style={{ marginTop: 'auto', display: 'flex', gap: 10 }}>
        {installed ? (
          <>
            <div style={{
              ...MONO, flex: 1, textAlign: 'center', fontSize: 11, letterSpacing: '0.15em',
              color: '#8E86B8', padding: '10px 0', borderRadius: 10,
              border: '1px solid rgba(140,100,255,0.25)', background: 'rgba(20,14,44,0.5)',
            }}>✓ INSTALLED</div>
            {!plugin.locked && (
              <div onClick={busy ? undefined : uninstall} style={{
                ...MONO, fontSize: 11, letterSpacing: '0.1em', color: '#8E86B8',
                padding: '10px 16px', borderRadius: 10, cursor: busy ? 'default' : 'pointer',
                border: '1px solid rgba(140,100,255,0.25)',
              }}>REMOVE</div>
            )}
          </>
        ) : (
          <div onClick={busy ? undefined : install} style={{
            ...MONO, flex: 1, textAlign: 'center', fontSize: 11, letterSpacing: '0.2em',
            color: '#E9D8FF', padding: '11px 0', borderRadius: 10, cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.6 : 1,
            background: 'linear-gradient(90deg, rgba(123,77,255,0.55), rgba(185,108,255,0.4))',
            border: '1px solid rgba(170,120,255,0.5)',
            boxShadow: busy ? 'none' : '0 0 18px rgba(140,80,255,0.3)',
          }}>{busy ? 'INSTALLING…' : '↓ DOWNLOAD'}</div>
        )}
      </div>
    </div>
  )
}

export default function PluginsPage() {
  const [data, setData] = useState({ marketplace: 'SageTech MarketPlace', plugins: [] })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try { setData(await getPlugins()) } catch { /* offline */ }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const categories = [...new Set(data.plugins.map(p => p.category))]
  const installedCount = data.plugins.filter(p => p.installed).length

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '26px 32px', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, rgba(123,77,255,0.5), rgba(185,108,255,0.25))',
          border: '1px solid rgba(170,120,255,0.4)', color: '#E9D8FF',
          boxShadow: '0 0 30px rgba(123,77,255,0.3)',
        }}>{ICONS.plug}</div>
        <div>
          <div style={{ ...RAJ, fontSize: 30, fontWeight: 700, letterSpacing: '0.1em', color: '#F3EDFF',
            textShadow: '0 0 30px rgba(199,166,255,0.4)' }}>SAGETECH MARKETPLACE</div>
          <div style={{ fontSize: 12, color: '#8E86B8' }}>
            Install only what you need. {installedCount} of {data.plugins.length} plugins installed.
          </div>
        </div>
      </div>

      <div style={{ ...MONO, fontSize: 11, color: '#8E86B8', margin: '14px 0 22px', maxWidth: 620, lineHeight: 1.6 }}>
        NYX is a lean core — everything else is a plugin. Browse below, hit Download, and the capability turns
        on. Some plugins ask for a quick NYX restart to finish.
      </div>

      {loading && <div style={{ ...MONO, fontSize: 12, color: '#5E587A' }}>Loading catalog…</div>}
      {!loading && data.plugins.length === 0 && (
        <div style={{ ...MONO, fontSize: 12, color: '#5E587A' }}>No plugins available right now.</div>
      )}

      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: 28 }}>
          <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.3em', color: '#8E86B8', marginBottom: 14 }}>
            {(cat || 'GENERAL').toUpperCase()}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
            {data.plugins.filter(p => p.category === cat).map(p => (
              <PluginCard key={p.id} plugin={p} onChanged={load} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
