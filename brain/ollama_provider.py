"""
brain/ollama_provider.py — Ollama Local Provider
Uses /api/chat so full conversation history is sent with every
message — giving Nyx real memory within a session.
"""

import json

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
        # Keep the model loaded between requests — Ollama's default unloads
        # it after ~5 min idle, making the next reply pay a full cold-load
        # (many seconds on larger models, on lite hardware too).
        "keep_alive": "30m",
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


def ask_streaming(model: str, messages: list, on_chunk) -> str:
    """
    Same contract as ask() — returns the full reply as a string — but calls
    on_chunk(delta_text) as each piece arrives from Ollama's streaming API,
    so a caller can show text as it's generated instead of waiting for the
    whole thing. Ollama's streaming response is newline-delimited JSON, one
    object per line, each carrying an incremental message.content delta and
    a final line with "done": true.
    """
    payload = {
        "model":      model,
        "messages":   messages,
        "stream":     True,
        "keep_alive": "30m",
    }

    log.info(f"Streaming to Ollama model '{model}' — {len(messages)} messages in context")

    full_text = []
    response = None

    try:
        with requests.post(CHAT_URL, json=payload, timeout=120, stream=True) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if not line:
                    continue
                data = json.loads(line)
                delta = data.get("message", {}).get("content", "")
                if delta:
                    full_text.append(delta)
                    on_chunk(delta)
                if data.get("done"):
                    break
        return "".join(full_text)

    except requests.exceptions.ConnectionError:
        msg = (
            f"[Nyx] Cannot connect to Ollama at {config.OLLAMA_BASE_URL}\n"
            "  → Make sure Ollama is running: ollama serve"
        )
        log.error(msg)
        on_chunk(msg)
        return msg

    except requests.exceptions.Timeout:
        msg = f"[Nyx] Ollama timed out on model '{model}'. Try a smaller model."
        log.error(msg)
        on_chunk(msg)
        return msg

    except requests.exceptions.HTTPError as e:
        status = response.status_code if response is not None else 0
        if status == 404:
            fallback = _get_first_installed()
            if fallback and fallback != model:
                log.warning(f"[ollama_provider] Model '{model}' not installed, falling back to '{fallback}'")
                return ask_streaming(fallback, messages, on_chunk)
            msg = (
                f"[Nyx] No models are installed in Ollama.\n"
                f"  → Open the Models page and download one, or run: ollama pull llama3.2:3b"
            )
        else:
            msg = f"[Nyx] Ollama HTTP error: {e}"
        log.error(msg)
        on_chunk(msg)
        return msg

    except Exception as e:
        msg = f"[Nyx] Unexpected error talking to Ollama: {e}"
        log.error(msg)
        on_chunk(msg)
        return msg