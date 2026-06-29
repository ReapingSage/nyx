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