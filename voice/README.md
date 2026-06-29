# NYX Voice System

Local voice generation and testing for NYX.

## Current Phase: Phase 1 — TTS Generation Test

**What works now:**
- Text → audio file generation
- Multiple TTS engine fallback chain
- Custom voice sample support (XTTS v2)

**Coming later:**
- Phase 2: Mic → Whisper → Ollama → TTS (full voice loop)
- Phase 3: Voice states connected to the NYX orb UI

---

## Quick Start

### Step 1 — Open PowerShell in project root

```powershell
cd "C:\Users\saget\OneDrive\Documents\nyx"
```

### Step 2 — Install edge-tts (recommended for Python 3.14+)

```powershell
pip install edge-tts
```

### Step 3 — Run the voice test

```powershell
python voice/test_voice.py
```

### Step 4 — Open the generated file

The audio will be saved to:
```
voice/outputs/nyx_test.mp3
```

Open it in any media player (Windows Media Player, VLC, etc.).

---

## Test options

```powershell
# Test the default NYX line
python voice/test_voice.py

# Test a specific NYX line (1-5)
python voice/test_voice.py --line 3

# Test custom text
python voice/test_voice.py --text "Scanning for anomalies."

# List all built-in NYX test lines
python voice/test_voice.py --list

# List available edge-tts voices
python voice/test_voice.py --voices

# Auto-play after generation
python voice/test_voice.py --play
```

---

## TTS Engine Priority

NYX tries engines in this order:

| Priority | Engine        | Quality  | Requirement                        |
|----------|---------------|----------|------------------------------------|
| 1        | XTTS v2       | Best     | Python 3.9–3.11 + `pip install TTS` |
| 2        | edge-tts      | Excellent| Any Python + `pip install edge-tts` |
| 3        | pyttsx3       | Basic    | Any Python + `pip install pyttsx3`  |

**Python 3.14 users:** Coqui TTS (XTTS) requires PyTorch which may not
have Python 3.14 wheels yet. Use edge-tts instead — the voice quality
is genuinely good for this use case.

---

## Changing the NYX voice

Edit `voice/voice_config.py`:

```python
# Current recommended voice for NYX
EDGE_VOICE = "en-GB-SoniaNeural"   # elegant British female
```

Good alternative voices to try:
```python
EDGE_VOICE = "en-IE-EmilyNeural"   # Irish, warm and measured
EDGE_VOICE = "en-US-AriaNeural"    # American, clear and calm
EDGE_VOICE = "en-GB-LibbyNeural"   # British, cooler tone
```

List all English voices:
```powershell
python voice/test_voice.py --voices
```

Adjust pacing and depth in `voice_config.py`:
```python
EDGE_RATE  = "-8%"    # negative = slower (more deliberate)
EDGE_PITCH = "-5Hz"   # negative = lower (more depth)
```

---

## Using a custom reference voice (XTTS v2)

1. Install XTTS (requires Python 3.9–3.11):
   ```powershell
   pip install TTS soundfile
   ```

2. Place a clean WAV file at:
   ```
   voice/samples/nyx_reference.wav
   ```

3. Run the test script — it will automatically use the sample:
   ```powershell
   python voice/test_voice.py
   ```

See `voice/samples/README.md` for recording guidelines.

---

## Folder structure

```
voice/
├── README.md           ← this file
├── voice_config.py     ← engine settings, voice selection
├── test_voice.py       ← run this to test
├── text_to_speech.py   ← TTS engine (edge-tts / XTTS / pyttsx3)
├── speech_to_text.py   ← Phase 2: mic → text (not yet active)
├── voice_manager.py    ← Phase 2: full voice loop (not yet active)
├── outputs/            ← generated audio files land here
└── samples/            ← place nyx_reference.wav here
```

---

## Troubleshooting

**"No TTS engine is installed"**
```powershell
pip install edge-tts
```

**edge-tts fails / network error**
- edge-tts requires an internet connection.
- Check your connection and try again.
- Or install pyttsx3 as offline fallback: `pip install pyttsx3`

**XTTS fails with Python 3.14**
- PyTorch does not yet have Python 3.14 wheels.
- Use edge-tts for now. Switch to XTTS when PyTorch 3.14 support arrives.
- Or install Python 3.11 alongside your current version and use a venv.
