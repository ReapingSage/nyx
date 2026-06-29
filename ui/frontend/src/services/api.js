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