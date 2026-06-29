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