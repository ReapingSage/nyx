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

export async function openVault() {
  const res = await fetch(`${API_URL}/api/constellation/open-vault`, { method: 'POST' })
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