import { createContext, useContext, useState, useEffect } from 'react'
import { applyTheme } from './themes.js'

// ── Default visual preferences ─────────────────────────────────
export const DEFAULT_VISUAL_PREFS = {
  glowIntensity:     75,       // 0–100 → --glow-intensity CSS var
  panelTransparency: 52,       // 0–100 → controls panel background alpha
  fontScale:         100,      // 80–130 → --font-scale CSS var
  animLevel:         'full',   // 'full' | 'reduced' | 'minimal' → --anim-scale
  uiDensity:         'normal', // 'spacious' | 'normal' | 'compact'
  highContrast:      false,    // boosts text contrast
  syncGlobalView:    true,     // Global View follows active theme
  syncMemory:        true,     // Memory Constellation follows active theme
  syncNetwork:       true,     // Network Page follows active theme
  syncVoice:         false,    // Voice waveform follows active theme
}

// CSS vars applied to page wrappers when sync is OFF — locks that page to nyx-purple
export const NYX_PURPLE_FREEZE = {
  '--color-primary':        '#7B4DFF',
  '--color-secondary':      '#B96CFF',
  '--color-accent':         '#C7A6FF',
  '--color-primary-rgb':    '123, 77, 255',
  '--color-accent-rgb':     '199, 166, 255',
  '--color-glow':           'rgba(123,77,255,0.55)',
  '--color-border':         'rgba(140,100,255,0.20)',
  '--color-text-secondary': '#B9A6FF',
  '--color-text-muted':     '#8E86B8',
}

export const ThemeContext = createContext({
  themeId:      'nyx-purple',
  setThemeId:   () => {},
  bgStyle:      'deep-space',
  setBgStyle:   () => {},
  visualPrefs:  DEFAULT_VISUAL_PREFS,
  setVisualPref: () => {},
})

export function ThemeProvider({ children }) {
  const [themeId,      setThemeIdRaw]     = useState('nyx-purple')
  const [bgStyle,      setBgStyle]        = useState('deep-space')
  const [visualPrefs,  setVisualPrefsRaw] = useState(DEFAULT_VISUAL_PREFS)

  // Apply default theme on mount
  useEffect(() => { applyTheme('nyx-purple') }, [])

  // Apply CSS vars whenever visual prefs change
  useEffect(() => {
    const root = document.documentElement
    const { glowIntensity, panelTransparency, fontScale, animLevel } = visualPrefs

    // 75 is "baseline" → multiplier of 1.0
    root.style.setProperty('--glow-intensity', (glowIntensity / 75).toFixed(3))
    root.style.setProperty('--panel-opacity',  (panelTransparency / 100).toFixed(3))
    root.style.setProperty('--font-scale',     (fontScale / 100).toFixed(3))

    const speedMap = { full: '1', reduced: '0.5', minimal: '0.05' }
    root.style.setProperty('--anim-scale', speedMap[animLevel] ?? '1')
  }, [
    visualPrefs.glowIntensity,
    visualPrefs.panelTransparency,
    visualPrefs.fontScale,
    visualPrefs.animLevel,
  ])

  const setThemeId = (id) => {
    setThemeIdRaw(id)
    applyTheme(id)
    // If high contrast is active, re-apply text overrides after theme vars are set
    if (visualPrefs.highContrast) {
      requestAnimationFrame(() => {
        const r = document.documentElement
        r.style.setProperty('--color-text-primary',   '#FFFFFF')
        r.style.setProperty('--color-text-secondary', '#EEEEEE')
        r.style.setProperty('--color-text-muted',     '#C0C0C0')
      })
    }
  }

  const setVisualPref = (key, value) => {
    setVisualPrefsRaw(prev => {
      const next = { ...prev, [key]: value }

      if (key === 'highContrast') {
        if (value) {
          const r = document.documentElement
          r.style.setProperty('--color-text-primary',   '#FFFFFF')
          r.style.setProperty('--color-text-secondary', '#EEEEEE')
          r.style.setProperty('--color-text-muted',     '#C0C0C0')
        } else {
          // Restore theme-defined text colors by re-applying current theme
          applyTheme(themeId)
        }
      }

      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ themeId, setThemeId, bgStyle, setBgStyle, visualPrefs, setVisualPref }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
