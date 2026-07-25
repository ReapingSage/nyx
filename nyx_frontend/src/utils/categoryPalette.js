/**
 * categoryPalette.js — the single source of truth for category colors.
 *
 * One curated, saturated `base` hex per category (id must match
 * core/category_manager.py's taxonomy exactly). Every other visual
 * variant — emissive, glow, connection, selected, hover, dimmed — is
 * derived from that one base color through consistent HSL math, so the
 * whole palette can be re-tuned by editing 17 base colors instead of
 * ~120 hand-authored values scattered across components.
 *
 * A category's `custom_color` from the backend (core/category_manager.py
 * set_category_color) always wins over the default base below — call
 * getCategoryColors(id, customColor) with the value from
 * GET /api/constellation/categories.
 */
import * as THREE from 'three'

// Deep purple, reserved for the Constellation core itself — no category
// may reuse this exact hue/lightness so the core never gets confused for
// a node.
export const CORE_COLOR = 0x7b4dff
export const CORE_COLOR_HI = 0xc7a6ff

// Decorative background starfield — deliberately desaturated and dim so
// real memory nodes never have to compete with it for attention.
export const STAR_COLOR = 0x8a86a8

const BASE_COLORS = {
  decisions:            0xff3b4e, // red
  goals:                0xff6a3d, // red-orange
  hardware:             0xff9f1c, // orange
  documents:            0xffc93c, // amber / gold
  ideas:                0xf4e04d, // yellow
  research:             0xc4e538, // yellow-green
  software:             0x2ed47a, // green
  tasks:                0x1fd1a5, // spring green / teal
  technology:           0x00c2d1, // cyan
  servers_network:      0x2e9eff, // sky blue
  projects:             0x5d5fef, // blue-indigo
  ai_models:            0xa855f7, // violet (distinct from core purple)
  personal_knowledge:   0xb57bff, // light violet
  people:               0xd946ef, // magenta-violet
  events:               0xf345c6, // pink-magenta
  preferences:          0xff4fa3, // hot pink
  uncategorized:        0x9497a6, // neutral gray — reads as "needs a look", not a real identity
}

const _cache = new Map()

function deriveVariants(baseHex) {
  const base = new THREE.Color(baseHex)
  const hsl = { h: 0, s: 0, l: 0 }
  base.getHSL(hsl)

  const clamp = (v) => Math.min(1, Math.max(0, v))
  const withL = (dl, ds = 0) =>
    new THREE.Color().setHSL(hsl.h, clamp(hsl.s + ds), clamp(hsl.l + dl)).getHex()

  return {
    base: base.getHex(),
    emissive: withL(0.12),
    glowIntensity: clamp(0.55 + hsl.l * 0.4),
    connection: withL(-0.08, -0.1),
    selected: withL(0.3, 0.15),
    hover: withL(0.18, 0.05),
    // Inactive/dimmed nodes must stay clearly identifiable — never the
    // near-invisible ~16% opacity this replaces. Dimming here lowers
    // lightness/saturation a bit; opacity (35-50%) is applied separately
    // by the renderer on top of this color.
    dimmed: withL(-0.12, -0.25),
  }
}

/**
 * Returns { base, emissive, glowIntensity, connection, selected, hover,
 * dimmed } as THREE-ready hex numbers. `customColor` (hex string like
 * "#ff8800" from a category's persisted override) takes priority over the
 * curated default when present.
 */
export function getCategoryColors(categoryId, customColor = null) {
  const baseHex = customColor
    ? new THREE.Color(customColor).getHex()
    : (BASE_COLORS[categoryId] ?? BASE_COLORS.uncategorized)

  const cacheKey = `${categoryId}:${customColor || ''}`
  if (_cache.has(cacheKey)) return _cache.get(cacheKey)

  const variants = deriveVariants(baseHex)
  _cache.set(cacheKey, variants)
  return variants
}

export function getCategoryBaseColor(categoryId, customColor = null) {
  return getCategoryColors(categoryId, customColor).base
}

export function categoryColorCss(categoryId, customColor = null) {
  return `#${getCategoryColors(categoryId, customColor).base.toString(16).padStart(6, '0')}`
}

export const DEFAULT_CATEGORY_IDS = Object.keys(BASE_COLORS)
