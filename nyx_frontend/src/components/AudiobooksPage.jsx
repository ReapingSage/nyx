/**
 * AudiobooksPage.jsx — The Forge › Audiobooks
 *
 * NYX's local audiobook library, narrator, and voice studio. Playback lives
 * in utils/audiobookPlayer.js (a singleton outside the React tree, mirroring
 * utils/musicPlayer.js) so a book keeps playing — and its position keeps
 * saving — when you leave this page.
 *
 * This is the first build slice: LIBRARY + upload only. Collections, Voices,
 * Import (EPUB/PDF/text → Kokoro TTS), and In Progress land in later slices —
 * they are left off entirely rather than shown as stubbed "coming soon" tabs.
 */

import { useState, useEffect, useMemo, useCallback, useRef, useSyncExternalStore } from 'react'
import * as player from '../utils/audiobookPlayer.js'
import {
  uploadAudiobookFiles, updateAudiobook, deleteAudiobook, bookCoverUrl,
  createAudiobookCollection, deleteAudiobookCollection, renameAudiobookCollection,
  addBookToCollection, removeBookFromCollection,
  setCollectionBanner, clearCollectionBanner, collectionBannerUrl,
  getAudiobookVoices, createVoiceBlend, deleteVoiceBlend, previewVoiceUrl, previewVoiceAdhoc,
  importAudiobookFile, importAudiobookText, generateAudiobook,
} from '../services/api.js'

const MONO = { fontFamily: 'Share Tech Mono, monospace' }
const RAJ  = { fontFamily: 'Rajdhani, sans-serif' }

const TABS = ['LIBRARY', 'COLLECTIONS', 'VOICES', 'IMPORT', 'IN PROGRESS']

function usePlayer() {
  useSyncExternalStore(player.subscribe, player.getVersion)
  return player.getState()
}

const fmtTime = (s) => {
  if (s == null || isNaN(s)) return '--:--'
  s = Math.round(s)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`
}

function totalDuration(book) {
  const known = book.chapters.filter(c => c.status === 'done')
  const seconds = known.reduce((sum, c) => sum + (c.duration || 0), 0)
  const pending = book.chapters.length - known.length
  return { seconds, complete: pending === 0, ready: known.length, total: book.chapters.length }
}

// Book cover — custom upload if set, otherwise a gradient keyed by title.
function BookCover({ book, size = 34, radius = 6 }) {
  if (book?.cover) {
    return (
      <img src={bookCoverUrl(book.id, book.cover)} alt="" style={{
        width: size, height: size, borderRadius: radius, flexShrink: 0,
        objectFit: 'cover', border: '1px solid rgba(150,110,255,0.25)',
        boxShadow: size > 100 ? '0 0 40px rgba(123,77,255,0.25)' : 'none',
      }} />
    )
  }
  const hue = book ? (book.title.charCodeAt(0) * 7 + (book.author?.charCodeAt(0) || 0) * 13) % 60 : 0
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: book
        ? `linear-gradient(135deg, hsl(${255 + hue},70%,22%), hsl(${275 + hue},80%,45%), hsl(${240 + hue},70%,14%))`
        : 'rgba(20,14,44,0.8)',
      border: '1px solid rgba(150,110,255,0.25)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'rgba(233,216,255,0.75)', fontSize: size * 0.4,
      boxShadow: size > 100 ? '0 0 40px rgba(123,77,255,0.25)' : 'none',
    }}>📖</div>
  )
}

// ── Upload panel — existing audio files, one file = one book (for now) ──

function UploadPanel({ onUploaded }) {
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg]   = useState('')
  const inputRef = useRef(null)

  const doUpload = useCallback(async (files) => {
    const list = Array.from(files || []).filter(f => f.name)
    if (!list.length) return
    setBusy(true); setMsg(`Uploading ${list.length} file${list.length > 1 ? 's' : ''}…`)
    try {
      const res = await uploadAudiobookFiles(list)
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
        padding: '26px 28px',
        display: 'flex', alignItems: 'center', gap: 20,
        transition: 'all 0.2s ease', marginBottom: 18,
        boxShadow: drag ? '0 0 30px rgba(123,77,255,0.25)' : 'none',
      }}
    >
      <input
        ref={inputRef} type="file" multiple accept=".mp3,.flac,.wav,.ogg,.m4a,.m4b,audio/*"
        style={{ display: 'none' }}
        onChange={e => { doUpload(e.target.files); e.target.value = '' }}
      />
      <div style={{ fontSize: 34, filter: 'drop-shadow(0 0 14px rgba(140,80,255,0.7))' }}>📖</div>
      <div style={{ flex: 1 }}>
        <div style={{ ...RAJ, fontSize: 16, fontWeight: 600, color: '#EDE8FF' }}>
          {busy ? 'Uploading…' : 'Drag & Drop audiobook files here'}
        </div>
        <div style={{ ...MONO, fontSize: 10, color: '#8E86B8', marginTop: 3 }}>
          {msg || 'each file becomes a book — or click to browse'}
        </div>
      </div>
      <div style={{ ...MONO, fontSize: 9, color: '#5E587A', textAlign: 'right', lineHeight: 1.7 }}>
        Supported: MP3, M4A, M4B, WAV, FLAC, OGG<br />Max file size: 1GB
      </div>
    </div>
  )
}

// ── Book table ────────────────────────────────────────────────────────

function BookRow({ book, onRefresh, collections = [] }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [collectionPicker, setCollectionPicker] = useState(false)
  const dur = totalDuration(book)

  const toggleFavorite = (e) => {
    e.stopPropagation()
    updateAudiobook(book.id, { favorite: !book.favorite }).then(() => { player.loadLibrary(); onRefresh() })
  }

  const remove = (e) => {
    e.stopPropagation()
    setMenuOpen(false)
    deleteAudiobook(book.id).then(() => { player.loadLibrary(); onRefresh() })
  }

  return (
    <div
      onClick={() => player.playBook(book.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
        cursor: 'pointer', borderBottom: '1px solid rgba(140,100,255,0.08)',
        position: 'relative',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,77,255,0.08)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <BookCover book={book} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...RAJ, fontSize: 14, fontWeight: 600, color: '#EDE8FF',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</div>
        <div style={{ ...MONO, fontSize: 10, color: '#8E86B8' }}>{book.author || '—'}</div>
      </div>
      <div style={{ ...MONO, fontSize: 10, color: '#8E86B8', width: 90, textAlign: 'right' }}>
        {dur.complete ? fmtTime(dur.seconds) : `${dur.ready}/${dur.total} ch.`}
      </div>
      <div onClick={toggleFavorite} title="Favorite" style={{
        fontSize: 14, color: book.favorite ? '#B96CFF' : '#5E587A', cursor: 'pointer', width: 20, textAlign: 'center',
      }}>{book.favorite ? '★' : '☆'}</div>
      <div onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }} style={{
        fontSize: 16, color: '#8E86B8', cursor: 'pointer', width: 20, textAlign: 'center',
      }}>⋮</div>
      {menuOpen && !collectionPicker && (
        <div onClick={e => e.stopPropagation()} style={{
          position: 'absolute', right: 16, top: '100%', zIndex: 20,
          background: 'rgba(14,10,32,0.98)', border: '1px solid rgba(150,110,255,0.3)',
          borderRadius: 10, padding: 6, minWidth: 160, boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        }}>
          <div onClick={() => setCollectionPicker(true)} style={{ ...MONO, fontSize: 11, color: '#EDE8FF', padding: '7px 10px', cursor: 'pointer', borderRadius: 6 }}>
            Add to Collection
          </div>
          <div onClick={remove} style={{ ...MONO, fontSize: 11, color: '#f87171', padding: '7px 10px', cursor: 'pointer', borderRadius: 6 }}>
            Delete
          </div>
        </div>
      )}
      {menuOpen && collectionPicker && (
        <div onClick={e => e.stopPropagation()} style={{
          position: 'absolute', right: 16, top: '100%', zIndex: 20,
          background: 'rgba(14,10,32,0.98)', border: '1px solid rgba(150,110,255,0.3)',
          borderRadius: 10, padding: 6, minWidth: 180, maxHeight: 220, overflowY: 'auto',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        }}>
          {collections.length === 0 && (
            <div style={{ ...MONO, fontSize: 10, color: '#5E587A', padding: '7px 10px' }}>No collections yet</div>
          )}
          {collections.map(c => (
            <div key={c.id}
              onClick={() => { addBookToCollection(c.id, book.id).then(() => { player.loadLibrary(); onRefresh(); setMenuOpen(false); setCollectionPicker(false) }) }}
              style={{ ...MONO, fontSize: 11, color: '#EDE8FF', padding: '7px 10px', cursor: 'pointer', borderRadius: 6 }}
            >{c.name}{book.collection_ids.includes(c.id) ? ' ✓' : ''}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function BookTable({ books, onRefresh, collections }) {
  if (!books.length) {
    return (
      <div style={{ ...MONO, fontSize: 11, color: '#5E587A', padding: '30px 16px', textAlign: 'center' }}>
        No audiobooks yet — drag an audio file above to add one.
      </div>
    )
  }
  return <div>{books.map(b => <BookRow key={b.id} book={b} onRefresh={onRefresh} collections={collections} />)}</div>
}

// ── Collections ───────────────────────────────────────────────────────

function CollectionBanner({ c, books, height, radius = 12, children }) {
  const bannerUrl = c.banner ? collectionBannerUrl(c.id, c.banner) : null
  const firstBook = c.book_ids.map(id => books.find(b => b.id === id)).find(b => b?.cover)
  const url = bannerUrl || (firstBook ? bookCoverUrl(firstBook.id, firstBook.cover) : null)
  const hue = (c.name.charCodeAt(0) * 11) % 60
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
          fontSize: height * 0.4, color: 'rgba(233,216,255,0.3)' }}>📚</div>
      )}
      {children}
    </div>
  )
}

function CollectionDetail({ c, allBooks, onBack, onRefresh }) {
  const bannerInputRef = useRef(null)
  const [adding, setAdding] = useState(false)
  const books = c.book_ids.map(id => allBooks.find(b => b.id === id)).filter(Boolean)
  const available = allBooks.filter(b => !c.book_ids.includes(b.id))

  const uploadBanner = async (file) => {
    if (!file) return
    try { await setCollectionBanner(c.id, file); player.loadLibrary(); onRefresh() } catch (e) { alert(e.message) }
  }
  const rename = async () => {
    const name = prompt('Rename collection:', c.name)
    if (name && name.trim()) { await renameAudiobookCollection(c.id, name.trim()); player.loadLibrary(); onRefresh() }
  }

  return (
    <div style={{ padding: '10px 0' }}>
      <div onClick={onBack} style={{ ...MONO, fontSize: 10, letterSpacing: '0.15em', color: '#8E86B8',
        cursor: 'pointer', marginBottom: 12, display: 'inline-block' }}>‹ ALL COLLECTIONS</div>

      <CollectionBanner c={c} books={allBooks} height={180} radius={16}>
        <div style={{ padding: 20, width: '100%', display: 'flex', alignItems: 'flex-end', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.3em', color: '#C7A6FF' }}>COLLECTION</div>
            <div style={{ ...RAJ, fontSize: 30, fontWeight: 700, color: '#F3EDFF', textShadow: '0 2px 20px rgba(0,0,0,0.7)' }}>
              {c.name} <span onClick={rename} title="Rename" style={{ fontSize: 14, cursor: 'pointer', color: '#C7A6FF' }}>✎</span>
            </div>
            <div style={{ ...MONO, fontSize: 10, color: '#D8C9FF', marginTop: 2 }}>
              {books.length} book{books.length !== 1 ? 's' : ''}
            </div>
          </div>
          <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { uploadBanner(e.target.files[0]); e.target.value = '' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <div onClick={() => setAdding(a => !a)} style={{
              ...MONO, fontSize: 10, letterSpacing: '0.15em', color: '#E9D8FF', cursor: 'pointer',
              padding: '9px 18px', borderRadius: 10,
              background: 'linear-gradient(90deg, rgba(123,77,255,0.7), rgba(185,108,255,0.55))',
              border: '1px solid rgba(199,166,255,0.5)',
            }}>+ ADD BOOK</div>
            <div onClick={() => bannerInputRef.current?.click()} title="Set a custom banner image" style={{
              ...MONO, fontSize: 10, color: '#E9D8FF', cursor: 'pointer', padding: '9px 12px',
              borderRadius: 10, background: 'rgba(10,8,26,0.6)', border: '1px solid rgba(170,120,255,0.4)',
            }}>🖼 BANNER</div>
            {c.banner && (
              <div onClick={async () => { await clearCollectionBanner(c.id); player.loadLibrary(); onRefresh() }}
                title="Reset to first-book cover" style={{
                ...MONO, fontSize: 10, color: '#8E86B8', cursor: 'pointer', padding: '9px 12px',
                borderRadius: 10, background: 'rgba(10,8,26,0.6)', border: '1px solid rgba(140,100,255,0.25)',
              }}>↺</div>
            )}
          </div>
        </div>
      </CollectionBanner>

      {adding && (
        <div style={{ marginTop: 12, background: 'rgba(10,8,26,0.6)', border: '1px solid rgba(150,110,255,0.2)', borderRadius: 12, padding: 10, maxHeight: 200, overflowY: 'auto' }}>
          {available.length === 0 && <div style={{ ...MONO, fontSize: 10, color: '#5E587A', padding: 6 }}>All books are already in this collection.</div>}
          {available.map(b => (
            <div key={b.id}
              onClick={() => { addBookToCollection(c.id, b.id).then(() => { player.loadLibrary(); onRefresh() }) }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', cursor: 'pointer', borderRadius: 8 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,77,255,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <BookCover book={b} size={26} radius={5} />
              <div style={{ fontSize: 12, color: '#EDE8FF' }}>{b.title}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {books.length === 0 && (
          <div style={{ ...MONO, fontSize: 11, color: '#5E587A', padding: '20px 4px' }}>
            Empty collection — add books with the button above.
          </div>
        )}
        {books.map(b => (
          <div key={b.id} onDoubleClick={() => player.playBook(b.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px',
              borderBottom: '1px solid rgba(140,100,255,0.08)' }}>
            <BookCover book={b} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#EDE8FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
              <div style={{ fontSize: 11, color: '#8E86B8' }}>{b.author || '—'}</div>
            </div>
            <div onClick={() => player.playBook(b.id)} style={{ color: '#C7A6FF', cursor: 'pointer', fontSize: 13 }}>▶</div>
            <div onClick={async () => { await removeBookFromCollection(c.id, b.id); player.loadLibrary(); onRefresh() }}
              title="Remove from collection" style={{ ...MONO, color: '#5E587A', cursor: 'pointer', fontSize: 12 }}
              onMouseEnter={e => { e.currentTarget.style.color = '#FF7AA2' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#5E587A' }}
            >✕</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CollectionsTab({ books, collections, onRefresh }) {
  const [openId, setOpenId] = useState(null)

  const create = async () => {
    const name = prompt('New collection name:')
    if (name && name.trim()) {
      const c = await createAudiobookCollection(name.trim(), [])
      player.loadLibrary(); onRefresh(); setOpenId(c.id)
    }
  }

  const open = collections.find(c => c.id === openId)
  if (open) return <CollectionDetail c={open} allBooks={books} onBack={() => setOpenId(null)} onRefresh={onRefresh} />

  return (
    <div style={{ padding: '14px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.28em', color: '#8E86B8' }}>
          YOUR COLLECTIONS ({collections.length})
        </div>
        <div style={{ flex: 1 }} />
        <div onClick={create} style={{
          ...MONO, fontSize: 10, letterSpacing: '0.15em', color: '#E9D8FF', cursor: 'pointer',
          padding: '9px 16px', borderRadius: 10,
          background: 'linear-gradient(90deg, rgba(123,77,255,0.5), rgba(185,108,255,0.38))',
          border: '1px solid rgba(170,120,255,0.5)',
        }}>+ NEW COLLECTION</div>
      </div>

      {collections.length === 0 && (
        <div style={{ ...MONO, fontSize: 11, color: '#5E587A', padding: '10px 4px' }}>
          No collections yet — hit <span style={{ color: '#C7A6FF' }}>+ New Collection</span>, then add books from the Library
          (a book's ⋮ menu → Add to Collection).
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        {collections.map(c => (
          <div key={c.id} onClick={() => setOpenId(c.id)} style={{ cursor: 'pointer' }}>
            <CollectionBanner c={c} books={books} height={150} />
            <div style={{ ...RAJ, fontSize: 15, fontWeight: 700, color: '#EDE8FF', marginTop: 8,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
            <div style={{ ...MONO, fontSize: 9, color: '#8E86B8' }}>
              {c.book_ids.length} book{c.book_ids.length !== 1 ? 's' : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Now Playing panel ────────────────────────────────────────────────

function NowPlaying() {
  const st = usePlayer()
  const book = player.currentBook()
  const chapter = book?.chapters[st.currentChapterIndex]
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
      background: opts.big ? 'linear-gradient(135deg, rgba(123,77,255,0.85), rgba(185,108,255,0.7))' : 'transparent',
      border: opts.big ? '1px solid rgba(199,166,255,0.6)' : '1px solid transparent',
      boxShadow: opts.big ? '0 0 26px rgba(140,65,255,0.5)' : 'none',
      transition: 'all 0.2s ease',
    }}>{label}</div>
  )

  const pct = st.duration ? (st.currentTime / st.duration) * 100 : 0
  const rates = [0.75, 1, 1.25, 1.5, 2]

  return (
    <div style={{
      background: 'rgba(12,10,30,0.6)', border: '1px solid rgba(150,110,255,0.22)',
      borderRadius: 16, padding: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.28em', color: '#8E86B8' }}>NOW PLAYING</div>
        <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.2em', color: '#22c55e' }}>● NYX NARRATOR</div>
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
        <BookCover book={book} size={92} radius={12} />
        <div style={{ minWidth: 0 }}>
          <div style={{ ...RAJ, fontSize: 18, fontWeight: 700, color: '#F3EDFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {book ? book.title : 'Nothing playing'}
          </div>
          <div style={{ fontSize: 12, color: '#B9A6FF', marginTop: 2 }}>{book?.author || '—'}</div>
          <div style={{ fontSize: 11, color: '#8E86B8', marginTop: 1 }}>{chapter?.title || ''}</div>
        </div>
      </div>

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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 10 }}>
        {btn('⏮', player.previousChapter, { title: 'Previous chapter' })}
        {btn(st.playing && !st.paused ? '❚❚' : '▶', player.toggle, { big: true, title: 'Play/Pause' })}
        {btn('⏭', player.nextChapter, { title: 'Next chapter' })}
      </div>

      {/* Playback rate — audiobook-specific, no shuffle/repeat */}
      <div style={{ display: 'flex', gap: 6, marginTop: 14, justifyContent: 'center' }}>
        {rates.map(r => (
          <div key={r} onClick={() => player.setPlaybackRate(r)} style={{
            ...MONO, fontSize: 10, padding: '4px 9px', borderRadius: 8, cursor: 'pointer',
            color: st.playbackRate === r ? '#E9D8FF' : '#8E86B8',
            background: st.playbackRate === r ? 'rgba(100,50,220,0.35)' : 'rgba(20,14,44,0.6)',
            border: `1px solid ${st.playbackRate === r ? 'rgba(199,166,255,0.6)' : 'rgba(140,100,255,0.2)'}`,
          }}>{r}×</div>
        ))}
      </div>

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

// ── Voices ────────────────────────────────────────────────────────────

function VoiceCard({ id, label, isBlend, ratioLabel, onDelete }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)

  const play = () => {
    if (!audioRef.current) audioRef.current = new Audio()
    const a = audioRef.current
    a.src = previewVoiceUrl(id, isBlend)
    setPlaying(true)
    a.play().catch(() => setPlaying(false))
    a.onended = () => setPlaying(false)
    a.onerror = () => setPlaying(false)
  }

  return (
    <div style={{
      background: 'rgba(12,10,30,0.55)', border: '1px solid rgba(150,110,255,0.2)',
      borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div onClick={play} style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        background: playing ? 'linear-gradient(135deg, rgba(123,77,255,0.9), rgba(185,108,255,0.75))' : 'rgba(20,14,44,0.8)',
        border: '1px solid rgba(150,110,255,0.35)', fontSize: 14, color: '#EDE8FF',
      }}>{playing ? '♪' : '▶'}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...RAJ, fontSize: 13, fontWeight: 600, color: '#EDE8FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        {ratioLabel && <div style={{ ...MONO, fontSize: 9, color: '#8E86B8', marginTop: 2 }}>{ratioLabel}</div>}
      </div>
      {onDelete && (
        <div onClick={onDelete} title="Delete blend" style={{ ...MONO, color: '#5E587A', cursor: 'pointer', fontSize: 12 }}
          onMouseEnter={e => { e.currentTarget.style.color = '#FF7AA2' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#5E587A' }}
        >✕</div>
      )}
    </div>
  )
}

function CreateBlendPanel({ builtin, onCreated }) {
  const [voiceA, setVoiceA] = useState(builtin[0]?.id || '')
  const [voiceB, setVoiceB] = useState(builtin[1]?.id || '')
  const [ratio, setRatio] = useState(50) // % weight for voiceA
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const previewAudioRef = useRef(null)

  const components = () => ([
    { voice: voiceA, weight: ratio / 100 },
    { voice: voiceB, weight: (100 - ratio) / 100 },
  ])

  const preview = async () => {
    if (voiceA === voiceB) { setMsg('Pick two different voices to blend.'); return }
    setBusy(true); setMsg('Synthesizing preview…')
    try {
      const blob = await previewVoiceAdhoc(components())
      const url = URL.createObjectURL(blob)
      if (!previewAudioRef.current) previewAudioRef.current = new Audio()
      previewAudioRef.current.src = url
      previewAudioRef.current.play().catch(() => {})
      setMsg('')
    } catch (e) {
      setMsg(`Preview failed: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (voiceA === voiceB) { setMsg('Pick two different voices to blend.'); return }
    if (!name.trim()) { setMsg('Name the blend first.'); return }
    setBusy(true); setMsg('Saving…')
    try {
      await createVoiceBlend(name.trim(), components())
      setName(''); setMsg('Saved.')
      onCreated()
    } catch (e) {
      setMsg(`Save failed: ${e.message}`)
    } finally {
      setBusy(false)
      setTimeout(() => setMsg(''), 3000)
    }
  }

  const selectStyle = {
    background: 'rgba(16,12,38,0.8)', border: '1px solid rgba(140,100,255,0.28)',
    borderRadius: 8, padding: '8px 10px', color: '#EDE8FF', fontSize: 12, flex: 1, outline: 'none',
  }

  return (
    <div style={{
      background: 'rgba(12,10,30,0.6)', border: '1px solid rgba(150,110,255,0.22)',
      borderRadius: 16, padding: 18, marginBottom: 20,
    }}>
      <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.28em', color: '#8E86B8', marginBottom: 12 }}>CREATE BLEND</div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <select value={voiceA} onChange={e => setVoiceA(e.target.value)} style={selectStyle}>
          {builtin.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
        <select value={voiceB} onChange={e => setVoiceB(e.target.value)} style={selectStyle}>
          {builtin.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ ...MONO, fontSize: 9, color: '#8E86B8', width: 60 }}>{ratio}% / {100 - ratio}%</span>
        <input type="range" min="0" max="100" value={ratio} onChange={e => setRatio(Number(e.target.value))}
          style={{ flex: 1, accentColor: '#9d4dff', height: 4 }} />
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Blend name…"
          style={{ ...selectStyle, flex: 2 }} />
        <div onClick={busy ? undefined : preview} style={{
          ...MONO, fontSize: 10, color: '#E9D8FF', cursor: busy ? 'default' : 'pointer', padding: '9px 14px',
          borderRadius: 8, background: 'rgba(10,8,26,0.6)', border: '1px solid rgba(170,120,255,0.4)', opacity: busy ? 0.6 : 1,
        }}>▶ PREVIEW</div>
        <div onClick={busy ? undefined : save} style={{
          ...MONO, fontSize: 10, color: '#E9D8FF', cursor: busy ? 'default' : 'pointer', padding: '9px 14px',
          borderRadius: 8, background: 'linear-gradient(90deg, rgba(123,77,255,0.6), rgba(185,108,255,0.46))',
          border: '1px solid rgba(199,166,255,0.5)', opacity: busy ? 0.6 : 1,
        }}>SAVE BLEND</div>
      </div>
      {msg && <div style={{ ...MONO, fontSize: 10, color: '#8E86B8', marginTop: 8 }}>{msg}</div>}
      <div style={{ ...MONO, fontSize: 9, color: '#5E587A', marginTop: 8 }}>
        First-time preview downloads the Kokoro voice model (~120MB, one-time only).
      </div>
    </div>
  )
}

function VoicesTab() {
  const [data, setData] = useState({ builtin: [], blends: [] })
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    getAudiobookVoices().then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { refresh() }, [refresh])

  if (loading) return <div style={{ ...MONO, fontSize: 11, color: '#5E587A', padding: 20 }}>Loading voices…</div>

  return (
    <div style={{ padding: '14px 0' }}>
      <CreateBlendPanel builtin={data.builtin} onCreated={refresh} />

      {data.blends.length > 0 && (
        <>
          <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.28em', color: '#8E86B8', marginBottom: 12 }}>
            YOUR BLENDS ({data.blends.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginBottom: 24 }}>
            {data.blends.map(b => (
              <VoiceCard key={b.id} id={b.id} label={b.name} isBlend
                ratioLabel={b.components.map(c => `${Math.round(c.weight * 100)}% ${c.voice}`).join(' · ')}
                onDelete={() => { if (confirm(`Delete blend "${b.name}"?`)) deleteVoiceBlend(b.id).then(refresh) }} />
            ))}
          </div>
        </>
      )}

      <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.28em', color: '#8E86B8', marginBottom: 12 }}>
        BUILT-IN VOICES ({data.builtin.length})
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {data.builtin.map(v => <VoiceCard key={v.id} id={v.id} label={v.label} isBlend={false} />)}
      </div>
    </div>
  )
}

// ── Import (EPUB/PDF/text → Kokoro TTS) ──────────────────────────────

const PHASE_LABEL = {
  downloading_model: 'Downloading Kokoro voice model (one-time, ~120MB)…',
  synthesizing: 'Narrating…',
  done: 'Done',
  cancelled: 'Cancelled',
  failed: 'Failed',
}

function GenerationProgress({ job }) {
  if (!job) return null
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ ...MONO, fontSize: 10, color: '#8E86B8' }}>{PHASE_LABEL[job.phase] || job.phase}</span>
        <span style={{ ...MONO, fontSize: 10, color: '#8E86B8' }}>{job.pct ?? 0}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'rgba(140,100,255,0.16)', overflow: 'hidden' }}>
        <div style={{
          width: `${job.pct ?? 0}%`, height: '100%', borderRadius: 3,
          background: job.phase === 'failed' ? '#f87171' : 'linear-gradient(90deg, #7B4DFF, #B96CFF)',
          transition: 'width 0.3s ease',
        }} />
      </div>
      {job.error && <div style={{ ...MONO, fontSize: 10, color: '#f87171', marginTop: 6 }}>{job.error}</div>}
    </div>
  )
}

function VoicePicker({ voiceId, blendId, onChange }) {
  const [voices, setVoices] = useState({ builtin: [], blends: [] })
  useEffect(() => { getAudiobookVoices().then(setVoices).catch(() => {}) }, [])
  const value = blendId ? `blend:${blendId}` : voiceId ? `voice:${voiceId}` : ''
  return (
    <select
      value={value}
      onChange={e => {
        const [kind, id] = e.target.value.split(':')
        onChange(kind === 'voice' ? id : null, kind === 'blend' ? id : null)
      }}
      style={{
        background: 'rgba(16,12,38,0.8)', border: '1px solid rgba(140,100,255,0.28)',
        borderRadius: 8, padding: '9px 10px', color: '#EDE8FF', fontSize: 12, outline: 'none', flex: 1,
      }}
    >
      <option value="" disabled>Choose a narrator voice…</option>
      {voices.blends.length > 0 && (
        <optgroup label="Your Blends">
          {voices.blends.map(b => <option key={b.id} value={`blend:${b.id}`}>{b.name}</option>)}
        </optgroup>
      )}
      <optgroup label="Built-in Voices">
        {voices.builtin.map(v => <option key={v.id} value={`voice:${v.id}`}>{v.label}</option>)}
      </optgroup>
    </select>
  )
}

function ImportTab({ onRefresh }) {
  const st = usePlayer()
  const [mode, setMode] = useState('file') // 'file' | 'text'
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [importedBook, setImportedBook] = useState(null)
  const [warning, setWarning] = useState(null)
  const [voiceId, setVoiceId] = useState(null)
  const [blendId, setBlendId] = useState(null)
  const [jobId, setJobId] = useState(null)

  const job = jobId ? st.jobs[jobId] : null

  const reset = () => {
    setTitle(''); setAuthor(''); setText(''); setFile(null)
    setImportedBook(null); setWarning(null); setJobId(null)
  }

  const doImport = async () => {
    setBusy(true); setMsg('')
    try {
      let res
      if (mode === 'file') {
        if (!file) { setMsg('Choose an EPUB or PDF file first.'); setBusy(false); return }
        res = await importAudiobookFile(file, title, author)
      } else {
        if (!title.trim() || !text.trim()) { setMsg('Title and text are both required.'); setBusy(false); return }
        res = await importAudiobookText(title.trim(), author, text)
      }
      setImportedBook(res.book)
      setWarning(res.warning)
      onRefresh()
    } catch (e) {
      setMsg(`Import failed: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  const doGenerate = async () => {
    if (!voiceId && !blendId) { setMsg('Pick a narrator voice first.'); return }
    setBusy(true); setMsg('')
    try {
      const res = await generateAudiobook(importedBook.id, voiceId, blendId, null)
      setJobId(res.job_id)
      onRefresh()
    } catch (e) {
      setMsg(`Couldn't start generation: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  const inputStyle = {
    background: 'rgba(16,12,38,0.8)', border: '1px solid rgba(140,100,255,0.28)',
    borderRadius: 8, padding: '9px 12px', color: '#EDE8FF', fontSize: 12, outline: 'none', width: '100%',
  }

  if (importedBook) {
    return (
      <div style={{ padding: '14px 0', maxWidth: 560 }}>
        <div onClick={reset} style={{ ...MONO, fontSize: 10, letterSpacing: '0.15em', color: '#8E86B8',
          cursor: 'pointer', marginBottom: 14, display: 'inline-block' }}>‹ IMPORT ANOTHER</div>

        <div style={{ ...RAJ, fontSize: 22, fontWeight: 700, color: '#F3EDFF', marginBottom: 4 }}>{importedBook.title}</div>
        <div style={{ ...MONO, fontSize: 11, color: '#8E86B8', marginBottom: 4 }}>
          {importedBook.chapters.length} chapter{importedBook.chapters.length !== 1 ? 's' : ''} detected
        </div>
        {warning && (
          <div style={{ ...MONO, fontSize: 10, color: '#facc15', background: 'rgba(250,204,21,0.08)',
            border: '1px solid rgba(250,204,21,0.3)', borderRadius: 8, padding: '8px 10px', marginTop: 8 }}>
            ⚠ {warning}
          </div>
        )}

        <div style={{ marginTop: 14, maxHeight: 160, overflowY: 'auto', background: 'rgba(10,8,26,0.5)',
          border: '1px solid rgba(150,110,255,0.15)', borderRadius: 10, padding: 8 }}>
          {importedBook.chapters.map(c => (
            <div key={c.index} style={{ ...MONO, fontSize: 11, color: '#8E86B8', padding: '4px 6px' }}>
              {c.index + 1}. {c.title}
            </div>
          ))}
        </div>

        {!jobId ? (
          <>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <VoicePicker voiceId={voiceId} blendId={blendId} onChange={(v, b) => { setVoiceId(v); setBlendId(b) }} />
              <div onClick={busy ? undefined : doGenerate} style={{
                ...MONO, fontSize: 10, color: '#E9D8FF', cursor: busy ? 'default' : 'pointer', padding: '9px 18px',
                borderRadius: 8, background: 'linear-gradient(90deg, rgba(123,77,255,0.7), rgba(185,108,255,0.55))',
                border: '1px solid rgba(199,166,255,0.5)', opacity: busy ? 0.6 : 1, whiteSpace: 'nowrap',
              }}>▶ GENERATE</div>
            </div>
            {msg && <div style={{ ...MONO, fontSize: 10, color: '#f87171', marginTop: 8 }}>{msg}</div>}
          </>
        ) : (
          <>
            <GenerationProgress job={job} />
            <div style={{ ...MONO, fontSize: 10, color: '#5E587A', marginTop: 10 }}>
              You can leave this page — check the IN PROGRESS tab any time, and already-finished chapters play immediately from the Library.
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '14px 0', maxWidth: 560 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['file', 'text'].map(m => (
          <div key={m} onClick={() => setMode(m)} style={{
            ...MONO, fontSize: 10, letterSpacing: '0.15em', padding: '9px 16px', cursor: 'pointer', borderRadius: 8,
            color: mode === m ? '#E9D8FF' : '#8E86B8',
            background: mode === m ? 'rgba(123,77,255,0.28)' : 'rgba(10,8,26,0.5)',
            border: `1px solid ${mode === m ? 'rgba(170,120,255,0.5)' : 'rgba(140,100,255,0.18)'}`,
          }}>{m === 'file' ? 'EPUB / PDF' : 'TYPED TEXT'}</div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (optional for files)" style={inputStyle} />
        <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Author" style={inputStyle} />
      </div>

      {mode === 'file' ? (
        <input type="file" accept=".epub,.pdf" onChange={e => setFile(e.target.files[0] || null)}
          style={{ ...inputStyle, padding: '9px' }} />
      ) : (
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Paste or type the text to narrate…"
          rows={10} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
      )}

      <div onClick={busy ? undefined : doImport} style={{
        ...MONO, fontSize: 10, color: '#E9D8FF', cursor: busy ? 'default' : 'pointer', padding: '10px 18px',
        borderRadius: 8, background: 'linear-gradient(90deg, rgba(123,77,255,0.7), rgba(185,108,255,0.55))',
        border: '1px solid rgba(199,166,255,0.5)', marginTop: 14, display: 'inline-block', opacity: busy ? 0.6 : 1,
      }}>{busy ? 'WORKING…' : mode === 'file' ? 'EXTRACT CHAPTERS' : 'IMPORT TEXT'}</div>
      {msg && <div style={{ ...MONO, fontSize: 10, color: '#f87171', marginTop: 8 }}>{msg}</div>}
    </div>
  )
}

// ── In Progress ───────────────────────────────────────────────────────

function InProgressRow({ book, job }) {
  const dur = totalDuration(book)
  return (
    <div style={{
      background: 'rgba(12,10,30,0.55)', border: '1px solid rgba(150,110,255,0.2)',
      borderRadius: 12, padding: 14, marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <BookCover book={book} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...RAJ, fontSize: 14, fontWeight: 600, color: '#EDE8FF' }}>{book.title}</div>
          <div style={{ ...MONO, fontSize: 10, color: '#8E86B8' }}>{dur.ready} / {dur.total} chapters ready{dur.ready > 0 ? ` — ${fmtTime(dur.seconds)} so far` : ''}</div>
        </div>
        {dur.ready > 0 && (
          <div onClick={() => player.playBook(book.id)} style={{ color: '#C7A6FF', cursor: 'pointer', fontSize: 18 }}>▶</div>
        )}
      </div>
      <GenerationProgress job={job} />
    </div>
  )
}

function InProgressTab({ books }) {
  const st = usePlayer()
  const pending = books.filter(b => b.chapters.some(c => c.status !== 'done'))

  if (!pending.length) {
    return (
      <div style={{ ...MONO, fontSize: 11, color: '#5E587A', padding: '30px 16px', textAlign: 'center' }}>
        Nothing generating right now — start one from the Import tab.
      </div>
    )
  }

  return (
    <div style={{ padding: '14px 0', maxWidth: 620 }}>
      {pending.map(b => {
        const job = Object.values(st.jobs).find(j => j.book_id === b.id)
        return <InProgressRow key={b.id} book={b} job={job} />
      })}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────

export default function AudiobooksPage() {
  const st = usePlayer()
  const [tab, setTab] = useState('LIBRARY')
  const [search, setSearch] = useState('')
  const [, force] = useState(0)
  const refresh = useCallback(() => { player.loadLibrary(); force(n => n + 1) }, [])

  useEffect(() => { player.loadLibrary() }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return st.books
    return st.books.filter(b =>
      b.title.toLowerCase().includes(q) || (b.author || '').toLowerCase().includes(q))
  }, [st.books, search])

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', height: '100%' }}>
      {/* ── Main column ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '26px 28px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(123,77,255,0.5), rgba(185,108,255,0.25))',
            border: '1px solid rgba(170,120,255,0.4)', fontSize: 24,
            boxShadow: '0 0 30px rgba(123,77,255,0.3)',
          }}>📖</div>
          <div>
            <div style={{ ...RAJ, fontSize: 30, fontWeight: 700, letterSpacing: '0.14em', color: '#F3EDFF',
                          textShadow: '0 0 30px rgba(199,166,255,0.4)' }}>AUDIOBOOKS</div>
            <div style={{ fontSize: 12, color: '#8E86B8' }}>Your library. Your narrator. Where you left off.</div>
          </div>
          <div style={{ flex: 1 }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search audiobooks…"
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
        </div>

        {tab === 'COLLECTIONS' ? (
          <CollectionsTab books={st.books} collections={st.collections} onRefresh={refresh} />
        ) : tab === 'VOICES' ? (
          <VoicesTab />
        ) : tab === 'IMPORT' ? (
          <ImportTab onRefresh={refresh} />
        ) : tab === 'IN PROGRESS' ? (
          <InProgressTab books={st.books} />
        ) : (
          <>
            <UploadPanel onUploaded={refresh} />
            <div style={{
              background: 'rgba(10,8,26,0.5)', border: '1px solid rgba(150,110,255,0.18)',
              borderRadius: 16, overflow: 'hidden',
            }}>
              <BookTable books={filtered} onRefresh={refresh} collections={st.collections} />
            </div>
          </>
        )}
      </div>

      {/* ── Right column ── */}
      <div style={{ width: 330, flexShrink: 0, overflowY: 'auto', padding: '26px 22px 26px 0' }}>
        <NowPlaying />
      </div>
    </div>
  )
}
