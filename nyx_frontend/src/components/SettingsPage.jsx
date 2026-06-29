import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { THEMES, BACKGROUND_STYLES } from '../utils/themes.js'
import { useTheme } from '../utils/themeContext.jsx'
import {
  getModelsStatus,
  getStorageStatus, selectStorageProvider, checkStoragePath,
} from '../services/api.js'
// useTheme is used both here (main SettingsPage) and inside AppearanceSection

// ── Settings categories (only used here) ─────────────────────
const SETTINGS_CATEGORIES = [
  { id: 'appearance',    label: 'Appearance',    sym: '◈' },
  { id: 'ai-routing',   label: 'AI Routing',    sym: '⟁' },
  { id: 'performance',  label: 'Performance',   sym: '⚡' },
  { id: 'global-view',  label: 'Global View',   sym: '◎' },
  { id: 'voice',        label: 'Voice & Audio', sym: '♪' },
  { id: 'notifications',label: 'Notifications', sym: '⬡' },
  { id: 'privacy',      label: 'Privacy',       sym: '⊘' },
  { id: 'memory',       label: 'Memory System', sym: '⊕' },
  { id: 'providers',    label: 'Providers',     sym: '⊛' },
  { id: 'automation',   label: 'Automation',    sym: '⟲' },
  { id: 'experimental', label: 'Experimental',  sym: '⊗' },
  { id: 'backup',       label: 'Backup',        sym: '⊡' },
  { id: 'developer',    label: 'Developer',     sym: '⌘' },
  { id: 'logs',         label: 'System Logs',   sym: '≡' },
]

// ── Shared panel styles — CSS vars cascade instantly on theme change ──
const PANEL = {
  background: 'rgba(4,5,18,0.78)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(var(--color-primary-rgb), 0.16)',
  borderRadius: 16,
  padding: '18px 20px',
  marginBottom: 14,
  boxShadow: '0 0 24px rgba(var(--color-primary-rgb), 0.07), inset 0 1px 0 rgba(255,255,255,0.04)',
}
const SEC_TITLE = {
  fontFamily: 'Rajdhani, sans-serif',
  fontSize: 9, fontWeight: 700,
  letterSpacing: '0.26em', textTransform: 'uppercase',
  color: 'var(--color-text-disabled)', display: 'block', marginBottom: 16,
}

// ── ThemeCard ─────────────────────────────────────────────────
function ThemeCard({ theme, isActive, onSelect }) {
  const [hovered, setHovered] = useState(false)
  const p = theme.preview
  return (
    <motion.div
      onClick={() => onSelect(theme.id)}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      animate={{ y: hovered ? -5 : 0 }}
      transition={{ duration: 0.18 }}
      style={{
        background: 'rgba(8,10,26,0.72)',
        border: `1.5px solid ${isActive ? p.primary + 'CC' : hovered ? p.primary + '55' : 'rgba(120,90,220,0.20)'}`,
        borderRadius: 14, padding: '13px 11px', cursor: 'pointer',
        position: 'relative', flexShrink: 0, width: 148,
        boxShadow: isActive ? `0 0 32px ${p.primary}33` : hovered ? `0 8px 28px ${p.primary}1A` : 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {isActive && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          width: 16, height: 16, borderRadius: '50%',
          background: p.primary, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color: '#fff', fontWeight: 700, boxShadow: `0 0 10px ${p.primary}88`,
        }}>✓</div>
      )}
      {/* Mini preview */}
      <div style={{
        width: '100%', height: 50, borderRadius: 8, marginBottom: 9,
        background: p.bg, border: `1px solid ${p.primary}33`, overflow: 'hidden', position: 'relative',
      }}>
        <div style={{ position: 'absolute', top: 5, left: 5, right: 5, height: 13, background: p.surface, borderRadius: 3, border: `1px solid ${p.primary}44` }}/>
        <div style={{
          position: 'absolute', bottom: 5, right: 5, padding: '2px 7px', borderRadius: 3,
          background: p.primary + '55', border: `1px solid ${p.primary}99`,
          fontSize: 6.5, color: p.accent, fontFamily: 'Rajdhani,sans-serif', letterSpacing: '0.12em', fontWeight: 600,
        }}>ACT</div>
        <div style={{ position: 'absolute', bottom: 5, left: 5, display: 'flex', gap: 1.5, alignItems: 'center', height: 10 }}>
          {[3, 7, 4, 9, 5, 3, 8].map((h, i) => (
            <div key={i} style={{ width: 1.5, height: h, background: p.primary, borderRadius: 1, opacity: 0.7 }}/>
          ))}
        </div>
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at 50% 20%, ${p.primary}1A 0%, transparent 70%)`,
          opacity: hovered ? 1 : 0, transition: 'opacity 0.3s',
        }}/>
      </div>
      {/* Swatches */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 7 }}>
        {theme.swatches.map((c, i) => (
          <div key={i} style={{
            width: 10, height: 10, borderRadius: '50%', background: c,
            boxShadow: i === 0 ? `0 0 7px ${c}99` : 'none',
            border: (c.startsWith('#F') || c.startsWith('#E')) ? '1px solid rgba(0,0,0,0.18)' : 'none',
          }}/>
        ))}
      </div>
      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: isActive ? p.accent : '#C7A6FF', marginBottom: 3 }}>{theme.name}</div>
      <div style={{ fontFamily: 'Share Tech Mono', fontSize: 7.5, color: '#5E587A', marginBottom: 5, lineHeight: 1.4 }}>{theme.mood}</div>
      <div style={{ display: 'inline-flex', alignItems: 'center', padding: '1.5px 5px', borderRadius: 3, background: 'rgba(100,75,200,0.10)', border: '1px solid rgba(100,75,200,0.18)', fontFamily: 'Share Tech Mono', fontSize: 7, color: '#5E587A', letterSpacing: '0.08em' }}>LOAD: {theme.performance}</div>
    </motion.div>
  )
}

// ── Controls ──────────────────────────────────────────────────
function SliderControl({ label, value, onChange, min = 0, max = 100, unit = '' }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{label}</span>
        <span style={{ fontFamily: 'Share Tech Mono', fontSize: 9.5, color: 'var(--color-primary)' }}>{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        style={{
          width: '100%', height: 4, appearance: 'none', WebkitAppearance: 'none',
          background: `linear-gradient(to right, var(--color-primary) ${pct}%, rgba(100,75,200,0.22) ${pct}%)`,
          borderRadius: 2, cursor: 'pointer', outline: 'none', border: 'none',
        }}
      />
    </div>
  )
}

function DropdownControl({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ marginBottom: 6 }}>
        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{label}</span>
      </div>
      <select
        value={value} onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '7px 10px',
          background: 'rgba(var(--color-bg-rgb), 0.70)',
          border: '1px solid rgba(var(--color-primary-rgb), 0.22)',
          borderRadius: 7, color: 'var(--color-accent)',
          fontFamily: 'Share Tech Mono', fontSize: 10,
          outline: 'none', cursor: 'pointer',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ background: '#050716', color: '#C7A6FF' }}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function ToggleControl({ label, value, onChange, description }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(var(--color-primary-rgb), 0.08)' }}>
      <div>
        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: description ? 2 : 0 }}>{label}</div>
        {description && <div style={{ fontFamily: 'Share Tech Mono', fontSize: 8.5, color: 'var(--color-text-disabled)' }}>{description}</div>}
      </div>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 36, height: 20, borderRadius: 10, flexShrink: 0, marginLeft: 12,
          background: value ? 'rgba(var(--color-primary-rgb), 0.55)' : 'rgba(60,45,100,0.4)',
          border: value ? '1px solid rgba(var(--color-primary-rgb), 0.60)' : '1px solid rgba(100,75,200,0.22)',
          cursor: 'pointer', position: 'relative',
          boxShadow: value ? '0 0 12px rgba(var(--color-primary-rgb), 0.40)' : 'none',
          transition: 'all 0.22s',
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: value ? 19 : 3,
          width: 12, height: 12, borderRadius: '50%',
          background: value ? 'var(--color-accent)' : '#5E587A',
          transition: 'left 0.22s, background 0.22s',
          boxShadow: value ? '0 0 6px rgba(var(--color-accent-rgb), 0.6)' : 'none',
        }}/>
      </div>
    </div>
  )
}

// ── Live Preview ──────────────────────────────────────────────
function LivePreviewPanel({ theme }) {
  const p = theme.preview
  return (
    <div>
      <span style={SEC_TITLE}>Live Preview</span>
      <div style={{ background: p.bg, border: `1px solid ${p.primary}33`, borderRadius: 12, padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ background: p.surface, border: `1px solid ${p.primary}44`, borderRadius: 9, padding: '10px 12px' }}>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 8, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: p.accent, marginBottom: 7, opacity: 0.7 }}>PANEL</div>
            <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: p.accent, opacity: 0.85, marginBottom: 4 }}>Signal: 12 nodes</div>
            <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: p.primary, opacity: 0.6 }}>Status: ACTIVE</div>
          </div>
          <div style={{ background: p.surface, border: `1px solid ${p.primary}44`, borderRadius: 9, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
            <div style={{ padding: '5px 10px', borderRadius: 5, textAlign: 'center', background: p.primary + '44', border: `1px solid ${p.primary}88`, fontFamily: 'Rajdhani, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', color: p.accent, textTransform: 'uppercase' }}>EXECUTE</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'Share Tech Mono', fontSize: 8, color: p.accent, opacity: 0.6 }}>AUTO MODE</span>
              <div style={{ width: 28, height: 14, borderRadius: 7, background: p.primary + '66', border: `1px solid ${p.primary}99` }}/>
            </div>
          </div>
          <div style={{ background: p.surface, border: `1px solid ${p.primary}44`, borderRadius: 9, padding: '10px 12px', gridColumn: '1 / -1' }}>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 8, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: p.accent, marginBottom: 7, opacity: 0.7 }}>WAVEFORM</div>
            <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 26 }}>
              {[10,18,8,22,14,20,9,16,24,11,19,7,21,15,23,12,17,8,20,14].map((h, i) => (
                <div key={i} style={{ flex: 1, height: h, borderRadius: 1.5, background: p.primary, opacity: 0.45 + (h / 24) * 0.55, boxShadow: h > 18 ? `0 0 4px ${p.primary}88` : 'none' }}/>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Appearance Section ────────────────────────────────────────
function AppearanceSection({ currentTheme, onThemeChange, bgStyle, onBgStyleChange }) {
  const { visualPrefs, setVisualPref } = useTheme()

  const {
    glowIntensity, panelTransparency, fontScale,
    animLevel, uiDensity, highContrast,
    syncGlobalView, syncMemory, syncNetwork, syncVoice,
  } = visualPrefs

  const activeTheme = THEMES.find(t => t.id === currentTheme) || THEMES[0]

  // Panel style derived from live prefs — both transparency and glow intensity are visible here
  const glowMult  = glowIntensity / 75
  const panelAlpha = 0.38 + (panelTransparency / 100) * 0.52
  const dynPANEL = {
    ...PANEL,
    background:  `rgba(4,5,18,${panelAlpha.toFixed(2)})`,
    boxShadow:   `0 0 ${Math.round(24 * glowMult)}px rgba(var(--color-primary-rgb),${(0.07 * glowMult).toFixed(3)}), inset 0 1px 0 rgba(255,255,255,0.04)`,
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Theme Gallery */}
      <div style={dynPANEL}>
        <span style={SEC_TITLE}>Theme Gallery</span>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
          {THEMES.map(t => (
            <ThemeCard key={t.id} theme={t} isActive={currentTheme === t.id} onSelect={onThemeChange} />
          ))}
        </div>
      </div>

      {/* Background Style */}
      <div style={dynPANEL}>
        <span style={SEC_TITLE}>Background Style</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {BACKGROUND_STYLES.map(bg => {
            const active = bgStyle === bg.id
            return (
              <div
                key={bg.id} onClick={() => onBgStyleChange(bg.id)}
                style={{
                  padding: '10px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                  border: `1px solid ${active ? 'rgba(var(--color-primary-rgb), 0.65)' : 'rgba(var(--color-primary-rgb), 0.28)'}`,
                  background: active ? 'rgba(var(--color-primary-rgb), 0.20)' : 'rgba(4,5,18,0.90)',
                  boxShadow: active ? '0 0 14px rgba(var(--color-primary-rgb), 0.22)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: 16, marginBottom: 4, lineHeight: 1 }}>{bg.sym}</div>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 8, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: active ? 'var(--color-accent)' : '#5E587A' }}>{bg.name}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Visual Controls + Theme Sync */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

        {/* Visual Controls — sliders set CSS vars via ThemeContext */}
        <div style={{ ...dynPANEL, marginBottom: 0 }}>
          <span style={SEC_TITLE}>Visual Controls</span>
          <SliderControl
            label="Glow Intensity"     value={glowIntensity}
            onChange={v => setVisualPref('glowIntensity', v)}     unit="%" />
          <SliderControl
            label="Panel Transparency" value={panelTransparency}
            onChange={v => setVisualPref('panelTransparency', v)} unit="%" />
          <SliderControl
            label="Font Scale"         value={fontScale}
            onChange={v => setVisualPref('fontScale', v)} min={80} max={130} unit="%" />
          <DropdownControl
            label="Animation Level" value={animLevel}
            onChange={v => setVisualPref('animLevel', v)}
            options={[
              { value: 'full',    label: 'Full — All Effects' },
              { value: 'reduced', label: 'Reduced — Key Only' },
              { value: 'minimal', label: 'Minimal — Static'   },
            ]}
          />
          <DropdownControl
            label="UI Density" value={uiDensity}
            onChange={v => setVisualPref('uiDensity', v)}
            options={[
              { value: 'spacious', label: 'Spacious' },
              { value: 'normal',   label: 'Normal'   },
              { value: 'compact',  label: 'Compact'  },
            ]}
          />
        </div>

        {/* Theme Sync — persisted in ThemeContext, applied as CSS var overrides per page */}
        <div style={{ ...dynPANEL, marginBottom: 0 }}>
          <span style={SEC_TITLE}>Theme Sync</span>
          <ToggleControl
            label="Global View"    value={syncGlobalView}
            onChange={v => setVisualPref('syncGlobalView', v)}
            description="Apply active theme to map & globe" />
          <ToggleControl
            label="Memory Network" value={syncMemory}
            onChange={v => setVisualPref('syncMemory', v)}
            description="Constellation node & link colors" />
          <ToggleControl
            label="Network Page"   value={syncNetwork}
            onChange={v => setVisualPref('syncNetwork', v)}
            description="Network graph nodes & connections" />
          <ToggleControl
            label="Voice Interface" value={syncVoice}
            onChange={v => setVisualPref('syncVoice', v)}
            description="Waveform & mic overlay colors" />
          <div style={{ marginTop: 12 }}>
            <ToggleControl
              label="High Contrast Mode" value={highContrast}
              onChange={v => setVisualPref('highContrast', v)}
              description="Boost text legibility across all panels" />
          </div>

          {/* Sync status indicators */}
          <div style={{
            marginTop: 14, padding: '9px 12px', borderRadius: 8,
            background: 'rgba(var(--color-primary-rgb),0.05)',
            border: '1px solid rgba(var(--color-primary-rgb),0.10)',
          }}>
            <div style={{ fontFamily: 'Share Tech Mono', fontSize: 8, color: 'var(--color-text-disabled)', letterSpacing: '0.10em', marginBottom: 7 }}>
              SYNC STATUS
            </div>
            {[
              { label: 'Global View',    on: syncGlobalView },
              { label: 'Memory',         on: syncMemory     },
              { label: 'Network',        on: syncNetwork    },
              { label: 'Voice',          on: syncVoice      },
            ].map(({ label, on }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontFamily: 'Share Tech Mono', fontSize: 8.5, color: 'var(--color-text-muted)' }}>{label}</span>
                <span style={{
                  fontFamily: 'Share Tech Mono', fontSize: 7.5, letterSpacing: '0.10em',
                  color: on ? '#22c55e' : '#facc15',
                }}>
                  {on ? '● SYNCED' : '○ LOCKED'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Preview */}
      <div style={dynPANEL}>
        <LivePreviewPanel theme={activeTheme} />
      </div>

      {/* Theme Management */}
      <div style={{ ...dynPANEL, marginBottom: 0 }}>
        <span style={SEC_TITLE}>Theme Management</span>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {['Save Current', 'Export Preset', 'Import Preset'].map(label => (
            <button
              key={label}
              style={{
                fontFamily: 'Rajdhani, sans-serif', fontSize: 10, fontWeight: 700,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                color: 'var(--color-primary)', background: 'none',
                border: '1px solid rgba(var(--color-primary-rgb), 0.30)',
                borderRadius: 7, padding: '7px 14px', cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(var(--color-primary-rgb), 0.12)'; e.currentTarget.style.color = 'var(--color-accent)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--color-primary)' }}
            >{label}</button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Share Tech Mono', fontSize: 8.5, color: '#5E587A', letterSpacing: '0.08em' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }}/>
            THEME ACTIVE
          </div>
        </div>
      </div>
    </div>
  )
}

// ── AI Routing Section ────────────────────────────────────────
function AIRoutingSection() {
  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={PANEL}>
        <span style={SEC_TITLE}>Model Configuration</span>
        {['Primary Model', 'Fallback Model', 'Embedding Model', 'Vision Model', 'Code Model'].map(label => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(var(--color-primary-rgb), 0.08)' }}>
            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{label}</span>
            <span style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'var(--color-text-disabled)', letterSpacing: '0.06em' }}>— NOT CONFIGURED</span>
          </div>
        ))}
        <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(var(--color-primary-rgb), 0.06)', border: '1px solid rgba(var(--color-primary-rgb), 0.12)' }}>
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'var(--color-text-disabled)', lineHeight: 1.7 }}>
            Connect a provider in <span style={{ color: 'var(--color-primary)' }}>Providers</span> to configure model routing.
          </div>
        </div>
      </div>
      <div style={PANEL}>
        <span style={SEC_TITLE}>Routing Strategy</span>
        <DropdownControl label="Default Strategy" value="cost" onChange={() => {}} options={[{ value: 'cost', label: 'Cost Optimized' }, { value: 'performance', label: 'Performance First' }, { value: 'balanced', label: 'Balanced' }]} />
        <ToggleControl label="Auto Fallback"    value={true}  onChange={() => {}} description="Switch model on rate limit or error" />
        <ToggleControl label="Context Caching"  value={false} onChange={() => {}} description="Cache prompts for repeated calls" />
      </div>
    </div>
  )
}

// ── Provider row — shared by AI Models / Tools panels ─────────
function ProviderRow({ sym, name, detail, statusLabel, statusColor, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(var(--color-primary-rgb), 0.08)' }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, border: '1px solid rgba(var(--color-primary-rgb), 0.22)', background: 'rgba(var(--color-primary-rgb), 0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--color-text-muted)' }}>{sym}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{name}</div>
        <div style={{ fontFamily: 'Share Tech Mono', fontSize: 8.5, color: 'var(--color-text-disabled)', marginTop: 1 }}>{detail}</div>
      </div>
      <span style={{ fontFamily: 'Share Tech Mono', fontSize: 8.5, color: statusColor || 'var(--color-text-disabled)', letterSpacing: '0.06em' }}>{statusLabel}</span>
      {action}
    </div>
  )
}

// ── AI Models Panel — real Ollama status + future cloud providers ──
function AIModelsPanel({ onNavigate }) {
  const [ollama, setOllama] = useState(null)

  useEffect(() => {
    getModelsStatus().then(setOllama).catch(() => setOllama({ installed: false, running: false }))
  }, [])

  const cloudProviders = [
    { name: 'Anthropic',       models: 'Claude 4 · Opus · Sonnet · Haiku', sym: '◈' },
    { name: 'OpenAI',          models: 'GPT-4o · o3 · o4-mini',            sym: '◯' },
    { name: 'Google DeepMind', models: 'Gemini 2.0 · Flash · Pro',         sym: '◆' },
    { name: 'Mistral AI',      models: 'Mistral Large · Codestral',        sym: '◐' },
  ]

  const ollamaLabel = ollama === null ? 'CHECKING...' : ollama.running ? 'ACTIVE' : 'OFFLINE'
  const ollamaColor = ollama === null ? 'var(--color-text-disabled)' : ollama.running ? '#22c55e' : '#f87171'

  return (
    <div style={PANEL}>
      <span style={SEC_TITLE}>AI Models</span>
      <div style={{ fontFamily: 'Exo 2, sans-serif', fontSize: 12.5, color: 'var(--color-text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
        These are the language models NYX can think and respond with. Ollama runs models locally on this machine and is the only active provider today — the list below shows what's planned next.
      </div>

      <ProviderRow
        sym="⬡" name="Ollama / Local" detail={ollama?.running ? 'Currently providing every NYX response' : 'Models run on this machine — see Model Manager'}
        statusLabel={ollamaLabel} statusColor={ollamaColor}
        action={
          <button
            onClick={() => onNavigate?.('models')}
            style={{
              fontFamily: 'Rajdhani, sans-serif', fontSize: 9.5, fontWeight: 700,
              letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--color-primary)',
              background: 'none', border: '1px solid rgba(var(--color-primary-rgb), 0.30)',
              borderRadius: 6, padding: '5px 10px', cursor: 'pointer', marginLeft: 10,
            }}
          >Manage</button>
        }
      />

      {cloudProviders.map(p => (
        <ProviderRow key={p.name} sym={p.sym} name={p.name} detail={p.models} statusLabel="COMING SOON" />
      ))}

      <div style={{
        marginTop: 14, padding: '10px 14px', borderRadius: 10,
        background: 'rgba(var(--color-primary-rgb), 0.06)', border: '1px solid rgba(var(--color-primary-rgb), 0.12)',
      }}>
        <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'var(--color-text-disabled)', lineHeight: 1.7 }}>
          NYX is built as a provider system — more AI providers can be added here later without changing how routing works.
        </div>
      </div>
    </div>
  )
}

// ── Storage / Memory Panel — real, functional provider switch ──
function StorageProviderCard({ active, title, subtitle, bullets, onClick, extra }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, minWidth: 220, cursor: onClick ? 'pointer' : 'default',
        padding: '14px 15px', borderRadius: 12,
        background: active ? 'rgba(var(--color-primary-rgb), 0.16)' : 'rgba(8,10,26,0.62)',
        border: `1.5px solid ${active ? 'rgba(var(--color-primary-rgb), 0.55)' : 'rgba(120,90,220,0.20)'}`,
        boxShadow: active ? '0 0 18px rgba(var(--color-primary-rgb), 0.18)' : 'none',
        transition: 'all 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 12.5, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: active ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>{title}</span>
        {active && (
          <span style={{ fontFamily: 'Share Tech Mono', fontSize: 8, color: '#22c55e', letterSpacing: '0.08em' }}>● ACTIVE</span>
        )}
      </div>
      <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'var(--color-text-disabled)', lineHeight: 1.6, marginBottom: bullets ? 8 : 0 }}>{subtitle}</div>
      {bullets && (
        <ul style={{ margin: 0, paddingLeft: 14, fontFamily: 'Share Tech Mono', fontSize: 8.5, color: 'var(--color-text-disabled)', lineHeight: 1.8 }}>
          {bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      )}
      {extra}
    </div>
  )
}

// ── Switch confirmation modal — shown before any storage provider change ──
function SwitchProviderModal({ fromLabel, toLabel, toPath, onConfirm, onCancel, switching }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 400, backdropFilter: 'blur(5px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(4,5,18,0.99)', border: '1px solid rgba(var(--color-primary-rgb), 0.35)',
          borderRadius: 12, padding: 24, maxWidth: 420, width: '90%',
          boxShadow: '0 0 50px rgba(var(--color-primary-rgb), 0.15)',
        }}
      >
        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 11, letterSpacing: '0.22em', color: '#facc15', fontWeight: 700, marginBottom: 12 }}>
          ⚠ SWITCH STORAGE PROVIDER
        </div>
        <div style={{ fontFamily: 'Exo 2, sans-serif', fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
          You're switching from <b style={{ color: 'var(--color-accent)' }}>{fromLabel}</b> to <b style={{ color: 'var(--color-accent)' }}>{toLabel}</b>.
        </div>
        <ul style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--color-text-muted)', lineHeight: 2, marginBottom: 14, paddingLeft: 18 }}>
          <li>New memory notes and logs will be written to <span style={{ color: 'var(--color-primary)' }}>{toPath}</span></li>
          <li>Nothing already saved in {fromLabel} is moved, merged, or deleted</li>
          <li>NYX stops reading from {fromLabel} until you switch back to it</li>
        </ul>
        <div style={{
          fontFamily: 'Share Tech Mono', fontSize: 9.5, color: '#facc15',
          padding: '8px 11px', background: 'rgba(250,204,21,0.08)', borderRadius: 7, marginBottom: 18,
        }}>
          This does not migrate or combine your existing memories — it only changes where new ones go.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '9px 0', background: 'rgba(var(--color-primary-rgb),0.08)',
              border: '1px solid rgba(var(--color-primary-rgb),0.22)', borderRadius: 7,
              color: 'var(--color-text-muted)', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif',
              fontSize: 10.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
            }}
          >Cancel</button>
          <button
            onClick={onConfirm} disabled={switching}
            style={{
              flex: 1, padding: '9px 0',
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
              border: 'none', borderRadius: 7, color: '#fff', cursor: switching ? 'not-allowed' : 'pointer',
              fontFamily: 'Rajdhani, sans-serif', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.14em',
              textTransform: 'uppercase', opacity: switching ? 0.6 : 1,
              boxShadow: '0 0 16px rgba(var(--color-primary-rgb),0.30)',
            }}
          >{switching ? 'Switching...' : 'Confirm Switch'}</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function StorageMemoryPanel() {
  const [status, setStatus]     = useState(null)
  const [pathInput, setPathInput] = useState('')
  const [checkResult, setCheckResult] = useState(null)
  const [checking, setChecking] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [error, setError]       = useState(null)
  const [pendingTarget, setPendingTarget] = useState(null) // { provider, path } | null

  const refresh = useCallback(async () => {
    const st = await getStorageStatus()
    setStatus(st)
    if (st.obsidian_path) setPathInput(st.obsidian_path)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const PROVIDER_LABEL = { nyx_local: 'NYX Local Storage', obsidian: 'Obsidian' }

  function requestSwitchToLocal() {
    setError(null)
    setPendingTarget({ provider: 'nyx_local' })
  }

  async function handleCheckPath() {
    if (!pathInput.trim()) return
    setChecking(true)
    setError(null)
    try {
      const result = await checkStoragePath(pathInput.trim())
      setCheckResult(result)
      if (result.is_dir) {
        setPendingTarget({ provider: 'obsidian', path: result.path })
      } else {
        setError(`Folder not found at "${pathInput.trim()}" — double-check the path, or pick NYX Local Storage instead.`)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setChecking(false)
    }
  }

  async function handleConfirmSwitch() {
    if (!pendingTarget) return
    setSwitching(true)
    setError(null)
    try {
      const st = await selectStorageProvider(pendingTarget.provider, pendingTarget.path)
      setStatus(st)
      setCheckResult(null)
      setPendingTarget(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setSwitching(false)
    }
  }

  if (!status) {
    return (
      <div style={PANEL}>
        <span style={SEC_TITLE}>Storage / Memory</span>
        <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--color-text-disabled)' }}>Loading...</div>
      </div>
    )
  }

  const isLocal    = status.active_provider === 'nyx_local'
  const isObsidian = status.active_provider === 'obsidian'
  const activeLabel = isLocal ? 'NYX Local Storage' : 'Obsidian'

  return (
    <div style={PANEL}>
      <span style={SEC_TITLE}>Storage / Memory</span>
      <div style={{ fontFamily: 'Exo 2, sans-serif', fontSize: 12.5, color: 'var(--color-text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
        This controls where NYX keeps its memory — the notes it remembers about you and the logs of every conversation. Pick whichever fits how you work; switching takes effect immediately and never touches what's already saved in the provider you're leaving.
      </div>

      {/* Active provider banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
        padding: '8px 12px', borderRadius: 8,
        background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.22)',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
        <span style={{ fontFamily: 'Share Tech Mono', fontSize: 9.5, color: '#22c55e', letterSpacing: '0.06em' }}>
          ACTIVE PROVIDER: {activeLabel}
        </span>
        <span style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'var(--color-text-disabled)', marginLeft: 'auto' }}>
          {status.active_vault_path}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <StorageProviderCard
          active={isLocal}
          title="NYX Local Storage"
          subtitle="NYX creates and manages a private folder for you — nothing to set up."
          bullets={[
            'Stored in NYX_VAULT/ inside this install',
            'Works the moment you start chatting',
            'Best if you don’t already use Obsidian',
          ]}
          onClick={!isLocal ? requestSwitchToLocal : undefined}
        />
        <StorageProviderCard
          active={isObsidian}
          title="Obsidian"
          subtitle={status.obsidian_installed ? 'Obsidian detected on this machine.' : "Not detected on this machine — that's fine, any folder works."}
          bullets={[
            'Connects to a vault folder you already use',
            'NYX only reads/writes its own Memory & Logs notes there',
            'Browse, graph, and edit your memories in Obsidian itself',
          ]}
          extra={!status.obsidian_installed && (
            <button
              onClick={(e) => { e.stopPropagation(); window.open('https://obsidian.md', '_blank') }}
              style={{
                marginTop: 9, fontFamily: 'Rajdhani, sans-serif', fontSize: 9, fontWeight: 700,
                letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--color-primary)',
                background: 'none', border: '1px solid rgba(var(--color-primary-rgb), 0.30)',
                borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
              }}
            >Get Obsidian</button>
          )}
        />
      </div>

      <div style={{ marginBottom: 6, fontFamily: 'Rajdhani, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
        Connect an Obsidian vault
      </div>
      <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'var(--color-text-disabled)', marginBottom: 8, lineHeight: 1.6 }}>
        Paste the path to an existing vault folder. NYX checks it exists, then asks you to confirm before switching.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={pathInput}
          onChange={e => { setPathInput(e.target.value); setCheckResult(null); setError(null) }}
          placeholder="C:\Users\you\Documents\MyVault"
          style={{
            flex: 1, minWidth: 200, padding: '8px 10px',
            background: 'rgba(var(--color-bg-rgb), 0.70)',
            border: '1px solid rgba(var(--color-primary-rgb), 0.22)',
            borderRadius: 7, color: 'var(--color-accent)',
            fontFamily: 'Share Tech Mono', fontSize: 10.5, outline: 'none',
          }}
        />
        <button
          onClick={handleCheckPath} disabled={checking || !pathInput.trim()}
          style={{
            fontFamily: 'Rajdhani, sans-serif', fontSize: 10.5, fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fff',
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
            border: 'none', borderRadius: 7, padding: '8px 14px', cursor: 'pointer',
            boxShadow: '0 0 14px rgba(var(--color-primary-rgb),0.30)',
          }}
        >{checking ? 'Checking...' : 'Check & Connect'}</button>
      </div>

      {checkResult?.is_dir && (
        <div style={{ marginTop: 8, fontFamily: 'Share Tech Mono', fontSize: 9.5, color: '#22c55e' }}>
          {checkResult.is_obsidian_vault ? '✓ Valid Obsidian vault folder' : "✓ Folder exists (not yet opened in Obsidian — that's fine)"}
        </div>
      )}
      {error && (
        <div style={{ marginTop: 8, fontFamily: 'Share Tech Mono', fontSize: 9.5, color: '#f87171' }}>{error}</div>
      )}

      <AnimatePresence>
        {pendingTarget && (
          <SwitchProviderModal
            fromLabel={activeLabel}
            toLabel={PROVIDER_LABEL[pendingTarget.provider]}
            toPath={pendingTarget.provider === 'nyx_local' ? 'NYX_VAULT/ (inside this install)' : pendingTarget.path}
            onConfirm={handleConfirmSwitch}
            onCancel={() => setPendingTarget(null)}
            switching={switching}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Tools / Extensions Panel — local tools + future plugin providers ──
function ToolsExtensionsPanel() {
  const localTools = [
    { name: 'Desktop Automation', detail: 'Keyboard, mouse, app launching', sym: '⌘' },
    { name: 'Web Tools',          detail: 'Search, weather, browser control', sym: '◎' },
    { name: 'System Tools',       detail: 'File operations, notifications', sym: '⊡' },
    { name: 'Coding Tools',       detail: 'VS Code / editor integration',  sym: '⟁' },
  ]

  return (
    <div style={PANEL}>
      <span style={SEC_TITLE}>Tools / Extensions</span>
      <div style={{ fontFamily: 'Exo 2, sans-serif', fontSize: 12.5, color: 'var(--color-text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
        Actions NYX can take on this machine — opening apps, browsing the web, managing files. These run locally and don't need any setup or provider connection.
      </div>

      {localTools.map(t => (
        <ProviderRow key={t.name} sym={t.sym} name={t.name} detail={t.detail} statusLabel="ACTIVE" statusColor="#22c55e" />
      ))}

      <div style={{
        marginTop: 14, padding: '10px 14px', borderRadius: 10,
        background: 'rgba(var(--color-primary-rgb), 0.06)', border: '1px dashed rgba(var(--color-primary-rgb), 0.30)',
      }}>
        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-primary)', marginBottom: 4 }}>
          Plugin Providers
        </div>
        <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'var(--color-text-disabled)', lineHeight: 1.6 }}>
          Support for third-party plugin providers is planned for a future release.
        </div>
      </div>
    </div>
  )
}

// ── Providers Section ─────────────────────────────────────────
function ProvidersSection({ onNavigate }) {
  return (
    <div style={{ paddingBottom: 24 }}>
      <AIModelsPanel onNavigate={onNavigate} />
      <StorageMemoryPanel />
      <ToolsExtensionsPanel />
    </div>
  )
}

// ── Performance Section ───────────────────────────────────────
function PerformanceSection() {
  const [renderMode,    setRenderMode]    = useState('cinematic')
  const [shadowQuality, setShadowQuality] = useState('high')
  const [targetFPS,     setTargetFPS]     = useState(60)
  const [particles,     setParticles]     = useState(true)
  const [blurFx,        setBlurFx]        = useState(true)

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={PANEL}>
        <span style={SEC_TITLE}>Render Quality</span>
        <DropdownControl label="Render Mode"    value={renderMode}    onChange={setRenderMode}    options={[{ value: 'cinematic', label: 'Cinematic — Full Quality' }, { value: 'balanced', label: 'Balanced — Most Effects' }, { value: 'performance', label: 'Performance — Minimal' }]} />
        <DropdownControl label="Shadow Quality" value={shadowQuality} onChange={setShadowQuality} options={[{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'off', label: 'Off' }]} />
        <SliderControl   label="Target FPS"     value={targetFPS}     onChange={setTargetFPS} min={24} max={144} />
      </div>
      <div style={PANEL}>
        <span style={SEC_TITLE}>Effect Toggles</span>
        <ToggleControl label="Particle Systems"  value={particles} onChange={setParticles} description="Background particle effects" />
        <ToggleControl label="Backdrop Blur"     value={blurFx}    onChange={setBlurFx}    description="Panel glassmorphism blur" />
        <ToggleControl label="Glow Effects"      value={true}      onChange={() => {}}     description="Neon glow on UI elements" />
        <ToggleControl label="Scan Line Overlay" value={false}     onChange={() => {}}     description="CRT scanline aesthetic" />
      </div>
    </div>
  )
}

// ── Coming Soon ───────────────────────────────────────────────
function ComingSoonSection({ name }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0 40px', gap: 16 }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', border: '1px solid rgba(var(--color-primary-rgb), 0.22)', background: 'rgba(var(--color-primary-rgb), 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>⊗</div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 15, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }}>{name}</div>
        <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9.5, color: 'var(--color-text-disabled)', letterSpacing: '0.07em', lineHeight: 1.75, maxWidth: 260, textAlign: 'center' }}>
          This section is under development.<br/>Configuration available in a future release.
        </div>
      </div>
      <div style={{ padding: '5px 16px', borderRadius: 8, border: '1px solid rgba(var(--color-primary-rgb), 0.22)', background: 'rgba(var(--color-primary-rgb), 0.06)', fontFamily: 'Share Tech Mono', fontSize: 8.5, color: 'var(--color-primary)', letterSpacing: '0.14em' }}>
        COMING SOON
      </div>
    </div>
  )
}

// ── Main SettingsPage ─────────────────────────────────────────
export default function SettingsPage({ onNavigate }) {
  const { themeId, setThemeId, bgStyle, setBgStyle } = useTheme()

  const [activeSection,  setActiveSection]  = useState('appearance')
  const [search,         setSearch]         = useState('')
  const [searchFocused,  setSearchFocused]  = useState(false)

  const activeTheme = THEMES.find(t => t.id === themeId) || THEMES[0]
  const activeCat   = SETTINGS_CATEGORIES.find(c => c.id === activeSection)
  const filteredCats = search
    ? SETTINGS_CATEGORIES.filter(c => c.label.toLowerCase().includes(search.toLowerCase()))
    : SETTINGS_CATEGORIES

  function renderSection() {
    switch (activeSection) {
      case 'appearance':  return <AppearanceSection currentTheme={themeId} onThemeChange={setThemeId} bgStyle={bgStyle} onBgStyleChange={setBgStyle} />
      case 'ai-routing':  return <AIRoutingSection />
      case 'providers':   return <ProvidersSection onNavigate={onNavigate} />
      case 'performance': return <PerformanceSection />
      default:            return <ComingSoonSection name={activeCat?.label || activeSection} />
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Top header */}
      <div style={{
        flexShrink: 0, padding: '15px 24px 13px',
        borderBottom: '1px solid rgba(var(--color-primary-rgb), 0.12)',
        background: 'rgba(4,5,16,0.50)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', gap: 18,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 19, fontWeight: 700, letterSpacing: '0.30em', textTransform: 'uppercase', color: 'var(--color-accent)', textShadow: '0 0 22px rgba(var(--color-accent-rgb), 0.40)' }}>SETTINGS</span>
            <span style={{ fontFamily: 'Share Tech Mono', fontSize: 8.5, color: 'var(--color-text-disabled)', letterSpacing: '0.14em' }}>NYX AI OPERATING ENVIRONMENT</span>
          </div>
        </div>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(var(--color-bg-rgb), 0.70)', backdropFilter: 'blur(10px)',
          border: `1px solid ${searchFocused ? 'rgba(var(--color-primary-rgb), 0.45)' : 'rgba(var(--color-primary-rgb), 0.20)'}`,
          borderRadius: 8, padding: '7px 12px', width: 190, transition: 'border-color 0.2s',
        }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-disabled)' }}>⌕</span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
            placeholder="Search settings..."
            style={{ background: 'none', border: 'none', outline: 'none', fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--color-accent)', width: '100%' }}
          />
        </div>

        {/* Restore defaults */}
        <button
          onClick={() => { setThemeId('nyx-purple'); setBgStyle('deep-space') }}
          style={{
            fontFamily: 'Rajdhani, sans-serif', fontSize: 10, fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--color-text-disabled)', background: 'none',
            border: '1px solid rgba(var(--color-primary-rgb), 0.20)',
            borderRadius: 7, padding: '7px 14px', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-accent)'; e.currentTarget.style.borderColor = 'rgba(var(--color-primary-rgb), 0.45)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-disabled)'; e.currentTarget.style.borderColor = 'rgba(var(--color-primary-rgb), 0.20)' }}
        >Restore Defaults</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Inner nav */}
        <div style={{
          width: 168, flexShrink: 0, overflowY: 'auto',
          borderRight: '1px solid rgba(var(--color-primary-rgb), 0.10)',
          background: 'rgba(4,5,16,0.35)', padding: '10px 0',
        }}>
          {filteredCats.map(cat => {
            const active = activeSection === cat.id
            return (
              <button
                key={cat.id} onClick={() => setActiveSection(cat.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 16px',
                  background: active ? 'rgba(var(--color-primary-rgb), 0.14)' : 'transparent',
                  border: 'none', borderLeft: `2px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
                  cursor: 'pointer', color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  transition: 'all 0.18s', textAlign: 'left',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(var(--color-primary-rgb), 0.07)'; e.currentTarget.style.color = 'var(--color-text-secondary)' } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)' } }}
              >
                <span style={{ fontSize: 13, opacity: active ? 1 : 0.5, lineHeight: 1, flexShrink: 0 }}>{cat.sym}</span>
                <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{cat.label}</span>
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 15, color: 'var(--color-primary)' }}>{activeCat?.sym}</span>
              <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 16, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--color-accent)' }}>{activeCat?.label}</span>
            </div>
            <div style={{ height: 1, background: 'linear-gradient(to right, rgba(var(--color-primary-rgb), 0.28), transparent)' }}/>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {renderSection()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom telemetry */}
      <div style={{
        flexShrink: 0, padding: '7px 24px',
        borderTop: '1px solid rgba(var(--color-primary-rgb), 0.10)',
        background: 'rgba(4,5,16,0.60)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', gap: 22,
      }}>
        {[
          { label: 'THEME',      value: activeTheme.name,                                       color: 'var(--color-primary)' },
          { label: 'BACKGROUND', value: BACKGROUND_STYLES.find(b => b.id === bgStyle)?.name || '—', color: 'var(--color-text-disabled)' },
          { label: 'LOAD',       value: activeTheme.performance,                                color: activeTheme.performance === 'LOW' ? '#22c55e' : 'var(--color-primary)' },
          { label: 'STATUS',     value: 'READY',                                                color: '#22c55e' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontFamily: 'Share Tech Mono', fontSize: 7.5, color: '#3A3555', letterSpacing: '0.12em' }}>{item.label}:</span>
            <span style={{ fontFamily: 'Share Tech Mono', fontSize: 7.5, color: item.color, letterSpacing: '0.10em' }}>{item.value}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' }}/>
          <span style={{ fontFamily: 'Share Tech Mono', fontSize: 7.5, color: '#22c55e', letterSpacing: '0.12em' }}>NYX v2.7.1</span>
        </div>
      </div>
    </div>
  )
}
