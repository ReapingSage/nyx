/**
 * MusicPage.jsx — The Forge › Music
 *
 * NYX's local music manager and player. Not Spotify — everything lives on
 * this machine: upload audio, organize the library, build queues and
 * playlists, and control playback here, by quick command, or by voice
 * ("play after dark", "pause the music").
 *
 * Playback itself lives in utils/musicPlayer.js (a singleton outside the
 * React tree) so music keeps playing when you leave this page.
 *
 * Future-ready: extra tabs (Visualizer, Equalizer, AI DJ) are stubbed as
 * SOON; the track schema and layout leave room for lyrics, moods, smart
 * playlists, and streaming sources without a redesign.
 */

import { useState, useEffect, useMemo, useRef, useCallback, useSyncExternalStore } from 'react'
import * as player from '../utils/musicPlayer.js'
import {
  uploadMusic, updateTrack, deleteTrack, createMusicPlaylist, deleteMusicPlaylist,
  addSoundCloud, getWatchFolders, addWatchFolder, removeWatchFolder, scanMusicNow,
  renamePlaylist, addTrackToPlaylist, removeTrackFromPlaylist,
  setPlaylistBanner, clearPlaylistBanner, playlistBannerUrl,
} from '../services/api.js'

const MONO = { fontFamily: 'Share Tech Mono, monospace' }
const RAJ  = { fontFamily: 'Rajdhani, sans-serif' }

const TABS = ['LIBRARY', 'PLAYLISTS', 'UPLOADS', 'LIKES', 'RECENTLY ADDED']
const SOON_TABS = ['VISUALIZER', 'EQUALIZER', 'AI DJ']

// A playlist's banner: its custom upload if set, else the first track's
// artwork (SoundCloud-style), else null (caller renders a gradient).
function playlistBanner(pl, tracks) {
  if (pl.banner) return playlistBannerUrl(pl.id, pl.banner)
  const first = pl.track_ids.map(id => tracks.find(t => t.id === id)).find(Boolean)
  return first?.artwork_url || null
}

const fmtTime = (s) => {
  if (s == null || isNaN(s)) return '--:--'
  s = Math.round(s)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return '' }
}

function usePlayer() {
  useSyncExternalStore(player.subscribe, player.getVersion)
  return player.getState()
}

// Album art — real artwork when we have it (SoundCloud), gradient otherwise
function AlbumArt({ track, size = 34, radius = 6 }) {
  if (track?.artwork_url) {
    return (
      <img src={track.artwork_url} alt="" style={{
        width: size, height: size, borderRadius: radius, flexShrink: 0,
        objectFit: 'cover', border: '1px solid rgba(150,110,255,0.25)',
        boxShadow: size > 100 ? '0 0 40px rgba(123,77,255,0.25)' : 'none',
      }} />
    )
  }
  const hue = track ? (track.title.charCodeAt(0) * 7 + (track.artist?.charCodeAt(0) || 0) * 13) % 60 : 0
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: track
        ? `linear-gradient(135deg, hsl(${255 + hue},70%,22%), hsl(${275 + hue},80%,45%), hsl(${240 + hue},70%,14%))`
        : 'rgba(20,14,44,0.8)',
      border: '1px solid rgba(150,110,255,0.25)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'rgba(233,216,255,0.75)', fontSize: size * 0.4,
      boxShadow: size > 100 ? '0 0 40px rgba(123,77,255,0.25)' : 'none',
    }}>♪</div>
  )
}

const ScBadge = () => (
  <span title="SoundCloud — streams online via the embedded player" style={{
    fontFamily: 'Share Tech Mono, monospace', fontSize: 8, letterSpacing: '0.08em',
    color: '#FF7742', border: '1px solid rgba(255,119,66,0.45)', borderRadius: 4,
    padding: '1px 4px', marginLeft: 6, verticalAlign: 'middle',
  }}>☁ SC</span>
)

// ── Upload panel ──────────────────────────────────────────────────────

function UploadPanel({ onUploaded, compact = false }) {
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg]   = useState('')
  const inputRef = useRef(null)

  const doUpload = useCallback(async (files) => {
    const list = Array.from(files || []).filter(f => f.name)
    if (!list.length) return
    setBusy(true); setMsg(`Uploading ${list.length} file${list.length > 1 ? 's' : ''}…`)
    try {
      const res = await uploadMusic(list)
      const ok = res.added?.length || 0
      const bad = res.errors?.length || 0
      setMsg(`${ok} added${bad ? `, ${bad} failed (${res.errors[0].error})` : ''}`)
      onUploaded()
    } catch (e) {
      setMsg(`Upload failed: ${e.message}`)
    } finally {
      setBusy(false)
      setTimeout(() => setMsg(''), 5000)
    }
  }, [onUploaded])

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); doUpload(e.dataTransfer.files) }}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `1.5px dashed ${drag ? 'rgba(199,166,255,0.9)' : 'rgba(140,100,255,0.35)'}`,
        borderRadius: 16, cursor: 'pointer',
        background: drag ? 'rgba(100,50,220,0.16)' : 'rgba(12,10,30,0.55)',
        padding: compact ? '18px 20px' : '26px 28px',
        display: 'flex', alignItems: 'center', gap: 20,
        transition: 'all 0.2s ease', marginBottom: 18,
        boxShadow: drag ? '0 0 30px rgba(123,77,255,0.25)' : 'none',
      }}
    >
      <input
        ref={inputRef} type="file" multiple accept=".mp3,.flac,.wav,.ogg,.m4a,audio/*"
        style={{ display: 'none' }}
        onChange={e => { doUpload(e.target.files); e.target.value = '' }}
      />
      <div style={{ fontSize: compact ? 26 : 34, filter: 'drop-shadow(0 0 14px rgba(140,80,255,0.7))' }}>☁</div>
      <div style={{ flex: 1 }}>
        <div style={{ ...RAJ, fontSize: 16, fontWeight: 600, color: '#EDE8FF' }}>
          {busy ? 'Uploading…' : 'Drag & Drop audio files here'}
        </div>
        <div style={{ ...MONO, fontSize: 10, color: '#8E86B8', marginTop: 3 }}>
          {msg || 'or click to browse'}
        </div>
      </div>
      <div style={{ ...MONO, fontSize: 9, color: '#5E587A', textAlign: 'right', lineHeight: 1.7 }}>
        Supported: MP3, WAV, FLAC, M4A, OGG<br />Max file size: 200MB
      </div>
    </div>
  )
}

// ── SoundCloud add bar ────────────────────────────────────────────────
// Paste a track/playlist link once → it lives in the library forever and
// replays through SoundCloud's embedded widget (no API key needed).

function SoundCloudAdd({ onAdded }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const add = async () => {
    if (!url.trim()) return
    setBusy(true); setMsg('')
    try {
      const track = await addSoundCloud(url.trim())
      setMsg(`Saved: ${track.title}`)
      setUrl('')
      onAdded()
    } catch (e) {
      setMsg(String(e.message || e))
    } finally {
      setBusy(false)
      setTimeout(() => setMsg(''), 6000)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18,
      border: '1px solid rgba(255,119,66,0.28)', borderRadius: 14,
      background: 'rgba(20,10,8,0.25)', padding: '12px 16px',
    }}>
      <span style={{ fontSize: 18, filter: 'drop-shadow(0 0 10px rgba(255,119,66,0.6))' }}>☁</span>
      <input
        value={url} onChange={e => setUrl(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') add() }}
        placeholder="Paste a SoundCloud track or playlist link — it saves to your library for one-click replay"
        style={{
          flex: 1, minWidth: 0, background: 'rgba(16,12,38,0.8)',
          border: '1px solid rgba(140,100,255,0.25)', borderRadius: 10,
          padding: '9px 12px', color: '#EDE8FF', fontSize: 12, outline: 'none',
        }}
      />
      <div onClick={add} style={{
        ...MONO, fontSize: 10, letterSpacing: '0.2em', cursor: 'pointer',
        color: '#FFD9C7', padding: '9px 16px', borderRadius: 10, userSelect: 'none',
        background: 'linear-gradient(90deg, rgba(255,119,66,0.35), rgba(185,108,255,0.25))',
        border: '1px solid rgba(255,119,66,0.4)', whiteSpace: 'nowrap',
      }}>{busy ? 'RESOLVING…' : 'ADD FROM SOUNDCLOUD'}</div>
      {msg && <div style={{ ...MONO, fontSize: 10, color: msg.startsWith('Saved') ? '#22c55e' : '#FF7AA2', whiteSpace: 'nowrap' }}>{msg}</div>}
    </div>
  )
}

// ── Watch folders panel ───────────────────────────────────────────────
// Point NYX at folders (e.g. Downloads, ~/Music) — new audio dropped there
// auto-imports into the library every 45s. Originals are never touched.

function WatchFolders({ onImported }) {
  const [folders, setFolders] = useState([])
  const [path, setPath] = useState('')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    try { setFolders((await getWatchFolders()).folders) } catch {}
  }, [])
  useEffect(() => { load() }, [load])

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 6000) }

  const add = async () => {
    if (!path.trim()) return
    try {
      const res = await addWatchFolder(path.trim())
      setFolders(res.folders)
      setPath('')
      flash(`Watching. Imported ${res.imported} existing file${res.imported !== 1 ? 's' : ''}.`)
      onImported()
    } catch (e) { flash(String(e.message || e)) }
  }

  const remove = async (f) => {
    try { setFolders((await removeWatchFolder(f)).folders) } catch {}
  }

  const scanNow = async () => {
    try {
      const res = await scanMusicNow()
      flash(`Scan done — ${res.imported} new file${res.imported !== 1 ? 's' : ''}.`)
      if (res.imported) onImported()
    } catch (e) { flash(String(e.message || e)) }
  }

  return (
    <div style={{
      background: 'rgba(12,10,30,0.55)', border: '1px solid rgba(150,110,255,0.2)',
      borderRadius: 14, padding: 16, marginBottom: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.28em', color: '#8E86B8' }}>WATCH FOLDERS</div>
        <div style={{ flex: 1 }} />
        {folders.length > 0 && (
          <div onClick={scanNow} style={{ ...MONO, fontSize: 9, letterSpacing: '0.15em', color: '#C7A6FF', cursor: 'pointer' }}>SCAN NOW</div>
        )}
      </div>
      <div style={{ fontSize: 11, color: '#8E86B8', marginBottom: 10 }}>
        Any audio file saved into these folders auto-imports to your library (checked every 45s). Originals stay where they are.
      </div>
      {folders.map(f => (
        <div key={f} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
          borderRadius: 8, background: 'rgba(16,12,38,0.6)', marginBottom: 5,
          border: '1px solid rgba(140,100,255,0.15)',
        }}>
          <span style={{ fontSize: 12 }}>📁</span>
          <span style={{ ...MONO, fontSize: 11, color: '#B9A6FF', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</span>
          <span onClick={() => remove(f)} style={{ ...MONO, fontSize: 11, color: '#5E587A', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#FF7AA2' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#5E587A' }}
          >✕</span>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input
          value={path} onChange={e => setPath(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add() }}
          placeholder={'e.g. C:\\Users\\you\\Downloads\\Music'}
          style={{
            flex: 1, minWidth: 0, background: 'rgba(16,12,38,0.8)',
            border: '1px solid rgba(140,100,255,0.25)', borderRadius: 10,
            padding: '8px 12px', color: '#EDE8FF', fontSize: 12, outline: 'none',
          }}
        />
        <div onClick={add} style={{
          ...MONO, fontSize: 10, letterSpacing: '0.2em', cursor: 'pointer',
          color: '#E9D8FF', padding: '8px 16px', borderRadius: 10, userSelect: 'none',
          background: 'linear-gradient(90deg, rgba(123,77,255,0.45), rgba(185,108,255,0.35))',
          border: '1px solid rgba(170,120,255,0.45)',
        }}>WATCH</div>
      </div>
      {msg && <div style={{ ...MONO, fontSize: 10, color: '#C7A6FF', marginTop: 8 }}>{msg}</div>}
    </div>
  )
}

// ── Track table ───────────────────────────────────────────────────────

function TrackTable({ tracks, onRefresh }) {
  const st = usePlayer()
  const [sortBy, setSortBy]   = useState('added')
  const [sortDir, setSortDir] = useState(-1)
  const [menuId, setMenuId]   = useState(null)
  const [plMenuId, setPlMenuId] = useState(null)   // which row's "add to playlist" submenu is open

  const like = useCallback(async (t) => {
    await updateTrack(t.id, { favorite: !t.favorite })
    onRefresh()
  }, [onRefresh])

  const addToPlaylist = useCallback(async (t, playlistId) => {
    let pid = playlistId
    if (pid === '__new__') {
      const name = prompt('New playlist name:')
      if (!name) return
      const pl = await createMusicPlaylist(name, [t.id])
      pid = pl.id
    } else {
      await addTrackToPlaylist(pid, t.id)
    }
    player.loadLibrary(); onRefresh(); setMenuId(null); setPlMenuId(null)
  }, [onRefresh])

  const sorted = useMemo(() => {
    const arr = [...tracks]
    arr.sort((a, b) => {
      const va = a[sortBy] ?? '', vb = b[sortBy] ?? ''
      if (typeof va === 'number' || typeof vb === 'number') return ((va || 0) - (vb || 0)) * sortDir
      return String(va).localeCompare(String(vb)) * sortDir
    })
    return arr
  }, [tracks, sortBy, sortDir])

  const header = (label, key, width) => (
    <div
      onClick={() => { sortBy === key ? setSortDir(d => -d) : (setSortBy(key), setSortDir(1)) }}
      style={{ ...MONO, width, flex: width ? undefined : 1, fontSize: 9, letterSpacing: '0.22em',
               color: sortBy === key ? '#C7A6FF' : '#8E86B8', cursor: 'pointer', userSelect: 'none' }}
    >
      {label} {sortBy === key ? (sortDir === 1 ? '▲' : '▼') : ''}
    </div>
  )

  const ids = sorted.map(t => t.id)

  return (
    <div onClick={() => setMenuId(null)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    borderBottom: '1px solid rgba(140,100,255,0.18)' }}>
        <div style={{ width: 34 }} />
        {header('TITLE', 'title')}
        {header('ARTIST', 'artist')}
        {header('ALBUM', 'album')}
        {header('DURATION', 'duration', 70)}
        {header('ADDED', 'added', 90)}
        <div style={{ width: 90 }} />
      </div>

      {sorted.length === 0 && (
        <div style={{ ...MONO, fontSize: 11, color: '#5E587A', padding: '28px 14px' }}>
          No tracks here yet — upload something above.
        </div>
      )}

      {sorted.map(t => {
        const isCurrent = st.currentId === t.id
        return (
          <div
            key={t.id}
            onDoubleClick={() => player.playTrack(t.id, ids)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px',
              borderBottom: '1px solid rgba(140,100,255,0.08)',
              background: isCurrent ? 'rgba(100,50,220,0.16)' : 'transparent',
              borderLeft: `2px solid ${isCurrent ? 'var(--color-accent, #B96CFF)' : 'transparent'}`,
              cursor: 'default', position: 'relative',
            }}
            onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = 'rgba(80,40,180,0.10)' }}
            onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent' }}
          >
            <AlbumArt track={t} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: isCurrent ? '#E9D8FF' : '#EDE8FF', overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.title} {t.favorite && <span style={{ color: '#B96CFF' }}>♥</span>}
                {t.source === 'soundcloud' && <ScBadge />}
              </div>
            </div>
            <div style={{ flex: 1, fontSize: 12, color: '#B9A6FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.artist || '—'}</div>
            <div style={{ flex: 1, fontSize: 12, color: '#8E86B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.album || '—'}</div>
            <div style={{ ...MONO, width: 70, fontSize: 11, color: '#8E86B8' }}>{fmtTime(t.duration)}</div>
            <div style={{ ...MONO, width: 90, fontSize: 10, color: '#8E86B8' }}>{fmtDate(t.added)}</div>

            <div style={{ width: 90, display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
              <div
                title={t.favorite ? 'Unlike' : 'Like'}
                onClick={e => { e.stopPropagation(); like(t) }}
                style={{ color: t.favorite ? '#FF6B9D' : '#8E86B8', cursor: 'pointer', fontSize: 14,
                  textShadow: t.favorite ? '0 0 8px rgba(255,107,157,0.7)' : 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => { if (!t.favorite) e.currentTarget.style.color = '#FF6B9D' }}
                onMouseLeave={e => { if (!t.favorite) e.currentTarget.style.color = '#8E86B8' }}
              >{t.favorite ? '♥' : '♡'}</div>
              <div
                title="Play"
                onClick={() => player.playTrack(t.id, ids)}
                style={{ color: '#C7A6FF', cursor: 'pointer', fontSize: 13 }}
              >▶</div>
              <div
                title="More"
                onClick={e => { e.stopPropagation(); setPlMenuId(null); setMenuId(menuId === t.id ? null : t.id) }}
                style={{ color: '#8E86B8', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}
              >⋮</div>
            </div>

            {menuId === t.id && (
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'absolute', right: 14, top: '80%', zIndex: 50,
                  background: 'rgba(14,10,34,0.98)', border: '1px solid rgba(150,110,255,0.35)',
                  borderRadius: 10, overflow: 'visible', minWidth: 168,
                  boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
                }}>
                {[
                  ['▶ Play next', () => { setMenuId(null); player.playNextInQueue(t.id) }],
                  ['+ Add to queue', () => { setMenuId(null); player.addToQueue(t.id) }],
                  [t.favorite ? '♥ Unlike' : '♡ Like', () => { setMenuId(null); like(t) }],
                ].map(([label, fn]) => (
                  <div key={label} onClick={fn}
                    style={{ ...MONO, fontSize: 11, color: '#C7A6FF', padding: '9px 14px', cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(100,50,220,0.25)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >{label}</div>
                ))}
                {/* Add to playlist (expandable) */}
                <div
                  onClick={() => setPlMenuId(plMenuId === t.id ? null : t.id)}
                  style={{ ...MONO, fontSize: 11, color: '#C7A6FF', padding: '9px 14px', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(100,50,220,0.25)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >≡ Add to playlist <span>{plMenuId === t.id ? '▾' : '▸'}</span></div>
                {plMenuId === t.id && (
                  <div style={{ borderTop: '1px solid rgba(140,100,255,0.15)', maxHeight: 180, overflowY: 'auto' }}>
                    <div onClick={() => addToPlaylist(t, '__new__')}
                      style={{ ...MONO, fontSize: 10.5, color: '#E9D8FF', padding: '8px 18px', cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(100,50,220,0.25)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >+ New playlist…</div>
                    {st.playlists.map(pl => (
                      <div key={pl.id} onClick={() => addToPlaylist(t, pl.id)}
                        style={{ ...MONO, fontSize: 10.5, color: '#B9A6FF', padding: '8px 18px', cursor: 'pointer',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(100,50,220,0.25)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >{pl.track_ids.includes(t.id) ? '✓ ' : ''}{pl.name}</div>
                    ))}
                  </div>
                )}
                <div onClick={async () => {
                    setMenuId(null)
                    if (confirm(`Delete "${t.title}" from your library?`)) { await deleteTrack(t.id); player.loadLibrary(); onRefresh() }
                  }}
                  style={{ ...MONO, fontSize: 11, color: '#FF7AA2', padding: '9px 14px', cursor: 'pointer',
                    borderTop: '1px solid rgba(140,100,255,0.15)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(120,40,60,0.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >✕ Delete</div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Now Playing panel ─────────────────────────────────────────────────

function NowPlaying() {
  const st = usePlayer()
  const track = player.currentTrack()
  const barRef = useRef(null)

  const onSeek = (e) => {
    if (!barRef.current || !st.duration) return
    const rect = barRef.current.getBoundingClientRect()
    player.seek(((e.clientX - rect.left) / rect.width) * st.duration)
  }

  const btn = (label, onClick, opts = {}) => (
    <div title={opts.title} onClick={onClick} style={{
      width: opts.big ? 52 : 36, height: opts.big ? 52 : 36, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: opts.big ? 18 : 13, cursor: 'pointer', userSelect: 'none',
      color: opts.on ? '#E9D8FF' : '#8E86B8',
      background: opts.big ? 'linear-gradient(135deg, rgba(123,77,255,0.85), rgba(185,108,255,0.7))'
                : opts.on ? 'rgba(100,50,220,0.3)' : 'transparent',
      border: opts.big ? '1px solid rgba(199,166,255,0.6)' : '1px solid transparent',
      boxShadow: opts.big ? '0 0 26px rgba(140,65,255,0.5)' : 'none',
      transition: 'all 0.2s ease',
    }}
      onMouseEnter={e => { if (!opts.big) e.currentTarget.style.color = '#E9D8FF' }}
      onMouseLeave={e => { if (!opts.big) e.currentTarget.style.color = opts.on ? '#E9D8FF' : '#8E86B8' }}
    >{label}</div>
  )

  const pct = st.duration ? (st.currentTime / st.duration) * 100 : 0

  return (
    <div style={{
      background: 'rgba(12,10,30,0.6)', border: '1px solid rgba(150,110,255,0.22)',
      borderRadius: 16, padding: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.28em', color: '#8E86B8' }}>NOW PLAYING</div>
        <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.2em', color: '#22c55e' }}>● NYX PLAYER</div>
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
        <AlbumArt track={track} size={92} radius={12} />
        <div style={{ minWidth: 0 }}>
          <div style={{ ...RAJ, fontSize: 18, fontWeight: 700, color: '#F3EDFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {track ? track.title : 'Nothing playing'}
          </div>
          <div style={{ fontSize: 12, color: '#B9A6FF', marginTop: 2 }}>{track?.artist || '—'}</div>
          <div style={{ fontSize: 11, color: '#8E86B8', marginTop: 1 }}>{track?.album || ''}</div>
        </div>
      </div>

      {/* Progress */}
      <div ref={barRef} onClick={onSeek} style={{ height: 5, borderRadius: 3, background: 'rgba(140,100,255,0.16)', cursor: 'pointer', position: 'relative' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 3,
          background: 'linear-gradient(90deg, #7B4DFF, #B96CFF)',
          boxShadow: '0 0 10px rgba(150,90,255,0.7)',
          transition: 'width 0.2s linear',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
        <span style={{ ...MONO, fontSize: 9, color: '#8E86B8' }}>{fmtTime(st.currentTime)}</span>
        <span style={{ ...MONO, fontSize: 9, color: '#8E86B8' }}>{fmtTime(st.duration)}</span>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 10 }}>
        {btn('⤨', player.toggleShuffle, { on: st.shuffle, title: 'Shuffle' })}
        {btn('⏮', player.previous, { title: 'Previous' })}
        {btn(st.playing && !st.paused ? '❚❚' : '▶', player.toggle, { big: true, title: 'Play/Pause' })}
        {btn('⏭', player.next, { title: 'Next' })}
        {btn(st.repeat === 'one' ? '🔂' : '🔁', player.cycleRepeat, { on: st.repeat !== 'off', title: `Repeat: ${st.repeat}` })}
      </div>

      {/* Volume */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <div onClick={player.toggleMute} style={{ cursor: 'pointer', fontSize: 13, color: st.muted ? '#5E587A' : '#8E86B8' }}>
          {st.muted ? '🔇' : '🔊'}
        </div>
        <input
          type="range" min="0" max="100" value={st.muted ? 0 : Math.round(st.volume * 100)}
          onChange={e => player.setVolume(Number(e.target.value) / 100)}
          style={{ flex: 1, accentColor: '#9d4dff', height: 4 }}
        />
        <div style={{ ...MONO, fontSize: 9, color: '#8E86B8', width: 28, textAlign: 'right' }}>
          {st.muted ? 0 : Math.round(st.volume * 100)}%
        </div>
      </div>
    </div>
  )
}

// ── Play Queue panel ──────────────────────────────────────────────────

function PlayQueue({ onRefresh }) {
  const st = usePlayer()
  return (
    <div style={{
      background: 'rgba(12,10,30,0.6)', border: '1px solid rgba(150,110,255,0.22)',
      borderRadius: 16, padding: 16, marginTop: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.28em', color: '#8E86B8' }}>PLAY QUEUE</div>
        <div style={{ display: 'flex', gap: 12 }}>
          {st.queue.length > 0 && (
            <div
              onClick={async () => {
                const name = prompt('Playlist name:')
                if (name) { await createMusicPlaylist(name, st.queue); player.loadLibrary(); onRefresh() }
              }}
              style={{ ...MONO, fontSize: 9, letterSpacing: '0.15em', color: '#C7A6FF', cursor: 'pointer' }}
            >SAVE</div>
          )}
          <div onClick={player.clearQueue} style={{ ...MONO, fontSize: 9, letterSpacing: '0.15em', color: '#C7A6FF', cursor: 'pointer' }}>CLEAR</div>
        </div>
      </div>

      {st.queue.length === 0 && (
        <div style={{ ...MONO, fontSize: 10, color: '#5E587A' }}>Queue is empty.</div>
      )}
      <div style={{ maxHeight: 210, overflowY: 'auto' }}>
        {st.queue.map((id, i) => {
          const t = player.getTrack(id)
          if (!t) return null
          const isCurrent = i === st.qIndex
          return (
            <div key={`${id}-${i}`}
              onDoubleClick={() => player.jumpToQueueIndex(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px',
                borderRadius: 8, marginBottom: 3,
                background: isCurrent ? 'rgba(100,50,220,0.2)' : 'transparent',
                borderLeft: `2px solid ${isCurrent ? '#B96CFF' : 'transparent'}`,
              }}>
              <div style={{ ...MONO, fontSize: 10, color: isCurrent ? '#C7A6FF' : '#5E587A', width: 16 }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#EDE8FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                <div style={{ fontSize: 10, color: '#8E86B8' }}>{t.artist || '—'}</div>
              </div>
              <div style={{ ...MONO, fontSize: 10, color: '#8E86B8' }}>{fmtTime(t.duration)}</div>
              <div onClick={() => player.removeFromQueue(i)}
                style={{ ...MONO, color: '#5E587A', cursor: 'pointer', fontSize: 11 }}
                onMouseEnter={e => { e.currentTarget.style.color = '#FF7AA2' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#5E587A' }}
              >✕</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Quick commands ────────────────────────────────────────────────────

function QuickCommands() {
  const st = usePlayer()
  const cmds = [
    ['Play my liked songs', () => player.playFavorites(true)],
    ['Shuffle everything', player.shuffleAll],
    ['Play something relaxing', player.shuffleAll],
    ['Skip this song', player.next],
    ['Lower the volume', () => player.setVolume(st.volume - 0.15)],
    [st.muted ? 'Unmute' : 'Mute', player.toggleMute],
    [st.paused || !st.playing ? 'Resume music' : 'Pause music', player.toggle],
    ['Stop after queue', () => {}],
  ]
  return (
    <div style={{
      background: 'rgba(12,10,30,0.6)', border: '1px solid rgba(150,110,255,0.22)',
      borderRadius: 16, padding: 16, marginTop: 14,
    }}>
      <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.28em', color: '#8E86B8', marginBottom: 4 }}>NYX MUSIC CONTROL</div>
      <div style={{ fontSize: 11, color: '#8E86B8', marginBottom: 10 }}>You can ask me to play music.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {cmds.map(([label, fn]) => (
          <div key={label} onClick={fn} style={{
            ...MONO, fontSize: 10, color: '#C7A6FF', cursor: 'pointer',
            border: '1px solid rgba(140,100,255,0.22)', borderRadius: 10,
            padding: '9px 10px', display: 'flex', justifyContent: 'space-between',
            background: 'rgba(16,12,38,0.5)', transition: 'all 0.2s ease',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(194,155,255,0.6)'; e.currentTarget.style.background = 'rgba(80,40,180,0.18)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(140,100,255,0.22)'; e.currentTarget.style.background = 'rgba(16,12,38,0.5)' }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
            <span>→</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Playlists tab ─────────────────────────────────────────────────────

// Banner element — custom image, first-song artwork, or a gradient fallback.
function Banner({ pl, tracks, height, radius = 12, children }) {
  const url = playlistBanner(pl, tracks)
  const hue = (pl.name.charCodeAt(0) * 11) % 60
  return (
    <div style={{
      height, borderRadius: radius, position: 'relative', overflow: 'hidden',
      background: url
        ? `linear-gradient(to top, rgba(6,4,18,0.85), rgba(6,4,18,0.15)), url("${url}") center/cover`
        : `linear-gradient(135deg, hsl(${255 + hue},65%,20%), hsl(${280 + hue},75%,42%), hsl(${240 + hue},60%,12%))`,
      border: '1px solid rgba(150,110,255,0.25)',
      display: 'flex', alignItems: 'flex-end',
    }}>
      {!url && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: height * 0.4, color: 'rgba(233,216,255,0.3)' }}>♪</div>
      )}
      {children}
    </div>
  )
}

function PlaylistDetail({ pl, onBack, onRefresh }) {
  const st = usePlayer()
  const fresh = st.playlists.find(p => p.id === pl.id) || pl
  const bannerInputRef = useRef(null)
  const tracks = fresh.track_ids.map(id => st.tracks.find(t => t.id === id)).filter(Boolean)

  const uploadBanner = async (file) => {
    if (!file) return
    try { await setPlaylistBanner(fresh.id, file); player.loadLibrary(); onRefresh() } catch (e) { alert(e.message) }
  }
  const rename = async () => {
    const name = prompt('Rename playlist:', fresh.name)
    if (name && name.trim()) { await renamePlaylist(fresh.id, name.trim()); player.loadLibrary(); onRefresh() }
  }

  return (
    <div style={{ padding: '10px 0' }}>
      <div onClick={onBack} style={{ ...MONO, fontSize: 10, letterSpacing: '0.15em', color: '#8E86B8',
        cursor: 'pointer', marginBottom: 12, display: 'inline-block' }}>‹ ALL PLAYLISTS</div>

      <Banner pl={fresh} tracks={st.tracks} height={180} radius={16}>
        <div style={{ padding: 20, width: '100%', display: 'flex', alignItems: 'flex-end', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.3em', color: '#C7A6FF' }}>PLAYLIST</div>
            <div style={{ ...RAJ, fontSize: 30, fontWeight: 700, color: '#F3EDFF', textShadow: '0 2px 20px rgba(0,0,0,0.7)' }}>
              {fresh.name} <span onClick={rename} title="Rename" style={{ fontSize: 14, cursor: 'pointer', color: '#C7A6FF' }}>✎</span>
            </div>
            <div style={{ ...MONO, fontSize: 10, color: '#D8C9FF', marginTop: 2 }}>
              {tracks.length} track{tracks.length !== 1 ? 's' : ''}
            </div>
          </div>
          <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { uploadBanner(e.target.files[0]); e.target.value = '' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <div onClick={() => player.playPlaylistById(fresh.id)} style={{
              ...MONO, fontSize: 10, letterSpacing: '0.15em', color: '#E9D8FF', cursor: 'pointer',
              padding: '9px 18px', borderRadius: 10,
              background: 'linear-gradient(90deg, rgba(123,77,255,0.7), rgba(185,108,255,0.55))',
              border: '1px solid rgba(199,166,255,0.5)',
            }}>▶ PLAY</div>
            <div onClick={() => bannerInputRef.current?.click()} title="Set a custom banner image" style={{
              ...MONO, fontSize: 10, color: '#E9D8FF', cursor: 'pointer', padding: '9px 12px',
              borderRadius: 10, background: 'rgba(10,8,26,0.6)', border: '1px solid rgba(170,120,255,0.4)',
            }}>🖼 BANNER</div>
            {fresh.banner && (
              <div onClick={async () => { await clearPlaylistBanner(fresh.id); player.loadLibrary(); onRefresh() }}
                title="Reset to first-song banner" style={{
                ...MONO, fontSize: 10, color: '#8E86B8', cursor: 'pointer', padding: '9px 12px',
                borderRadius: 10, background: 'rgba(10,8,26,0.6)', border: '1px solid rgba(140,100,255,0.25)',
              }}>↺</div>
            )}
          </div>
        </div>
      </Banner>

      {/* Tracks */}
      <div style={{ marginTop: 16 }}>
        {tracks.length === 0 && (
          <div style={{ ...MONO, fontSize: 11, color: '#5E587A', padding: '20px 4px' }}>
            Empty playlist — add songs from the Library via a track's ⋮ menu → Add to playlist.
          </div>
        )}
        {tracks.map((t, i) => (
          <div key={t.id} onDoubleClick={() => player.playQueue(fresh.track_ids, i)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px',
              borderBottom: '1px solid rgba(140,100,255,0.08)' }}>
            <div style={{ ...MONO, fontSize: 10, color: '#5E587A', width: 18 }}>{i + 1}</div>
            <AlbumArt track={t} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#EDE8FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.title}{t.source === 'soundcloud' && <ScBadge />}</div>
              <div style={{ fontSize: 11, color: '#8E86B8' }}>{t.artist || '—'}</div>
            </div>
            <div onClick={() => player.playQueue(fresh.track_ids, i)} style={{ color: '#C7A6FF', cursor: 'pointer', fontSize: 13 }}>▶</div>
            <div onClick={async () => { await removeTrackFromPlaylist(fresh.id, t.id); player.loadLibrary(); onRefresh() }}
              title="Remove from playlist" style={{ ...MONO, color: '#5E587A', cursor: 'pointer', fontSize: 12 }}
              onMouseEnter={e => { e.currentTarget.style.color = '#FF7AA2' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#5E587A' }}
            >✕</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PlaylistsTab({ onRefresh }) {
  const st = usePlayer()
  const [openId, setOpenId] = useState(null)

  const create = async () => {
    const name = prompt('New playlist name:')
    if (name && name.trim()) {
      const pl = await createMusicPlaylist(name.trim(), [])
      player.loadLibrary(); onRefresh(); setOpenId(pl.id)
    }
  }

  const open = st.playlists.find(p => p.id === openId)
  if (open) return <PlaylistDetail pl={open} onBack={() => setOpenId(null)} onRefresh={onRefresh} />

  return (
    <div style={{ padding: '14px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.28em', color: '#8E86B8' }}>
          YOUR PLAYLISTS ({st.playlists.length})
        </div>
        <div style={{ flex: 1 }} />
        <div onClick={create} style={{
          ...MONO, fontSize: 10, letterSpacing: '0.15em', color: '#E9D8FF', cursor: 'pointer',
          padding: '9px 16px', borderRadius: 10,
          background: 'linear-gradient(90deg, rgba(123,77,255,0.5), rgba(185,108,255,0.38))',
          border: '1px solid rgba(170,120,255,0.5)',
        }}>+ NEW PLAYLIST</div>
      </div>

      {st.playlists.length === 0 && (
        <div style={{ ...MONO, fontSize: 11, color: '#5E587A', padding: '10px 4px' }}>
          No playlists yet — hit <span style={{ color: '#C7A6FF' }}>+ New Playlist</span>, then add songs from the Library
          (a track's ⋮ menu → Add to playlist), or save the current queue from the Play Queue panel.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        {st.playlists.map(pl => (
          <div key={pl.id} onClick={() => setOpenId(pl.id)} style={{ cursor: 'pointer' }}>
            <Banner pl={pl} tracks={st.tracks} height={150}>
              <div onClick={e => { e.stopPropagation(); player.playPlaylistById(pl.id) }}
                style={{ position: 'absolute', right: 10, bottom: 10, width: 38, height: 38, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: '#F3EDFF',
                  background: 'linear-gradient(135deg, rgba(123,77,255,0.9), rgba(185,108,255,0.75))',
                  border: '1px solid rgba(199,166,255,0.6)', boxShadow: '0 0 18px rgba(140,65,255,0.5)' }}>▶</div>
            </Banner>
            <div style={{ ...RAJ, fontSize: 15, fontWeight: 700, color: '#EDE8FF', marginTop: 8,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.name}</div>
            <div style={{ ...MONO, fontSize: 9, color: '#8E86B8' }}>
              {pl.track_ids.length} track{pl.track_ids.length !== 1 ? 's' : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────

export default function MusicPage() {
  const st = usePlayer()
  const [tab, setTab]       = useState('LIBRARY')
  const [search, setSearch] = useState('')
  const [, force]           = useState(0)
  const refresh = useCallback(() => { player.loadLibrary(); force(n => n + 1) }, [])

  useEffect(() => { player.loadLibrary() }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let list = st.tracks
    if (tab === 'LIKES') list = list.filter(t => t.favorite)
    if (tab === 'RECENTLY ADDED') list = [...list].sort((a, b) => b.added.localeCompare(a.added)).slice(0, 50)
    if (!q) return list
    return list.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.artist || '').toLowerCase().includes(q) ||
      (t.album || '').toLowerCase().includes(q)
    )
  }, [st.tracks, search, tab, st.loaded])

  const showTable  = tab === 'LIBRARY' || tab === 'LIKES' || tab === 'RECENTLY ADDED' || tab === 'UPLOADS'
  const showUpload = tab === 'LIBRARY' || tab === 'UPLOADS'

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', height: '100%' }}>
      {/* ── Main column ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '26px 28px', minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(123,77,255,0.5), rgba(185,108,255,0.25))',
            border: '1px solid rgba(170,120,255,0.4)', fontSize: 24,
            boxShadow: '0 0 30px rgba(123,77,255,0.3)',
          }}>♪</div>
          <div>
            <div style={{ ...RAJ, fontSize: 30, fontWeight: 700, letterSpacing: '0.14em', color: '#F3EDFF',
                          textShadow: '0 0 30px rgba(199,166,255,0.4)' }}>MUSIC</div>
            <div style={{ fontSize: 12, color: '#8E86B8' }}>Your audio. Your mood. Your command.</div>
          </div>
          <div style={{ flex: 1 }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search music…"
            style={{
              background: 'rgba(16,12,38,0.8)', border: '1px solid rgba(140,100,255,0.28)',
              borderRadius: 10, padding: '9px 14px', color: '#EDE8FF', fontSize: 12,
              outline: 'none', width: 220,
            }}
          />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(140,100,255,0.18)', marginBottom: 18, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <div key={t} onClick={() => setTab(t)} style={{
              ...MONO, fontSize: 10, letterSpacing: '0.2em', padding: '10px 14px', cursor: 'pointer',
              color: tab === t ? '#E9D8FF' : '#8E86B8',
              borderBottom: `2px solid ${tab === t ? '#B96CFF' : 'transparent'}`,
              textShadow: tab === t ? '0 0 12px rgba(185,108,255,0.6)' : 'none',
            }}>{t}</div>
          ))}
          {SOON_TABS.map(t => (
            <div key={t} title="Coming soon" style={{
              ...MONO, fontSize: 10, letterSpacing: '0.2em', padding: '10px 14px',
              color: '#4A4468', cursor: 'default', userSelect: 'none',
            }}>{t} <span style={{ fontSize: 8 }}>◦</span></div>
          ))}
        </div>

        {showUpload && <UploadPanel onUploaded={refresh} compact={tab !== 'LIBRARY'} />}
        {tab === 'UPLOADS' && <WatchFolders onImported={refresh} />}
        {showUpload && <SoundCloudAdd onAdded={refresh} />}

        {tab === 'PLAYLISTS'
          ? <PlaylistsTab onRefresh={refresh} />
          : showTable && (
            <div style={{
              background: 'rgba(10,8,26,0.5)', border: '1px solid rgba(150,110,255,0.18)',
              borderRadius: 16, overflow: 'hidden',
            }}>
              <TrackTable
                tracks={tab === 'UPLOADS' ? [...filtered].sort((a, b) => b.added.localeCompare(a.added)) : filtered}
                onRefresh={refresh}
              />
            </div>
          )}
      </div>

      {/* ── Right column ── */}
      <div style={{
        width: 330, flexShrink: 0, overflowY: 'auto', padding: '26px 22px 26px 0',
      }}>
        <NowPlaying />
        <PlayQueue onRefresh={refresh} />
        <QuickCommands />
      </div>
    </div>
  )
}
