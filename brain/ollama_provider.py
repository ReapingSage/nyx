"""
brain/ollama_provider.py — Ollama Local Provider
Uses /api/chat so full conversation history is sent with every
message — giving Nyx real memory within a session.
"""

import requests
import config
from utils.logger import get_logger

log = get_logger(__name__)

CHAT_URL = f"{config.OLLAMA_BASE_URL}/api/chat"


def _get_first_installed() -> str | None:
    """Return the name of the first installed Ollama model, or None if nothing is installed."""
    try:
        r = requests.get(f"{config.OLLAMA_BASE_URL}/api/tags", timeout=5)
        models = r.json().get("models", [])
        if models:
            return models[0]["name"]
    except Exception:
        pass
    return None


def ask(model: str, messages: list) -> str:
    """
    Send a full conversation history to Ollama and return the reply.

    Args:
        model:    Ollama model name e.g. "llama3.1:8b"
        messages: Full conversation list including system prompt.

    Returns:
        The model's reply as a plain string.
    """
    payload = {
        "model":    model,
        "messages": messages,
        "stream":   False,
    }

    log.info(f"Sending to Ollama model '{model}' — {len(messages)} messages in context")

    response = None

    try:
        response = requests.post(CHAT_URL, json=payload, timeout=120)
        response.raise_for_status()
        data = response.json()
        return data.get("message", {}).get("content", "").strip()

    except requests.exceptions.ConnectionError:
        msg = (
            f"[Nyx] Cannot connect to Ollama at {config.OLLAMA_BASE_URL}\n"
            "  → Make sure Ollama is running: ollama serve"
        )
        log.error(msg)
        return msg

    except requests.exceptions.Timeout:
        msg = f"[Nyx] Ollama timed out on model '{model}'. Try a smaller model."
        log.error(msg)
        return msg

    except requests.exceptions.HTTPError as e:
        status = response.status_code if response is not None else 0
        if status == 404:
            fallback = _get_first_installed()
            if fallback and fallback != model:
                log.warning(f"[ollama_provider] Model '{model}' not installed, falling back to '{fallback}'")
                return ask(fallback, messages)
            msg = (
                f"[Nyx] No models are installed in Ollama.\n"
                f"  → Open the Models page and download one, or run: ollama pull llama3.2:3b"
            )
        else:
            msg = f"[Nyx] Ollama HTTP error: {e}"
        log.error(msg)
        return msg

    except Exception as e:
        msg = f"[Nyx] Unexpected error talking to Ollama: {e}"
        log.error(msg)
        return msg