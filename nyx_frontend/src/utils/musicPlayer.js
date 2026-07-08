/**
 * musicPlayer.js — NYX Persistent Music Engine
 *
 * Module-level singleton (lives outside the React tree) so playback
 * survives page switches, and voice/chat commands pushed over the voice
 * WebSocket control it even when the Music page isn't open.
 *
 * Two backends behind one interface:
 *   - local files  → hidden <audio> element streaming from the backend
 *   - SoundCloud   → SoundCloud's official embedded widget (their open
 *     player API, no key needed). The compact widget stays visible in the
 *     corner while its tracks play — that's SoundCloud's attribution rule.
 *
 * MusicPage (and anything else) subscribes via subscribe(fn) and renders
 * getState(). All mutations go through the exported actions.
 */

import { API_URL } from './constants.js'
import { getMusicLibrary, musicFileUrl } from '../services/api.js'

const audio = new Audio()
audio.preload = 'auto'

const state = {
  tracks: [],
  playlists: [],
  queue: [],          // array of track ids
  qIndex: -1,
  currentId: null,
  playing: false,     // a track is loaded (playing or paused)
  paused: false,
  shuffle: false,
  repeat: 'off',      // 'off' | 'all' | 'one'
  volume: Number(localStorage.getItem('nyx_music_vol') ?? 0.8),
  muted: false,
  currentTime: 0,
  duration: 0,
  loaded: false,
  backend: 'local',   // 'local' | 'sc' — which engine owns playback right now
}

audio.volume = state.volume

const listeners = new Set()
let version = 0
const notify = () => { version++; listeners.forEach(fn => { try { fn() } catch {} }) }

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// For React's useSyncExternalStore — state mutates in place, so components
// subscribe to a monotonically increasing version instead of the object.
export function getVersion() {
  return version
}

export function getState() {
  return state
}

export function getTrack(id) {
  return state.tracks.find(t => t.id === id) || null
}

export function currentTrack() {
  return getTrack(state.currentId)
}

const isSC = (track) => track?.source === 'soundcloud'

// ── SoundCloud widget backend ─────────────────────────────────────────
// Docked bottom-right, shown only while a SoundCloud entry is playing.

let scWidget = null
let scReady = false
let scContainer = null
let scIframe = null
let scConfirmTimer = null
let scPlayConfirmed = false

const scPlayerUrl = (url, autoplay) =>
  'https://w.soundcloud.com/player/?url=' + encodeURIComponent(url) +
  '&auto_play=' + (autoplay ? 'true' : 'false') +
  '&color=%237B4DFF&buying=false&sharing=false&show_comments=false&show_teaser=false'

// A silent placeholder track keeps the widget + API alive from page load, so
// the FIRST real play happens inside the widget that already exists — no
// async script fetch eating the user's click gesture.
const SC_PLACEHOLDER = 'https://soundcloud.com/soundcloud/sets/soundcloud-hits'

function scCall(fn) {
  if (scWidget) { try { fn(scWidget) } catch {} }
}

function ensureScPulseKeyframes() {
  if (document.getElementById('nyx-sc-pulse')) return
  const s = document.createElement('style')
  s.id = 'nyx-sc-pulse'
  s.textContent = `@keyframes nyxScPulse {
    0%,100% { box-shadow: 0 8px 40px rgba(0,0,0,0.6), 0 0 18px rgba(255,119,66,0.35); }
    50%     { box-shadow: 0 8px 40px rgba(0,0,0,0.6), 0 0 34px rgba(255,119,66,0.85); }
  }`
  document.head.appendChild(s)
}

function scStopPulse() {
  if (scContainer) scContainer.style.animation = ''
}

function ensureScDom() {
  if (scContainer) return
  scContainer = document.createElement('div')
  Object.assign(scContainer.style, {
    position: 'fixed', right: '18px', bottom: '18px', zIndex: 850,
    width: '340px', height: '86px', display: 'none',
    borderRadius: '14px', overflow: 'hidden',
    border: '1px solid rgba(150,110,255,0.4)',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 24px rgba(123,77,255,0.25)',
    background: '#0a081c',
  })
  scIframe = document.createElement('iframe')
  scIframe.setAttribute('width', '100%')
  scIframe.setAttribute('height', '86')
  scIframe.setAttribute('allow', 'autoplay')  // delegate our autoplay right into the iframe
  scIframe.style.border = 'none'
  scIframe.src = scPlayerUrl(SC_PLACEHOLDER, false)
  scContainer.appendChild(scIframe)
  document.body.appendChild(scContainer)
}

function bindScEvents() {
  const E = window.SC.Widget.Events
  scWidget.bind(E.READY, () => {
    scReady = true
    scCall(w => w.setVolume(state.muted ? 0 : Math.round(state.volume * 100)))
  })
  scWidget.bind(E.PLAY_PROGRESS, (e) => {
    if (state.backend !== 'sc') return
    scPlayConfirmed = true
    state.currentTime = (e.currentPosition || 0) / 1000
    scCall(w => w.getDuration(ms => { state.duration = (ms || 0) / 1000; notify() }))
  })
  scWidget.bind(E.PLAY,  () => {
    if (state.backend !== 'sc') return
    scPlayConfirmed = true
    clearTimeout(scConfirmTimer)
    scStopPulse()  // it started — stop nudging the user toward the widget
    state.paused = false; state.playing = true; notify()
  })
  scWidget.bind(E.PAUSE, () => { if (state.backend === 'sc' && state.playing) { state.paused = true; notify() } })
  scWidget.bind(E.FINISH, () => {
    if (state.backend !== 'sc') return
    const track = currentTrack()
    if (track?.sc_kind === 'playlist') {
      // The widget auto-advances inside a playlist; only leave when the
      // last sound in the set finishes.
      scWidget.getCurrentSoundIndex(idx => {
        scWidget.getSounds(sounds => {
          if (!sounds || idx >= sounds.length - 1) next()
        })
      })
    } else {
      next()
    }
  })
}

// Preload the widget API + hidden player once, at startup. After this the
// widget object exists, so a later user click drives it synchronously.
function initScWidget() {
  if (scWidget || typeof document === 'undefined') return
  ensureScDom()
  const start = () => {
    if (!window.SC?.Widget || scWidget) return
    scWidget = window.SC.Widget(scIframe)
    bindScEvents()
  }
  if (window.SC?.Widget) { start(); return }
  if (!document.getElementById('nyx-sc-api')) {
    const s = document.createElement('script')
    s.id = 'nyx-sc-api'
    s.src = 'https://w.soundcloud.com/player/api.js'
    s.onload = start
    s.onerror = () => console.warn('[musicPlayer] SoundCloud widget API failed to load')
    document.head.appendChild(s)
  } else {
    const t0 = Date.now()
    const wait = setInterval(() => {
      if (window.SC?.Widget) { clearInterval(wait); start() }
      else if (Date.now() - t0 > 10000) clearInterval(wait)
    }, 150)
  }
}

function scLoad(url) {
  ensureScDom()
  scContainer.style.display = 'block'
  scPlayConfirmed = false
  clearTimeout(scConfirmTimer)

  if (scContainer) scContainer.style.animation = ''
  // If autoplay is blocked (common in embedded/WebView contexts), the widget
  // sits paused and NO play event fires — so tell the truth after a beat:
  // flip our button to ▶ and make the docked widget pulse, since clicking
  // its own play button (a direct iframe interaction) always starts it even
  // when strict autoplay policies block parent-initiated playback.
  scConfirmTimer = setTimeout(() => {
    if (state.backend === 'sc' && !scPlayConfirmed) {
      state.paused = true
      if (scContainer) {
        ensureScPulseKeyframes()
        scContainer.style.animation = 'nyxScPulse 1.3s ease-in-out infinite'
      }
      notify()
    }
  }, 2600)

  const doLoad = () => scWidget.load(url, {
    auto_play: true,
    color: '7B4DFF',
    callback: () => scCall(w => {
      w.setVolume(state.muted ? 0 : Math.round(state.volume * 100))
      w.play()  // rides the click gesture that triggered this load
    }),
  })

  if (scWidget) { doLoad(); return }

  // Widget not up yet (very first play before preload finished) — boot it,
  // then load. Fall back to putting the track straight in the iframe src.
  initScWidget()
  const t0 = Date.now()
  const wait = setInterval(() => {
    if (scWidget) { clearInterval(wait); doLoad() }
    else if (Date.now() - t0 > 4000) { clearInterval(wait); scIframe.src = scPlayerUrl(url, true) }
  }, 120)
}

function scHide() {
  clearTimeout(scConfirmTimer)
  if (scContainer) scContainer.style.display = 'none'
  scCall(w => w.pause())
}

// ── Library ───────────────────────────────────────────────────────────

export async function loadLibrary() {
  try {
    const data = await getMusicLibrary()
    state.tracks = data.tracks || []
    state.playlists = data.playlists || []
    state.loaded = true
    // Drop deleted tracks from the queue
    const valid = new Set(state.tracks.map(t => t.id))
    state.queue = state.queue.filter(id => valid.has(id))
    notify()
  } catch { /* backend offline — keep whatever we have */ }
}

// ── Core playback ─────────────────────────────────────────────────────

function loadAndPlay(trackId) {
  const track = getTrack(trackId)
  if (!track) return
  state.currentId = trackId
  state.playing = true
  state.paused = false
  state.currentTime = 0
  state.duration = track.duration || 0

  if (isSC(track)) {
    state.backend = 'sc'
    audio.pause()
    audio.removeAttribute('src')
    scLoad(track.url)
  } else {
    state.backend = 'local'
    scHide()
    audio.src = musicFileUrl(trackId)
    audio.play().catch(() => {
      // Autoplay blocked until first user gesture — surface as paused
      state.paused = true
      notify()
    })
  }
  notify()
}

function shuffled(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function playQueue(ids, startIndex = 0) {
  if (!ids.length) return
  state.queue = [...ids]
  state.qIndex = startIndex
  loadAndPlay(state.queue[startIndex])
}

export function playTrack(trackId, queueIds = null) {
  const source = queueIds ?? state.tracks.map(t => t.id)
  const ordered = state.shuffle
    ? [trackId, ...shuffled(source.filter(id => id !== trackId))]
    : source
  playQueue(ordered, ordered.indexOf(trackId))
}

export function next() {
  if (!state.queue.length) return
  if (state.repeat === 'one') { loadAndPlay(state.queue[state.qIndex]); return }
  let i = state.qIndex + 1
  if (i >= state.queue.length) {
    if (state.repeat !== 'all') { stop(); return }
    i = 0
  }
  state.qIndex = i
  loadAndPlay(state.queue[i])
}

export function previous() {
  if (!state.queue.length) return
  if (state.backend === 'local' && audio.currentTime > 4) { audio.currentTime = 0; return }
  if (state.backend === 'sc' && state.currentTime > 4) { seek(0); return }
  const i = Math.max(0, state.qIndex - 1)
  state.qIndex = i
  loadAndPlay(state.queue[i])
}

export function pause() {
  if (state.backend === 'sc') { scCall(w => w.pause()) }
  else audio.pause()
  state.paused = true
  notify()
}

export function resume() {
  if (!state.currentId) { playMusic(); return }
  if (state.backend === 'sc') {
    const track = currentTrack()
    // If the track never actually started (autoplay was blocked when it was
    // queued without a gesture), a bare play() postMessage won't carry this
    // click's activation into SoundCloud's cross-origin iframe. Re-run the
    // full load+autoplay INSIDE this gesture — the same path a direct row
    // click uses — which reliably starts it. Otherwise just unpause.
    if (!scPlayConfirmed && track) scLoad(track.url)
    else scCall(w => w.play())
  } else {
    audio.play().catch(() => {})
  }
  state.paused = false
  notify()
}

export function toggle() {
  state.paused || !state.playing ? resume() : pause()
}

export function stop() {
  audio.pause()
  audio.removeAttribute('src')
  scHide()
  state.backend = 'local'
  state.playing = false
  state.paused = false
  state.currentId = null
  state.currentTime = 0
  state.duration = 0
  notify()
}

export function seek(seconds) {
  if (isNaN(seconds)) return
  if (state.backend === 'sc') { scCall(w => w.seekTo(seconds * 1000)) }
  else audio.currentTime = seconds
}

export function setVolume(v) {
  state.volume = Math.max(0, Math.min(1, v))
  state.muted = false
  audio.muted = false
  audio.volume = state.volume
  if (scWidget && scReady) { try { scWidget.setVolume(Math.round(state.volume * 100)) } catch {} }
  localStorage.setItem('nyx_music_vol', String(state.volume))
  notify()
}

export function toggleMute() {
  state.muted = !state.muted
  audio.muted = state.muted
  if (scWidget && scReady) { try { scWidget.setVolume(state.muted ? 0 : Math.round(state.volume * 100)) } catch {} }
  notify()
}

export function toggleShuffle() {
  state.shuffle = !state.shuffle
  notify()
}

export function cycleRepeat() {
  state.repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off'
  notify()
}

// ── Queue management ──────────────────────────────────────────────────

export function addToQueue(trackId) {
  state.queue.push(trackId)
  if (state.qIndex === -1) { state.qIndex = 0; loadAndPlay(trackId); return }
  notify()
}

export function playNextInQueue(trackId) {
  state.queue.splice(state.qIndex + 1, 0, trackId)
  notify()
}

export function removeFromQueue(index) {
  state.queue.splice(index, 1)
  if (index < state.qIndex) state.qIndex--
  else if (index === state.qIndex) {
    if (state.queue.length) { state.qIndex = Math.min(state.qIndex, state.queue.length - 1); loadAndPlay(state.queue[state.qIndex]) }
    else stop()
  }
  notify()
}

export function jumpToQueueIndex(index) {
  if (index < 0 || index >= state.queue.length) return
  state.qIndex = index
  loadAndPlay(state.queue[index])
}

export function clearQueue() {
  state.queue = []
  state.qIndex = -1
  stop()
}

// ── High-level commands (also used by voice) ──────────────────────────

export function shuffleAll() {
  const ids = state.tracks.map(t => t.id)
  if (ids.length) playQueue(shuffled(ids), 0)
}

export function playFavorites(doShuffle = true) {
  let ids = state.tracks.filter(t => t.favorite).map(t => t.id)
  if (!ids.length) ids = state.tracks.map(t => t.id)  // nothing liked yet — play everything
  if (ids.length) playQueue(doShuffle ? shuffled(ids) : ids, 0)
}

export function playPlaylistById(playlistId) {
  const pl = state.playlists.find(p => p.id === playlistId)
  if (pl && pl.track_ids.length) playQueue(pl.track_ids, 0)
}

export function playMusic() {
  // "play music": resume if something's loaded, otherwise shuffle the library
  if (state.currentId && state.paused) resume()
  else if (!state.playing) shuffleAll()
}

// ── Audio element events (local backend) ──────────────────────────────

audio.addEventListener('timeupdate', () => {
  if (state.backend !== 'local') return
  state.currentTime = audio.currentTime
  state.duration = audio.duration || 0
  notify()
})
audio.addEventListener('ended', () => { if (state.backend === 'local') next() })
audio.addEventListener('play',  () => { if (state.backend === 'local') { state.paused = false; state.playing = true; notify() } })
audio.addEventListener('pause', () => { if (state.backend === 'local' && state.playing) { state.paused = true; notify() } })

// ── Voice/chat command channel ────────────────────────────────────────
// The backend pushes {type:'music_command', action, ...} over the voice WS
// when you tell NYX things like "play after dark" or "pause the music".

function handleCommand(d) {
  switch (d.action) {
    case 'play_track':     loadLibrary().then(() => playTrack(d.track_id)); break
    case 'play_playlist':  loadLibrary().then(() => playPlaylistById(d.playlist_id)); break
    case 'play_favorites': loadLibrary().then(() => playFavorites(true)); break
    case 'shuffle_all':    loadLibrary().then(() => shuffleAll()); break
    case 'play_music':     playMusic(); break
    case 'pause':          pause(); break
    case 'resume':         resume(); break
    case 'next':           next(); break
    case 'previous':       previous(); break
    case 'stop':           stop(); break
    case 'mute':           toggleMute(); break
    case 'volume':         setVolume((d.value ?? 80) / 100); break
    default: break
  }
}

let _ws, _retry
function connectWS() {
  try {
    _ws = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/ws/voice`)
    _ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data)
        if (d.type === 'music_command') handleCommand(d)
        if (d.type === 'music_library_changed') loadLibrary()  // watch-folder auto-imports
      } catch {}
    }
    _ws.onerror = () => {}
    _ws.onclose = () => { _retry = setTimeout(connectWS, 5000) }
  } catch {}
}
connectWS()

// Initial library load so voice commands work before the page is visited
loadLibrary()

// Warm up the SoundCloud widget in the background so the first "play" on an
// SC track drives an already-existing player (best chance at autoplay), and
// so blocked-autoplay recovery is instant.
if (typeof window !== 'undefined') {
  if (document.readyState === 'complete') initScWidget()
  else window.addEventListener('load', initScWidget, { once: true })
}
