"""
config.py — Nyx Configuration
All model names, URLs, and API keys live here.
Pull values from .env — never hardcode secrets.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ── Ollama ────────────────────────────────────────────────
# 127.0.0.1, not localhost: resolving "localhost" can cost ~2s on machines
# where IPv6 (::1) is tried first and times out before falling back to IPv4.
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")

# ── OpenClaw gateway ──────────────────────────────────────
OPENCLAW_HOST:  str = os.getenv("OPENCLAW_HOST",  "127.0.0.1")
OPENCLAW_PORT:  int = int(os.getenv("OPENCLAW_PORT", "18789"))
# Token loaded from env — never hardcode in source.
# Copy the token from ~/.openclaw/openclaw.json → gateway.auth.token into your .env file:
#   OPENCLAW_GATEWAY_TOKEN=<your token>
OPENCLAW_TOKEN: str = os.getenv("OPENCLAW_GATEWAY_TOKEN", "")

# ── Model roster ─────────────────────────────────────────
MODEL_MAIN     = "qwen2.5:14b"
MODEL_FAST     = "llama3.2:3b"
MODEL_CODER    = "deepseek-coder:6.7b"
MODEL_REASON   = "qwen2.5:7b"
MODEL_FLAGSHIP   = "llama3.3"
FLAGSHIP_ENABLED = False

# ── AI Provider ───────────────────────────────────────────
AI_PROVIDER: str = os.getenv("AI_PROVIDER", "ollama")

# ── Cloud providers (optional / future) ──────────────────
OPENAI_API_KEY:    str = os.getenv("OPENAI_API_KEY",    "")
ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")

# ── Personality ───────────────────────────────────────────
USER_NAME:  str = os.getenv("USER_NAME",  "Anthony")
NYX_TITLE:  str = os.getenv("NYX_TITLE",  "Master")

# ── Voice (Phase 4) ───────────────────────────────────────
VOICE_ENABLED: bool = os.getenv("VOICE_ENABLED", "false").lower() == "true"
VOICE_MODE:    str  = os.getenv("VOICE_MODE",    "push_to_talk")
STT_PROVIDER:  str  = os.getenv("STT_PROVIDER",  "none")
TTS_PROVIDER:  str  = os.getenv("TTS_PROVIDER",  "none")
WAKE_WORD:     str  = os.getenv("WAKE_WORD",      "nyx")

# ── Site credentials (loaded from .env — never hardcode) ─────────────────────
IXL_USERNAME:       str = os.getenv("IXL_USERNAME",       "")
IXL_PASSWORD:       str = os.getenv("IXL_PASSWORD",       "")
IMAGINE_USERNAME:   str = os.getenv("IMAGINE_USERNAME",   "")
IMAGINE_PASSWORD:   str = os.getenv("IMAGINE_PASSWORD",   "")
IMAGINE_PORTAL_URL: str = os.getenv("IMAGINE_PORTAL_URL", "https://login.imaginelearning.com")

# ── System Prompt — loaded from brain/nyx.md ─────────────
_NYX_MD_PATH = os.path.join(os.path.dirname(__file__), "brain", "nyx.md")

def _load_system_prompt() -> str:
    if os.path.exists(_NYX_MD_PATH):
        try:
            with open(_NYX_MD_PATH, "r", encoding="utf-8") as f:
                content = f.read().strip()
            if content:
                content = content.replace("{USER_NAME}", USER_NAME).replace("{NYX_TITLE}", NYX_TITLE)
                return content
        except IOError as e:
            print(f"[Nyx] Warning: could not read brain/nyx.md — {e}")

    print("[Nyx] Warning: brain/nyx.md not found. Using default system prompt.")
    return (
        f"You are Nyx, a smart, direct, and capable AI desktop assistant. "
        f"You address the user as {NYX_TITLE}. "
        f"You run locally on the user's machine. "
        f"Keep answers concise and useful."
    )

NYX_SYSTEM_PROMPT: str = _load_system_prompt()