"""
core/tts_engine.py — Kokoro TTS wrapper

Verified against the real installed kokoro-onnx==0.4.7 package and its real
model weights, not inferred from third-party docs:
  - Kokoro.create(text, voice, speed, lang) accepts EITHER a builtin voice
    name (str, looked up internally) OR a raw style array
    (NDArray[float32], shape (510, 1, 256)) passed directly as `voice=`.
  - Kokoro.get_voice_style(name) returns that raw per-voice array — so
    blending is a weighted average of two such arrays, fed straight back
    into create() as `voice=`. Confirmed by actually running it: synthesized
    real audio from a 60/40 blend of af_heart and am_michael this session.
  - create() already internally batches text into MAX_PHONEME_LENGTH (510)
    -phoneme chunks at punctuation boundaries, synthesizes each, trims
    silence, and concatenates — no hand-rolled chunking/concatenation is
    needed in this file.
  - kokoro-onnx bundles its own phonemizer + espeak-ng data (via the
    espeakng-loader dependency), so no separate system-level espeak-ng
    install is required — confirmed by a clean synthesis run with no
    manual setup beyond `pip install kokoro-onnx`.
  - Output is written as WAV, not MP3: soundfile's MP3 *write* support
    depends on the libsndfile version bundled on the machine (this session's
    build happened to support it, but that isn't guaranteed everywhere).
    WAV write is universal, so that's what generated chapters use.
"""

from pathlib import Path

import requests

from utils.logger import get_logger
from core import audiobook_store

log = get_logger(__name__)

ROOT_DIR = Path(__file__).parent.parent
MODELS_DIR = ROOT_DIR / "audiobooks" / "models"
MODEL_PATH = MODELS_DIR / "kokoro-v1.0.int8.onnx"
VOICES_PATH = MODELS_DIR / "voices-v1.0.bin"
PREVIEW_CACHE_DIR = MODELS_DIR / ".preview_cache"

# Confirmed reachable this session (curl HTTP 200, correct byte counts).
MODEL_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx"
VOICES_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"

PREVIEW_TEXT = "Hello, this is a preview of this voice."

# Real voice ids read from the actual voices-v1.0.bin this session via
# sorted(Kokoro(...).voices.keys()) — 54 voices across 9 languages. First
# letter = language, second = gender (f/m).
_LANG_NAMES = {
    "a": "American English", "b": "British English", "e": "Spanish", "f": "French",
    "h": "Hindi", "i": "Italian", "j": "Japanese", "p": "Brazilian Portuguese", "z": "Mandarin Chinese",
}
_LANG_CODES = {  # passed as Kokoro's `lang=` argument to create()
    "a": "en-us", "b": "en-gb", "e": "es", "f": "fr-fr", "h": "hi",
    "i": "it", "j": "ja", "p": "pt-br", "z": "cmn",
}
_VOICE_IDS = [
    "af_alloy", "af_aoede", "af_bella", "af_heart", "af_jessica", "af_kore", "af_nicole",
    "af_nova", "af_river", "af_sarah", "af_sky",
    "am_adam", "am_echo", "am_eric", "am_fenrir", "am_liam", "am_michael", "am_onyx", "am_puck", "am_santa",
    "bf_alice", "bf_emma", "bf_isabella", "bf_lily",
    "bm_daniel", "bm_fable", "bm_george", "bm_lewis",
    "ef_dora", "em_alex", "em_santa",
    "ff_siwis",
    "hf_alpha", "hf_beta", "hm_omega", "hm_psi",
    "if_sara", "im_nicola",
    "jf_alpha", "jf_gongitsune", "jf_nezumi", "jf_tebukuro", "jm_kumo",
    "pf_dora", "pm_alex", "pm_santa",
    "zf_xiaobei", "zf_xiaoni", "zf_xiaoxiao", "zf_xiaoyi", "zm_yunjian", "zm_yunxi", "zm_yunxia", "zm_yunyang",
]

_kokoro = None  # lazy singleton — model load takes ~1s, don't repeat per call


def models_ready() -> bool:
    return MODEL_PATH.exists() and VOICES_PATH.exists()


def ensure_models(progress_cb=None) -> None:
    """Idempotent — downloads whichever of the two model files is missing.
    progress_cb(done_bytes, total_bytes) fires periodically for UI progress.
    Downloads to a .part file and renames on completion so a crash mid-download
    can't leave a corrupt file that models_ready() mistakes for a real one."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    for url, dest in ((MODEL_URL, MODEL_PATH), (VOICES_URL, VOICES_PATH)):
        if dest.exists():
            continue
        tmp = dest.with_suffix(dest.suffix + ".part")
        with requests.get(url, stream=True, timeout=30) as r:
            r.raise_for_status()
            total = int(r.headers.get("content-length", 0))
            done = 0
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 1024):
                    f.write(chunk)
                    done += len(chunk)
                    if progress_cb:
                        progress_cb(done, total)
        tmp.rename(dest)
        log.info(f"[tts_engine] Downloaded {dest.name} ({dest.stat().st_size} bytes)")


def _engine():
    global _kokoro
    if _kokoro is None:
        if not models_ready():
            raise RuntimeError("Kokoro models not downloaded yet — call ensure_models() first.")
        from kokoro_onnx import Kokoro
        _kokoro = Kokoro(str(MODEL_PATH), str(VOICES_PATH))
    return _kokoro


def list_builtin_voices() -> list[dict]:
    out = []
    for vid in _VOICE_IDS:
        lang_prefix, gender = vid[0], vid[1]
        lang = _LANG_NAMES.get(lang_prefix, lang_prefix)
        name = vid[3:].capitalize()
        out.append({
            "id": vid,
            "label": f"{name} ({lang}, {'Female' if gender == 'f' else 'Male'})",
            "lang": _LANG_CODES.get(lang_prefix, "en-us"),
        })
    return out


def _lang_for_voice(voice_id: str) -> str:
    return _LANG_CODES.get(voice_id[0], "en-us")


def _blended_style(components: list[dict]):
    """Weighted average of each component's raw style array — the real
    blending mechanism confirmed against the installed package this session."""
    engine = _engine()
    total = sum(float(c["weight"]) for c in components)
    blended = None
    for c in components:
        style = engine.get_voice_style(c["voice"]) * (float(c["weight"]) / total)
        blended = style if blended is None else blended + style
    return blended


def resolve_voice(voice_id: str | None = None, blend_id: str | None = None):
    """Returns either a builtin voice id (str, Kokoro looks it up itself) or
    a blended style array (weighted average of component style vectors)."""
    if blend_id:
        blend = audiobook_store.get_voice_blend(blend_id)
        if not blend:
            raise ValueError(f"Voice blend '{blend_id}' not found.")
        return _blended_style(blend["components"])
    if voice_id:
        return voice_id
    raise ValueError("Either voice_id or blend_id is required.")


def _lang_for(voice_id: str | None, blend_id: str | None) -> str:
    if voice_id:
        return _lang_for_voice(voice_id)
    if blend_id:
        blend = audiobook_store.get_voice_blend(blend_id)
        if blend and blend["components"]:
            return _lang_for_voice(blend["components"][0]["voice"])
    return "en-us"


def synthesize_to_file(text: str, voice_id: str | None, blend_id: str | None,
                        out_path: Path, speed: float = 1.0) -> float:
    """Synthesizes text to out_path as WAV. Kokoro's own create() already
    chunks long text at phoneme boundaries and concatenates+trims internally
    — no hand-rolled chunking needed here. Blocking; callers on the event
    loop must wrap this in run_in_executor. Returns duration in seconds."""
    import soundfile as sf

    engine = _engine()
    voice = resolve_voice(voice_id, blend_id)
    lang = _lang_for(voice_id, blend_id)
    samples, sr = engine.create(text, voice=voice, speed=speed, lang=lang)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(out_path), samples, sr)
    return len(samples) / sr


def preview_path(voice_id: str | None = None, blend_id: str | None = None) -> Path:
    """Short cached sample clip — synthesized once per voice/blend id, then
    reused so repeated preview clicks in the Voices tab don't re-synthesize."""
    key = f"blend_{blend_id}" if blend_id else voice_id
    path = PREVIEW_CACHE_DIR / f"{key}.wav"
    if not path.exists():
        synthesize_to_file(PREVIEW_TEXT, voice_id, blend_id, path)
    return path


def preview_adhoc(components: list[dict]) -> Path:
    """Preview an unsaved blend, given directly as components rather than a
    saved blend id — lets a user audition before hitting Save."""
    import soundfile as sf

    engine = _engine()
    blended = _blended_style(components)
    lang = _lang_for_voice(components[0]["voice"])
    samples, sr = engine.create(PREVIEW_TEXT, voice=blended, speed=1.0, lang=lang)
    path = PREVIEW_CACHE_DIR / "adhoc_preview.wav"
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), samples, sr)
    return path
