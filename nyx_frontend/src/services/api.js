import { API_URL } from '../utils/constants.js'

// ── Core chat request ─────────────────────────────
export async function sendMessage(message) {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() // { response, model, timestamp }
}

// Streams newline-delimited JSON from /api/voice/respond — the real path
// behind the chat overlay (typed or spoken). Calls onEvent(obj) per line,
// where obj is {type:'ack'|'chunk'|'done', ...}. Same reader/decoder/buffer
// pattern as installPlugin above, just against a different endpoint.
export async function sendVoiceRespondStreaming(transcript, wantAudio, onEvent) {
  const res = await fetch(`${API_URL}/api/voice/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, want_audio: wantAudio }),
  })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (!line.trim()) continue
      try { onEvent(JSON.parse(line)) } catch { /* ignore malformed */ }
    }
  }
}

// ── System stats ──────────────────────────────────
export async function getSystemStats() {
  const res = await fetch(`${API_URL}/api/system`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Nyx status ────────────────────────────────────
export async function getNyxStatus() {
  const res = await fetch(`${API_URL}/api/status`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Memory / conversation history ────────────────
export async function getMemory(n = 20) {
  const res = await fetch(`${API_URL}/api/memory?n=${n}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Reset conversation ────────────────────────────
export async function resetConversation() {
  const res = await fetch(`${API_URL}/api/reset`, { method: 'POST' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Constellation ─────────────────────────────────
export async function getConstellation() {
  const res = await fetch(`${API_URL}/api/constellation`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function addMemory(data) {
  const res = await fetch(`${API_URL}/api/constellation/memory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function updateMemory(id, updates) {
  const res = await fetch(`${API_URL}/api/constellation/memory/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function deleteMemory(id) {
  const res = await fetch(`${API_URL}/api/constellation/memory/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function syncConstellation() {
  const res = await fetch(`${API_URL}/api/constellation/sync`, { method: 'POST' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function exportConstellation() {
  const res = await fetch(`${API_URL}/api/constellation/export`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function searchConstellation(query, limit = 10) {
  const res = await fetch(`${API_URL}/api/constellation/search?q=${encodeURIComponent(query)}&limit=${limit}`)
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail || `HTTP ${res.status}`)
  }
  return res.json() // { query, results: [{score, text, source_type, source_id}], mode, message }
}

export async function openVault() {
  const res = await fetch(`${API_URL}/api/constellation/open-vault`, { method: 'POST' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function getCategories() {
  const res = await fetch(`${API_URL}/api/constellation/categories`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() // { categories: [{id, name, description, parent_id}] }
}

export async function getAllNodeCategories() {
  const res = await fetch(`${API_URL}/api/constellation/node-categories`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() // { assignments: { [nodeId]: [{category_id, confidence, source}] } }
}

export async function setNodeCategory(nodeId, categoryId, add = true) {
  const res = await fetch(`${API_URL}/api/constellation/nodes/${nodeId}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category_id: categoryId, add }),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function categorizeAll() {
  const res = await fetch(`${API_URL}/api/constellation/categorize`, { method: 'POST' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function discoverRelationships() {
  const res = await fetch(`${API_URL}/api/constellation/discover-relationships`, { method: 'POST' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function setPrimaryCategory(nodeId, categoryId) {
  const res = await fetch(`${API_URL}/api/constellation/nodes/${nodeId}/categories/primary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category_id: categoryId }),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function confirmNodeCategory(nodeId, categoryId) {
  const res = await fetch(`${API_URL}/api/constellation/nodes/${nodeId}/categories/${categoryId}/confirm`, { method: 'POST' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function rejectNodeCategory(nodeId, categoryId) {
  const res = await fetch(`${API_URL}/api/constellation/nodes/${nodeId}/categories/${categoryId}/reject`, { method: 'POST' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function getCategoryCounts() {
  const res = await fetch(`${API_URL}/api/constellation/category-counts`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() // { counts: { [categoryId]: number } }
}

export async function renameCategory(categoryId, name) {
  const res = await fetch(`${API_URL}/api/constellation/categories/${categoryId}/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function setCategoryColor(categoryId, color) {
  const res = await fetch(`${API_URL}/api/constellation/categories/${categoryId}/color`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ color }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function restoreCategoryColor(categoryId) {
  const res = await fetch(`${API_URL}/api/constellation/categories/${categoryId}/color/restore`, { method: 'POST' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function mergeCategory(categoryId, intoId) {
  const res = await fetch(`${API_URL}/api/constellation/categories/${categoryId}/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ into_id: intoId }),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function confirmEdge(edgeId, confirmed) {
  const res = await fetch(`${API_URL}/api/constellation/edges/${edgeId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmed }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Network Operations ────────────────────────────
export async function getNetworkStatus() {
  const res = await fetch(`${API_URL}/api/network/status`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function testConnections() {
  const res = await fetch(`${API_URL}/api/network/test-connections`, { method: 'POST' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function getNetworkLogs(limit = 30) {
  const res = await fetch(`${API_URL}/api/network/logs?limit=${limit}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function emergencyDisconnect() {
  const res = await fetch(`${API_URL}/api/network/emergency-disconnect`, { method: 'POST' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function reconnectSystems() {
  const res = await fetch(`${API_URL}/api/network/reconnect`, { method: 'POST' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Model Manager ──────────────────────────────────
export async function getModelsStatus() {
  const res = await fetch(`${API_URL}/api/models/status`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function getModelsList() {
  const res = await fetch(`${API_URL}/api/models/list`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function getRecommendedModels(profile = 'desktop') {
  const res = await fetch(`${API_URL}/api/models/recommended?profile=${profile}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function assignModelRole(role, model) {
  const res = await fetch(`${API_URL}/api/models/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, model }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function deleteModel(name) {
  const res = await fetch(`${API_URL}/api/models/${encodeURIComponent(name)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── OpenClaw ────────────────────────────────────────
export async function getOpenClawStatus() {
  const res = await fetch(`${API_URL}/api/openclaw/status`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function testOpenClaw() {
  const res = await fetch(`${API_URL}/api/openclaw/test`, { method: 'POST' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Storage / Memory Provider ──────────────────────
export async function getStorageStatus() {
  const res = await fetch(`${API_URL}/api/providers/storage/status`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function selectStorageProvider(provider, obsidianPath) {
  const res = await fetch(`${API_URL}/api/providers/storage/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, obsidian_path: obsidianPath || null }),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function checkStoragePath(path) {
  const res = await fetch(`${API_URL}/api/providers/storage/check-path`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// Streams newline-delimited JSON progress objects from Ollama's pull API.
// Calls onProgress(obj) for each line as it arrives.
export async function pullModel(name, onProgress) {
  const res = await fetch(`${API_URL}/api/models/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (!line.trim()) continue
      try { onProgress(JSON.parse(line)) } catch { /* ignore malformed line */ }
    }
  }
}

// ── App Settings (Voice, Notifications, Privacy, Automation, Experimental) ──
export async function getSettingsSection(section) {
  const res = await fetch(`${API_URL}/api/settings/${section}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function updateSettingsSection(section, updates) {
  const res = await fetch(`${API_URL}/api/settings/${section}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function getPermissionsInfo() {
  const res = await fetch(`${API_URL}/api/permissions/info`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function testNotification(title, message) {
  const res = await fetch(`${API_URL}/api/notifications/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, message }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Events ──────────────────────────────────────────
export async function getEvents(limit = 50, category = null) {
  const params = new URLSearchParams({ limit })
  if (category) params.set('category', category)
  const res = await fetch(`${API_URL}/api/events?${params}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Tasks ───────────────────────────────────────────
export async function getTasks() {
  const res = await fetch(`${API_URL}/api/tasks`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function createTask(name, status = 'PENDING', type = 'general') {
  const res = await fetch(`${API_URL}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, status, type }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function updateTask(id, updates) {
  const res = await fetch(`${API_URL}/api/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function deleteTask(id) {
  const res = await fetch(`${API_URL}/api/tasks/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// The Tasks page's "AI Task" queue runs entirely client-side (calls
// /api/chat directly, tracks status in a local reducer) — this is its only
// touchpoint with the backend, so a finished AI task can proactively
// notify (toast + voice + chat) instead of only updating in-page state.
// Fire-and-forget: a failed notify shouldn't disrupt the task UI itself.
export async function notifyAiTaskComplete(title, ok = true) {
  try {
    await fetch(`${API_URL}/api/tasks/ai-task-complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, ok }),
    })
  } catch { /* non-fatal */ }
}

// ── Reminders ───────────────────────────────────────
export async function getReminders() {
  const res = await fetch(`${API_URL}/api/reminders`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function createReminder(name, dueAt) {
  const res = await fetch(`${API_URL}/api/reminders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, due_at: dueAt }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function deleteReminder(id) {
  const res = await fetch(`${API_URL}/api/reminders/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── System Logs ─────────────────────────────────────
export async function getLogsTail(lines = 200) {
  const res = await fetch(`${API_URL}/api/logs/tail?lines=${lines}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Developer diagnostics ───────────────────────────
export async function getDevInfo() {
  const res = await fetch(`${API_URL}/api/dev/info`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Music (The Forge) ───────────────────────────────
export async function getMusicLibrary() {
  const res = await fetch(`${API_URL}/api/music/library`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function uploadMusic(files) {
  const formData = new FormData()
  for (const f of files) formData.append('files', f)
  const res = await fetch(`${API_URL}/api/music/upload`, { method: 'POST', body: formData })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function musicFileUrl(trackId) {
  return `${API_URL}/api/music/file/${trackId}`
}

export async function updateTrack(trackId, updates) {
  const res = await fetch(`${API_URL}/api/music/track/${trackId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function deleteTrack(trackId) {
  const res = await fetch(`${API_URL}/api/music/track/${trackId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function createMusicPlaylist(name, trackIds) {
  const res = await fetch(`${API_URL}/api/music/playlists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, track_ids: trackIds }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function deleteMusicPlaylist(id) {
  const res = await fetch(`${API_URL}/api/music/playlists/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function renamePlaylist(id, name) {
  const res = await fetch(`${API_URL}/api/music/playlists/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function addTrackToPlaylist(playlistId, trackId) {
  const res = await fetch(`${API_URL}/api/music/playlists/${playlistId}/tracks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ track_id: trackId }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function removeTrackFromPlaylist(playlistId, trackId) {
  const res = await fetch(`${API_URL}/api/music/playlists/${playlistId}/tracks/${trackId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function setPlaylistBanner(playlistId, file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_URL}/api/music/playlists/${playlistId}/banner`, { method: 'POST', body: formData })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function clearPlaylistBanner(playlistId) {
  const res = await fetch(`${API_URL}/api/music/playlists/${playlistId}/banner`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// Custom banner image URL (cache-busted so a re-upload shows immediately)
export function playlistBannerUrl(playlistId, v) {
  return `${API_URL}/api/music/banner/${playlistId}${v ? `?v=${v}` : ''}`
}

export async function addSoundCloud(url) {
  const res = await fetch(`${API_URL}/api/music/soundcloud`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function getWatchFolders() {
  const res = await fetch(`${API_URL}/api/music/watch-folders`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function addWatchFolder(path) {
  const res = await fetch(`${API_URL}/api/music/watch-folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function removeWatchFolder(path) {
  const res = await fetch(`${API_URL}/api/music/watch-folders`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function scanMusicNow() {
  const res = await fetch(`${API_URL}/api/music/scan`, { method: 'POST' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Audiobooks (The Forge) ───────────────────────────
export async function getAudiobookLibrary() {
  const res = await fetch(`${API_URL}/api/audiobooks/library`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function uploadAudiobookFiles(files) {
  const formData = new FormData()
  for (const f of files) formData.append('files', f)
  const res = await fetch(`${API_URL}/api/audiobooks/upload`, { method: 'POST', body: formData })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function audiobookFileUrl(bookId, chapterIndex) {
  return `${API_URL}/api/audiobooks/file/${bookId}/${chapterIndex}`
}

export async function updateAudiobook(bookId, updates) {
  const res = await fetch(`${API_URL}/api/audiobooks/book/${bookId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function deleteAudiobook(bookId) {
  const res = await fetch(`${API_URL}/api/audiobooks/book/${bookId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function updateAudiobookPosition(bookId, positionSeconds, chapterIndex) {
  const res = await fetch(`${API_URL}/api/audiobooks/book/${bookId}/position`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ position_seconds: positionSeconds, chapter_index: chapterIndex }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function setBookCover(bookId, file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_URL}/api/audiobooks/book/${bookId}/cover`, { method: 'POST', body: formData })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function clearBookCover(bookId) {
  const res = await fetch(`${API_URL}/api/audiobooks/book/${bookId}/cover`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function bookCoverUrl(bookId, v) {
  return `${API_URL}/api/audiobooks/cover/${bookId}${v ? `?v=${v}` : ''}`
}

export async function createAudiobookCollection(name, bookIds) {
  const res = await fetch(`${API_URL}/api/audiobooks/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, book_ids: bookIds }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function deleteAudiobookCollection(id) {
  const res = await fetch(`${API_URL}/api/audiobooks/collections/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function renameAudiobookCollection(id, name) {
  const res = await fetch(`${API_URL}/api/audiobooks/collections/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function addBookToCollection(collectionId, bookId) {
  const res = await fetch(`${API_URL}/api/audiobooks/collections/${collectionId}/books`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ book_id: bookId }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function removeBookFromCollection(collectionId, bookId) {
  const res = await fetch(`${API_URL}/api/audiobooks/collections/${collectionId}/books/${bookId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function setCollectionBanner(collectionId, file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_URL}/api/audiobooks/collections/${collectionId}/banner`, { method: 'POST', body: formData })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function clearCollectionBanner(collectionId) {
  const res = await fetch(`${API_URL}/api/audiobooks/collections/${collectionId}/banner`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function collectionBannerUrl(collectionId, v) {
  return `${API_URL}/api/audiobooks/collections/${collectionId}/banner${v ? `?v=${v}` : ''}`
}

export async function getAudiobookVoices() {
  const res = await fetch(`${API_URL}/api/audiobooks/voices`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function createVoiceBlend(name, components) {
  const res = await fetch(`${API_URL}/api/audiobooks/voices/blend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, components }),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function deleteVoiceBlend(blendId) {
  const res = await fetch(`${API_URL}/api/audiobooks/voices/blend/${blendId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function previewVoiceUrl(idOrBlendId, isBlend) {
  return `${API_URL}/api/audiobooks/voices/preview/${idOrBlendId}${isBlend ? '?is_blend=true' : ''}`
}

export async function previewVoiceAdhoc(components) {
  const res = await fetch(`${API_URL}/api/audiobooks/voices/preview-adhoc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ components }),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail || `HTTP ${res.status}`)
  }
  return res.blob()
}

export async function importAudiobookFile(file, title, author) {
  const formData = new FormData()
  formData.append('file', file)
  if (title) formData.append('title', title)
  formData.append('author', author || '')
  const res = await fetch(`${API_URL}/api/audiobooks/import-file`, { method: 'POST', body: formData })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function importAudiobookText(title, author, text) {
  const res = await fetch(`${API_URL}/api/audiobooks/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, author, text }),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function generateAudiobook(bookId, voiceId, voiceBlendId, chapterIndices) {
  const res = await fetch(`${API_URL}/api/audiobooks/${bookId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voice_id: voiceId, voice_blend_id: voiceBlendId, chapter_indices: chapterIndices }),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function getAudiobookJob(jobId) {
  const res = await fetch(`${API_URL}/api/audiobooks/jobs/${jobId}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function cancelAudiobookJob(jobId) {
  const res = await fetch(`${API_URL}/api/audiobooks/jobs/${jobId}/cancel`, { method: 'POST' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Plugins (SageTech MarketPlace) ──────────────────
export async function getPlugins() {
  const res = await fetch(`${API_URL}/api/plugins`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// Streams newline-delimited JSON install progress. Calls onProgress(obj) per line.
export async function installPlugin(id, onProgress) {
  const res = await fetch(`${API_URL}/api/plugins/${id}/install`, { method: 'POST' })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (!line.trim()) continue
      try { onProgress(JSON.parse(line)) } catch { /* ignore malformed */ }
    }
  }
}

export async function uninstallPlugin(id) {
  const res = await fetch(`${API_URL}/api/plugins/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Backup / Restore ────────────────────────────────
export function getBackupExportUrl() {
  return `${API_URL}/api/backup/export`
}

export async function importBackup(file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_URL}/api/backup/import`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Workers (Agents dashboard) ───────────────────────
// Distinct from the older /api/agents (agents_store) endpoints above —
// these back the real specialized workers: Momus, Hemera, Analyst, OpenClaw.
export async function getWorkers() {
  const res = await fetch(`${API_URL}/api/workers`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() // { workers: [...] }
}

export async function getWorker(id) {
  const res = await fetch(`${API_URL}/api/workers/${id}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function setWorkerProviderKey(id, provider, key) {
  const res = await fetch(`${API_URL}/api/workers/${id}/providers/key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, key }),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function removeWorkerProviderKey(id, provider) {
  const res = await fetch(`${API_URL}/api/workers/${id}/providers/${provider}/key`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function setWorkerPriority(id, order) {
  const res = await fetch(`${API_URL}/api/workers/${id}/priority`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order }),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function testWorkerProvider(id, provider) {
  const res = await fetch(`${API_URL}/api/workers/${id}/providers/${provider}/test`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() // { ok, message }
}
