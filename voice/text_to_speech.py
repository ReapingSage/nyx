"""
voice/text_to_speech.py — NYX TTS Engine

Engine priority:
  1. XTTS v2 (Coqui) — local, best quality, needs Python 3.9-3.11 + PyTorch
  2. edge-tts         — Microsoft neural, excellent quality, any Python, needs internet
  3. pyttsx3          — system fallback, robotic but always works offline

speak(text)           — speaks text (no file saved, used by voice_manager)
speak_to_file(text)   — generates audio file, returns output path
"""

import re
from pathlib import Path


def clean_for_tts(text: str) -> str:
    """Strip markdown syntax and emojis so TTS reads naturally."""
    # Code blocks — replace with spoken cue
    text = re.sub(r'```[\s\S]*?```', ' code block omitted. ', text)
    text = re.sub(r'`([^`]+)`', r'\1', text)
    # Headers
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    # Bold / italic
    text = re.sub(r'\*{1,3}([^*\n]+)\*{1,3}', r'\1', text)
    text = re.sub(r'_{1,3}([^_\n]+)_{1,3}', r'\1', text)
    # Links — keep label
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    # Bullet / numbered lists — strip marker, keep content
    text = re.sub(r'^[\-\*\+]\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\d+\.\s+', '', text, flags=re.MULTILINE)
    # Horizontal rules
    text = re.sub(r'^[-*_]{3,}\s*$', '', text, flags=re.MULTILINE)
    # Blockquotes
    text = re.sub(r'^>\s?', '', text, flags=re.MULTILINE)
    # Emojis
    emoji_re = re.compile(
        u"[\U0001F600-\U0001F64F"
        u"\U0001F300-\U0001F5FF"
        u"\U0001F680-\U0001F6FF"
        u"\U0001F1E0-\U0001F1FF"
        u"\U00002702-\U000027B0"
        u"\U000024C2-\U0001F251"
        u"\U0001F926-\U0001F937"
        u"\U00010000-\U0010FFFF"
        u"♀-♂☀-⭕"
        u"‍⏏⏩⌚️〰]+",
        flags=re.UNICODE
    )
    text = emoji_re.sub('', text)
    # Tidy whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]{2,}', ' ', text)
    return text.strip()


# ── Public interface ────────────────────────────────────────────────

def speak(text: str) -> None:
    """Speak text aloud. Called by voice_manager in the live loop."""
    path = speak_to_file(text)
    if path:
        _play_audio(path)


def speak_to_file(text: str, output_path: Path | None = None) -> Path | None:
    """
    Generate speech audio from text. Returns the output file path, or None on failure.
    Tries XTTS → edge-tts → pyttsx3 in order.
    """
    from voice.voice_config import OUTPUT_DIR, DEFAULT_OUTPUT_FILE
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out  = Path(output_path) if output_path else DEFAULT_OUTPUT_FILE
    text = clean_for_tts(text)

    # Try XTTS v2 first
    result = _try_xtts(text, out)
    if result:
        return result

    # Fall back to edge-tts
    result = _try_edge_tts(text, out)
    if result:
        return result

    # Last resort: pyttsx3
    result = _try_pyttsx3(text, out)
    return result


# ── Engine implementations ──────────────────────────────────────────

def _try_xtts(text: str, out: Path) -> Path | None:
    """Attempt generation with Coqui XTTS v2."""
    try:
        from TTS.api import TTS
    except ImportError:
        return None

    try:
        from voice.voice_config import XTTS_MODEL, XTTS_LANG, SAMPLE_VOICE_PATH

        tts = TTS(model_name=XTTS_MODEL, progress_bar=True)

        wav_out = out.with_suffix(".wav")
        kwargs  = {"text": text, "file_path": str(wav_out)}

        if SAMPLE_VOICE_PATH and Path(SAMPLE_VOICE_PATH).exists():
            kwargs["speaker_wav"] = str(SAMPLE_VOICE_PATH)
            kwargs["language"]    = XTTS_LANG
        else:
            # XTTS v2 requires a speaker_wav — cannot generate without one
            print("\n[NYX Voice] XTTS v2 needs a reference sample to clone.")
            print(f"  → Place a clean WAV file at: {SAMPLE_VOICE_PATH}")
            print("  → See voice/samples/README.md for guidelines.\n")
            return None

        tts.tts_to_file(**kwargs)
        return wav_out

    except Exception as e:
        print(f"[NYX Voice] XTTS failed: {e}")
        return None


def _try_edge_tts(text: str, out: Path) -> Path | None:
    """Attempt generation with Microsoft edge-tts (requires internet)."""
    try:
        import edge_tts
    except ImportError:
        return None

    try:
        import asyncio, threading
        from voice.voice_config import EDGE_VOICE, EDGE_RATE, EDGE_PITCH

        mp3_out = out.with_suffix(".mp3")

        async def _generate():
            communicate = edge_tts.Communicate(
                text  = text,
                voice = EDGE_VOICE,
                rate  = EDGE_RATE,
                pitch = EDGE_PITCH,
            )
            await communicate.save(str(mp3_out))

        # Run in a dedicated thread with its own event loop — avoids conflict
        # with FastAPI's already-running asyncio loop.
        exc_box: list = [None]
        def _thread():
            loop = asyncio.new_event_loop()
            try:
                loop.run_until_complete(_generate())
            except Exception as e:
                exc_box[0] = e
            finally:
                loop.close()

        t = threading.Thread(target=_thread, daemon=True)
        t.start()
        t.join(timeout=30)

        if exc_box[0]:
            raise exc_box[0]
        return mp3_out if mp3_out.exists() else None

    except Exception as e:
        print(f"[NYX Voice] edge-tts failed: {e}")
        return None


def _try_pyttsx3(text: str, out: Path) -> Path | None:
    """Fallback: system TTS via pyttsx3. Basic quality but always works offline."""
    try:
        import pyttsx3
    except ImportError:
        return None

    try:
        engine = pyttsx3.init()
        # Attempt to find a female voice
        for v in engine.getProperty("voices"):
            if "zira" in v.id.lower() or "female" in v.name.lower():
                engine.setProperty("voice", v.id)
                break
        engine.setProperty("rate",   155)
        engine.setProperty("volume", 0.95)

        wav_out = out.with_suffix(".wav")
        engine.save_to_file(text, str(wav_out))
        engine.runAndWait()
        return wav_out

    except Exception as e:
        print(f"[NYX Voice] pyttsx3 failed: {e}")
        return None


def _play_audio(path: Path) -> None:
    """Play an audio file. Used by speak() in the live loop."""
    import subprocess, platform
    try:
        if platform.system() == "Windows":
            subprocess.Popen(["start", "", str(path)], shell=True)
        elif platform.system() == "Darwin":
            subprocess.Popen(["afplay", str(path)])
        else:
            subprocess.Popen(["aplay", str(path)])
    except Exception as e:
        print(f"[NYX Voice] Could not play audio: {e}")
        print(f"  → File saved at: {path}")
