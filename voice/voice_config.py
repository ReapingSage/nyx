"""
voice/voice_config.py — NYX Voice System Configuration

TTS engine priority:
  1. XTTS v2 (Coqui) — best quality, local, requires PyTorch + Python 3.9-3.11
  2. edge-tts         — Microsoft neural TTS, excellent quality, works on any Python
  3. pyttsx3          — system TTS fallback, basic quality

To use XTTS v2:
  - You need Python 3.9, 3.10, or 3.11 (not 3.12+)
  - Run: pip install TTS soundfile
  - It will download the model (~1.8 GB) on first run

To use edge-tts (recommended for now):
  - Run: pip install edge-tts
  - Requires internet connection for generation
  - No model download needed
"""

from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────
VOICE_DIR    = Path(__file__).parent
OUTPUT_DIR   = VOICE_DIR / "outputs"
SAMPLES_DIR  = VOICE_DIR / "samples"

DEFAULT_OUTPUT_FILE = OUTPUT_DIR / "nyx_test.mp3"

# Place a clean .wav sample here to clone the voice with XTTS
# Leave as None to use edge-tts without cloning
SAMPLE_VOICE_PATH = SAMPLES_DIR / "nyx_reference.wav"

# ── XTTS v2 settings (used if Coqui TTS is installed) ─────────────
XTTS_MODEL   = "tts_models/multilingual/multi-dataset/xtts_v2"
XTTS_LANG    = "en"

# ── edge-tts voice (used if XTTS is not available) ────────────────
# Options with the right NYX energy (calm, elegant, cinematic):
#   en-GB-SoniaNeural   ← recommended: British, composed, intelligent
#   en-IE-EmilyNeural   ← Irish, warm but measured
#   en-US-AriaNeural    ← American, versatile, clear
#   en-GB-LibbyNeural   ← British, slightly cooler tone
EDGE_VOICE =  "en-GB-SoniaNeural"
EDGE_RATE    = "-5%"    # slightly slower = more deliberate / cinematic
EDGE_PITCH   = "-3Hz"   # very slightly lower = more depth

# ── NYX test lines ─────────────────────────────────────────────────
DEFAULT_TEXT = "Good evening, master. Systems synchronized. I am listening."

NYX_TEST_LINES = [
    "Good evening, master. Systems synchronized. I am listening.",
    "All processes are running nominally. How may I serve you?",
    "Curiosity detected. Tell me what you are thinking.",
    "I have analyzed the situation. There are three paths forward.",
    "Your command has been registered. Executing now.",
]
