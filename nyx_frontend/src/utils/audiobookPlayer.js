/**
 * audiobookPlayer.js — NYX Persistent Audiobook Engine
 *
 * A parallel singleton to musicPlayer.js, NOT an extension of it — audiobooks
 * need resume-position persistence, chapter-linear playback, and a playback
 * rate, none of which fit musicPlayer's queue/shuffle/repeat/SoundCloud
 * internals. Same module-level singleton + useSyncExternalStore shape so
 * AudiobooksPage subscribes the same way MusicPage subscribes to musicPlayer.
 */

import { API_URL } from './constants.js'
import { getAudiobookLibrary, audiobookFileUrl, updateAudiobookPosition } from '../services/api.js'

const audio = new Audio()
audio.preload = 'auto'

const state = {
  books: [],
  collections: [],
  currentBookId: null,
  currentChapterIndex: 0,
  playing: false,      // a chapter is loaded (playing or paused)
  paused: false,
  playbackRate: Number(localStorage.getItem('nyx_audiobook_rate') ?? 1.0),
  volume: Number(localStorage.getItem('nyx_audiobook_vol') ?? 0.8),
  muted: false,
  currentTime: 0,
  duration: 0,
  loaded: false,
  jobs: {},            // job_id -> latest audiobook_progress payload
}

audio.volume = state.volume
audio.playbackRate = state.playbackRate

const listeners = new Set()
let version = 0
const notify = () => { version++; listeners.forEach(fn => { try { fn() } catch {} }) }

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getVersion() {
  return version
}

export function getState() {
  return state
}

export function getBook(id) {
  return state.books.find(b => b.id === id) || null
}

export function currentBook() {
  return getBook(state.currentBookId)
}

// ── Library ───────────────────────────────────────────────────────────

export async function loadLibrary() {
  try {
    const data = await getAudiobookLibrary()
    state.books = data.books || []
    state.collections = data.collections || []
    state.loaded = true
    notify()
  } catch { /* backend offline — keep whatever we have */ }
}

// ── Position persistence ────────────────────────────────────────────────
// Music never persists position at all; audiobooks must. Debounced PUT while
// playing, flushed immediately on pause, and best-effort flushed via
// sendBeacon on tab close (a plain fetch() PUT isn't guaranteed to finish).

let posTimer = null
function flushPosition(useBeacon = false) {
  if (!state.currentBookId) return
  const bookId = state.currentBookId
  const seconds = state.currentTime
  const chapterIndex = state.currentChapterIndex
  if (useBeacon && navigator.sendBeacon) {
    const blob = new Blob(
      [JSON.stringify({ position_seconds: seconds, chapter_index: chapterIndex })],
      { type: 'application/json' })
    navigator.sendBeacon(`${API_URL}/api/audiobooks/book/${bookId}/position`, blob)
  } else {
    updateAudiobookPosition(bookId, seconds, chapterIndex).catch(() => {})
  }
}

function schedulePositionSave() {
  clearTimeout(posTimer)
  posTimer = setTimeout(() => flushPosition(false), 7000)
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => flushPosition(true))
}

// ── Core playback ─────────────────────────────────────────────────────

function loadAndPlay(bookId, chapterIndex, startAt = 0) {
  const book = getBook(bookId)
  if (!book || !book.chapters[chapterIndex]) return
  state.currentBookId = bookId
  state.currentChapterIndex = chapterIndex
  state.playing = true
  state.paused = false
  state.currentTime = startAt
  state.duration = book.chapters[chapterIndex].duration || 0

  audio.src = audiobookFileUrl(bookId, chapterIndex)
  audio.playbackRate = state.playbackRate
  const onReady = () => {
    if (startAt > 0) audio.currentTime = startAt
    audio.removeEventListener('loadedmetadata', onReady)
  }
  audio.addEventListener('loadedmetadata', onReady)
  audio.play().catch(() => {
    // Autoplay blocked until a user gesture — surface as paused, not an error
    state.paused = true
    notify()
  })
  notify()
}

export function playBook(bookId, chapterIndex = null) {
  const book = getBook(bookId)
  if (!book || !book.chapters.length) return
  const idx = chapterIndex ?? book.position_chapter ?? 0
  const startAt = chapterIndex === null ? (book.position_seconds || 0) : 0
  loadAndPlay(bookId, Math.min(idx, book.chapters.length - 1), startAt)
}

export function playChapter(bookId, chapterIndex) {
  loadAndPlay(bookId, chapterIndex, 0)
}

export function nextChapter() {
  const book = currentBook()
  if (!book) return
  const next = state.currentChapterIndex + 1
  if (next < book.chapters.length) loadAndPlay(book.id, next, 0)
  else { flushPosition(false); state.playing = false; state.paused = false; notify() } // book finished
}

export function previousChapter() {
  const book = currentBook()
  if (!book) return
  if (audio.currentTime > 4) { audio.currentTime = 0; return }
  const prev = Math.max(0, state.currentChapterIndex - 1)
  loadAndPlay(book.id, prev, 0)
}

export function pause() {
  audio.pause()
  state.paused = true
  flushPosition(false)
  notify()
}

export function resume() {
  if (!state.currentBookId) return
  audio.play().catch(() => {})
  state.paused = false
  notify()
}

export function toggle() {
  state.paused || !state.playing ? resume() : pause()
}

export function seek(seconds) {
  if (isNaN(seconds)) return
  audio.currentTime = seconds
}

export function setPlaybackRate(rate) {
  state.playbackRate = Math.max(0.5, Math.min(3, rate))
  audio.playbackRate = state.playbackRate
  localStorage.setItem('nyx_audiobook_rate', String(state.playbackRate))
  notify()
}

export function setVolume(v) {
  state.volume = Math.max(0, Math.min(1, v))
  state.muted = false
  audio.muted = false
  audio.volume = state.volume
  localStorage.setItem('nyx_audiobook_vol', String(state.volume))
  notify()
}

export function toggleMute() {
  state.muted = !state.muted
  audio.muted = state.muted
  notify()
}

// ── Audio element events ────────────────────────────────────────────────

audio.addEventListener('timeupdate', () => {
  state.currentTime = audio.currentTime
  state.duration = audio.duration || state.duration
  notify()
  schedulePositionSave()
})
audio.addEventListener('ended', () => nextChapter())
audio.addEventListener('play',  () => { state.paused = false; state.playing = true; notify() })
audio.addEventListener('pause', () => { if (state.playing) { state.paused = true; notify() } })

// ── Voice/chat command + generation-progress channel ────────────────────
// Shares the existing /ws/voice socket used by musicPlayer, but on distinct
// message types so the two players never cross-handle each other's events.

function handleCommand(d) {
  switch (d.action) {
    case 'resume': resume(); break
    case 'pause':  pause(); break
    case 'next':   nextChapter(); break
    case 'previous': previousChapter(); break
    default: break
  }
}

function handleProgress(d) {
  if (!d.job_id) return
  state.jobs = { ...state.jobs, [d.job_id]: d }
  notify()
}

let _ws, _retry
function connectWS() {
  try {
    _ws = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/ws/voice`)
    _ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data)
        if (d.type === 'audiobook_command') handleCommand(d)
        if (d.type === 'audiobook_progress') handleProgress(d)
      } catch {}
    }
    _ws.onerror = () => {}
    _ws.onclose = () => { _retry = setTimeout(connectWS, 5000) }
  } catch {}
}
connectWS()

// Initial library load so the sidebar/voice commands work before the page
// is ever visited.
loadLibrary()
