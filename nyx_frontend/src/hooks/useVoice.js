/**
 * useVoice.js — NYX Voice Hook
 *
 * - Auto-starts wake word mode on mount (always on unless user turns it off)
 * - Enumerates real microphones, auto-skips virtual/voice-changer devices
 * - Claims the real mic via getUserMedia so Chrome uses it for SpeechRecognition
 * - Fresh SR instance every cycle so Chrome never silently drops it
 * - Ack phrase audio plays before AI response
 * - "type that" / "text only" → skips audio; "voice mode" → re-enables
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { API_URL } from '../utils/constants.js'

// Any transcript containing these strings triggers wake — kept broad so quiet/slurred speech still works
const WAKE_WORDS = [
  'nyx', 'nix', 'nicks', 'nick',           // single word — most lenient
  'hey nyx', 'hey nix', 'hey nicks',
  'hay nyx', 'hay nix', 'hay nicks',        // "hay" mishearing
  'hey next', 'hey knicks', 'hey mix',      // other mishearings
  'a nyx', 'annex',
]

const TEXT_MODE_ON  = ['type that', 'write that', 'show text', 'text only', 'type it', 'write it', 'can you type']
const TEXT_MODE_OFF = ['voice mode', 'speak that', 'say that', 'voice response', 'talk to me']

// Device name patterns that indicate virtual / voice-changer hardware
const VIRTUAL_PATTERNS = [
  'virtual', 'voicemod', 'voicemeeter', 'vb-audio', 'vb audio',
  'cable input', 'cable output', 'morphvox', 'clownfish',
  'ndi audio', 'obs', 'streamlabs', 'elgato wave link',
  'nvidia broadcast', 'krisp', 'rtx voice',
  'sound mapper', 'primary sound',  // Windows pass-throughs that route to system default
  'usb 2.0 camera', 'usb audio device',
]

const isVirtualDevice = (label = '') => {
  const l = label.toLowerCase()
  return VIRTUAL_PATTERNS.some(p => l.includes(p))
}

export const VOICE_STATUS = {
  IDLE:          'IDLE',
  WAKE_LISTEN:   'LISTENING FOR WAKE WORD',
  WAKE_DETECTED: 'WAKE WORD DETECTED',
  RECORDING:     'LISTENING...',
  PROCESSING:    'PROCESSING SPEECH',
  THINKING:      'THINKING',
  SPEAKING:      'SPEAKING',
  ERROR:         'ERROR',
}

export function useVoice({ onMessage, onOrbState }) {
  const [status,          setStatus]          = useState(VOICE_STATUS.IDLE)
  const [wakeMode,        setWakeMode]        = useState(true)   // on by default
  const [textOnly,        setTextOnly]        = useState(false)
  const [audioDevices,    setAudioDevices]    = useState([])
  const [selectedDevice,  setSelectedDevice]  = useState(null)   // { deviceId, label }

  const wakeModeRef        = useRef(true)
  const textOnlyRef        = useRef(false)
  const phaseRef           = useRef('idle')
  const recognRef          = useRef(null)
  const audioRef           = useRef(null)
  const ackAudioRef        = useRef(null)
  const userMediaRef       = useRef(null)   // held open so Chrome uses the right mic
  const selectedDeviceRef  = useRef(null)   // deviceId string

  const onWakeDetectedRef     = useRef(null)
  const startWakeListeningRef = useRef(null)

  useEffect(() => { wakeModeRef.current = wakeMode },   [wakeMode])
  useEffect(() => { textOnlyRef.current = textOnly },   [textOnly])

  // ── Enumerate real microphones, auto-select first non-virtual ────
  useEffect(() => {
    const enumerate = async () => {
      try {
        // Permission request first so labels are populated
        await navigator.mediaDevices.getUserMedia({ audio: true })
          .then(s => s.getTracks().forEach(t => t.stop()))
          .catch(() => {})

        const all  = await navigator.mediaDevices.enumerateDevices()
        const mics = all.filter(d => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'communications')

        setAudioDevices(mics)

        const real = mics.find(d => !isVirtualDevice(d.label)) ?? mics[0]
        if (real) {
          setSelectedDevice({ deviceId: real.deviceId, label: real.label })
          selectedDeviceRef.current = real.deviceId
          await claimDevice(real.deviceId)
        }
      } catch {}
    }
    enumerate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-claim mic when user changes the selected device
  useEffect(() => {
    if (!selectedDevice) return
    selectedDeviceRef.current = selectedDevice.deviceId
    claimDevice(selectedDevice.deviceId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDevice?.deviceId])

  // Claim a specific physical mic so Chrome's Speech Recognition uses it
  const claimDevice = async (deviceId) => {
    try {
      userMediaRef.current?.getTracks().forEach(t => t.stop())
      // Disable all Chrome audio processing — pro mics don't need it, it kills sensitivity
      const base = {
        echoCancellation: false, noiseSuppression: false, autoGainControl: false,
        googEchoCancellation: false, googAutoGainControl: false,
        googNoiseSuppression: false, googHighpassFilter: false,
      }
      const constraints = deviceId
        ? { audio: { deviceId: { exact: deviceId }, ...base } }
        : { audio: base }
      userMediaRef.current = await navigator.mediaDevices.getUserMedia(constraints)
    } catch {}
  }

  // Release mic on unmount
  useEffect(() => {
    return () => { userMediaRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  // ── WebSocket: Python background listener events ──────────────────
  useEffect(() => {
    let ws, retryTimer
    const connect = () => {
      try {
        // Derive from API_URL so there's exactly one place the backend
        // address lives (and it stays 127.0.0.1, not slow-resolving localhost)
        ws = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/ws/voice`)
        ws.onmessage = (e) => {
          try {
            const d = JSON.parse(e.data)
            if (d.type === 'wake_word_detected' && phaseRef.current !== 'recording') {
              onWakeDetectedRef.current?.()
            }
          } catch {}
        }
        ws.onerror = () => {}
        ws.onclose = () => { retryTimer = setTimeout(connect, 5000) }
      } catch {}
    }
    connect()
    return () => { ws?.close(); clearTimeout(retryTimer) }
  }, [])

  // ── Transcript → backend AI → ack audio → response audio ─────────
  const handleTranscript = useCallback(async (transcript) => {
    phaseRef.current = 'responding'
    setStatus(VOICE_STATUS.THINKING)
    onOrbState('thinking')
    onMessage({ role: 'user', text: transcript })

    const lower = transcript.toLowerCase()
    if (TEXT_MODE_ON.some(p => lower.includes(p))) {
      setTextOnly(true); textOnlyRef.current = true
    } else if (TEXT_MODE_OFF.some(p => lower.includes(p))) {
      setTextOnly(false); textOnlyRef.current = false
    }

    try {
      const res = await fetch(`${API_URL}/api/voice/respond`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ transcript }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      onMessage({ role: 'nyx', text: data.response })

      const afterAll = () => {
        const inWake = wakeModeRef.current
        phaseRef.current = inWake ? 'wake_listen' : 'idle'
        setStatus(inWake ? VOICE_STATUS.WAKE_LISTEN : VOICE_STATUS.IDLE)
        onOrbState('idle')
        if (inWake) {
          // Delay so Chrome fully releases the mic before we open a new SR session
          setTimeout(() => {
            if (wakeModeRef.current && phaseRef.current === 'wake_listen') {
              startWakeListeningRef.current?.()
            }
          }, 800)
        }
      }

      const playResponse = () => {
        if (data.audio_url && !textOnlyRef.current) {
          const audio = new Audio(`${API_URL}${data.audio_url}`)
          audioRef.current = audio
          audio.onended = afterAll
          audio.onerror = afterAll
          audio.play().catch(afterAll)
        } else {
          afterAll()
        }
      }

      if (!textOnlyRef.current && (data.ack_audio_url || data.audio_url)) {
        setStatus(VOICE_STATUS.SPEAKING)
        onOrbState('speaking')
        if (data.ack_audio_url) {
          const ack = new Audio(`${API_URL}${data.ack_audio_url}`)
          ackAudioRef.current = ack
          ack.onended = playResponse
          ack.onerror = playResponse
          ack.play().catch(playResponse)
        } else {
          playResponse()
        }
      } else {
        afterAll()
      }
    } catch (err) {
      console.error('[useVoice] backend error:', err)
      setStatus(VOICE_STATUS.ERROR)
      onOrbState('idle')
      setTimeout(() => {
        setStatus(wakeModeRef.current ? VOICE_STATUS.WAKE_LISTEN : VOICE_STATUS.IDLE)
      }, 2500)
    }
  }, [onMessage, onOrbState])

  // ── Record command after wake word ────────────────────────────────
  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    try { recognRef.current?.abort() } catch {}
    const r = new SR()
    recognRef.current = r
    r.lang            = 'en-US'
    r.continuous      = true   // keep listening until silence — don't cut off mid-sentence
    r.interimResults  = true
    r.maxAlternatives = 3

    phaseRef.current = 'recording'
    setStatus(VOICE_STATUS.RECORDING)
    onOrbState('listening')

    let silenceTimer  = null
    let lastTranscript = ''

    const resetSilenceTimer = () => {
      clearTimeout(silenceTimer)
      // Submit after 1.5 s of silence
      silenceTimer = setTimeout(() => {
        if (phaseRef.current === 'recording' && lastTranscript) {
          try { r.abort() } catch {}
          handleTranscript(lastTranscript)
        }
      }, 1500)
    }

    // Hard cutoff at 30 s so it never hangs forever
    const hardStop = setTimeout(() => {
      if (phaseRef.current === 'recording') {
        try { r.abort() } catch {}
        if (lastTranscript) handleTranscript(lastTranscript)
      }
    }, 30000)

    r.onresult = (e) => {
      const text = Array.from(e.results).map(res => res[0].transcript).join(' ').trim()
      if (text) {
        lastTranscript = text
        resetSilenceTimer()
      }
    }

    r.onerror = (e) => {
      clearTimeout(silenceTimer)
      clearTimeout(hardStop)
      recognRef.current = null
      phaseRef.current  = 'idle'
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setStatus(VOICE_STATUS.ERROR)
        onOrbState('error')
        setTimeout(() => { setStatus(VOICE_STATUS.IDLE); onOrbState('idle') }, 3000)
        alert('Microphone access denied.\n\nClick the lock icon → allow microphone → refresh.')
      } else {
        setStatus(VOICE_STATUS.IDLE)
        onOrbState('idle')
      }
    }

    r.onend = () => {
      clearTimeout(silenceTimer)
      clearTimeout(hardStop)
      if (phaseRef.current === 'recording') {
        if (lastTranscript) {
          handleTranscript(lastTranscript)
        } else {
          const inWake = wakeModeRef.current
          phaseRef.current = inWake ? 'wake_listen' : 'idle'
          setStatus(inWake ? VOICE_STATUS.WAKE_LISTEN : VOICE_STATUS.IDLE)
          onOrbState(inWake ? 'listening' : 'idle')
          if (inWake) setTimeout(() => {
            if (wakeModeRef.current && phaseRef.current === 'wake_listen') {
              startWakeListeningRef.current?.()
            }
          }, 800)
        }
      }
    }

    try {
      r.start()
    } catch {
      phaseRef.current = 'idle'
      setStatus(VOICE_STATUS.IDLE)
    }
  }, [handleTranscript, onOrbState])

  // ── Wake word detected ────────────────────────────────────────────
  const onWakeDetected = useCallback(() => {
    phaseRef.current = 'recording'
    setStatus(VOICE_STATUS.WAKE_DETECTED)
    onOrbState('thinking')
    setTimeout(() => startRecording(), 150)
  }, [startRecording, onOrbState])

  useEffect(() => { onWakeDetectedRef.current = onWakeDetected }, [onWakeDetected])

  // ── Continuous wake word — fresh SR instance every cycle ──────────
  const startWakeListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    try { recognRef.current?.abort() } catch {}
    recognRef.current = null

    const r = new SR()
    recognRef.current = r
    r.lang            = 'en-US'
    r.continuous      = true
    r.interimResults  = true
    r.maxAlternatives = 5   // check top 5 transcription guesses

    phaseRef.current = 'wake_listen'
    setStatus(VOICE_STATUS.WAKE_LISTEN)

    r.onresult = (e) => {
      // Build full running transcript across ALL result segments
      // This catches "hey" (segment 0) + "nyx" (segment 1) even when Chrome splits them
      const fullTranscript = Array.from(e.results)
        .map(seg => seg[0].transcript)
        .join(' ')
        .toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .trim()

      console.log('[NYX Wake] Heard:', fullTranscript)

      if (WAKE_WORDS.some(w => fullTranscript.includes(w))) {
        try { r.abort() } catch {}
        recognRef.current = null
        onWakeDetectedRef.current?.()
      }
    }

    r.onerror = (e) => {
      recognRef.current = null
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        wakeModeRef.current = false
        setWakeMode(false)
        setStatus(VOICE_STATUS.IDLE)
      }
    }

    r.onend = () => {
      recognRef.current = null
      if (wakeModeRef.current && phaseRef.current === 'wake_listen') {
        setTimeout(() => {
          if (wakeModeRef.current && phaseRef.current === 'wake_listen') {
            startWakeListeningRef.current?.()
          }
        }, 300)
      }
    }

    try { r.start() } catch {}
  }, [])

  useEffect(() => { startWakeListeningRef.current = startWakeListening }, [startWakeListening])

  // ── Auto-start wake mode on mount (always on by default) ─────────
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    // Small delay — wait for device claim to complete first
    const t = setTimeout(() => {
      if (wakeModeRef.current) startWakeListeningRef.current?.()
    }, 1500)
    return () => clearTimeout(t)
  }, [])

  // ── Public: click-to-talk ─────────────────────────────────────────
  const listenOnce = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Voice input requires Chrome or Edge.'); return }
    try { recognRef.current?.abort() } catch {}
    recognRef.current = null
    setTimeout(() => startRecording(), 120)
  }, [startRecording])

  // ── Public: toggle wake mode ──────────────────────────────────────
  const toggleWakeMode = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Voice input requires Chrome or Edge.'); return }
    if (wakeModeRef.current) {
      wakeModeRef.current = false
      setWakeMode(false)
      try { recognRef.current?.abort() } catch {}
      recognRef.current = null
      ackAudioRef.current?.pause()
      audioRef.current?.pause()
      phaseRef.current = 'idle'
      setStatus(VOICE_STATUS.IDLE)
      onOrbState('idle')
    } else {
      wakeModeRef.current = true
      setWakeMode(true)
      startWakeListeningRef.current?.()
    }
  }, [onOrbState])

  // ── Public: stop everything ───────────────────────────────────────
  const stopAll = useCallback(() => {
    wakeModeRef.current = false
    setWakeMode(false)
    phaseRef.current = 'idle'
    try { recognRef.current?.abort() } catch {}
    recognRef.current = null
    ackAudioRef.current?.pause()
    audioRef.current?.pause()
    setStatus(VOICE_STATUS.IDLE)
    onOrbState('idle')
  }, [onOrbState])

  // ── Public: send typed text through voice pipeline ────────────────
  const sendText = useCallback((text) => {
    if (!text?.trim()) return
    handleTranscript(text.trim())
  }, [handleTranscript])

  return {
    status, VOICE_STATUS,
    wakeMode, textOnly, setTextOnly,
    audioDevices, selectedDevice, setSelectedDevice,
    listenOnce, toggleWakeMode, stopAll, sendText,
  }
}
