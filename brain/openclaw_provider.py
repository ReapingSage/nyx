"""
brain/openclaw_provider.py — OpenClaw Gateway Integration
Connects Nyx to the local OpenClaw gateway (port 18789).

What this does:
  - status()  → checks if OpenClaw gateway is reachable + reads config
  - test()    → sends "Say hi in one sentence." to Ollama via the
                OpenClaw-configured model and times the response
  - ask()     → sends any message to Ollama using the OpenClaw model

OpenClaw uses a WebSocket-based proprietary protocol for full agent
interactions. For now Nyx talks directly to Ollama using the same
model OpenClaw is configured to use, which is equivalent for text
tasks. Desktop/tool actions will route through OpenClaw's CLI layer.
"""

import json
import re
import socket
import time
from pathlib import Path

import requests
import config
from utils.logger import get_logger

log = get_logger(__name__)

_CONFIG_PATH = Path.home() / ".openclaw" / "openclaw.json"

SAFE_DENY_COMMANDS = {
    "rm", "del", "rmdir", "format", "reg", "regedit",
    "shutdown", "taskkill", "net user", "netsh",
    "install", "uninstall", "pip install", "npm install",
}


def _read_openclaw_config() -> dict:
    """Return parsed openclaw.json or empty dict if unavailable."""
    try:
        return json.loads(_CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _gateway_reachable(timeout: float = 1.5) -> tuple[bool, float | None]:
    """
    TCP-connect to the OpenClaw gateway port.
    Returns (reachable, latency_ms).
    """
    host = config.OPENCLAW_HOST
    port = config.OPENCLAW_PORT
    try:
        t0 = time.monotonic()
        with socket.create_connection((host, port), timeout=timeout):
            pass
        ms = round((time.monotonic() - t0) * 1000)
        return True, ms
    except (OSError, ConnectionRefusedError, TimeoutError):
        return False, None


def status() -> dict:
    """
    Return a status dict describing the OpenClaw gateway.

    Keys:
      online        bool   — gateway port is reachable
      latency_ms    int|None
      gateway_url   str
      model         str    — active model from config
      permission_mode str  — "local" / "remote"
      tool_access   bool   — tools enabled in config
      deny_commands list   — denied command list from config
    """
    cfg = _read_openclaw_config()
    reachable, ms = _gateway_reachable()

    agents_cfg = cfg.get("agents", {}).get("defaults", {})
    model_primary = agents_cfg.get("model", {}).get("primary", "unknown")
    model_name = model_primary.replace("ollama/", "") if "ollama/" in model_primary else model_primary

    gateway_cfg = cfg.get("gateway", {})
    permission_mode = gateway_cfg.get("mode", "local")
    deny_commands = gateway_cfg.get("nodes", {}).get("denyCommands", [])

    tools_cfg = cfg.get("tools", {})
    tool_access = bool(tools_cfg)

    return {
        "online":          reachable,
        "latency_ms":      ms,
        "gateway_url":     f"ws://{config.OPENCLAW_HOST}:{config.OPENCLAW_PORT}",
        "model":           model_name,
        "permission_mode": permission_mode,
        "tool_access":     tool_access,
        "deny_commands":   deny_commands,
        "config_found":    _CONFIG_PATH.exists(),
    }


def _ollama_model() -> str:
    """Return the Ollama model name OpenClaw is configured to use."""
    cfg = _read_openclaw_config()
    primary = (
        cfg.get("agents", {})
           .get("defaults", {})
           .get("model", {})
           .get("primary", "llama3.2:3b")
    )
    return primary.replace("ollama/", "") if "ollama/" in primary else primary


def ask(message: str, timeout: int = 30) -> tuple[str, float]:
    """
    Send a message to Ollama using the OpenClaw-configured model.
    Returns (response_text, latency_ms).

    Why Ollama directly: OpenClaw's agent protocol is WebSocket-based;
    for simple Q&A Nyx talks to Ollama, which is what OpenClaw uses
    under the hood anyway.
    """
    model = _ollama_model()
    url = f"{config.OLLAMA_BASE_URL}/api/chat"
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": message}],
        "stream": False,
        # Same as ollama_provider — avoid a cold model reload after idle.
        "keep_alive": "30m",
    }

    t0 = time.monotonic()
    try:
        r = requests.post(url, json=payload, timeout=timeout)
        r.raise_for_status()
        reply = r.json().get("message", {}).get("content", "").strip()
        ms = round((time.monotonic() - t0) * 1000)
        log.info(f"[openclaw] ask via {model} — {ms}ms")
        return reply, ms
    except requests.exceptions.ConnectionError:
        return "[OpenClaw] Ollama not reachable. Is Ollama running?", 0
    except requests.exceptions.Timeout:
        return f"[OpenClaw] Ollama timed out on model '{model}'.", 0
    except Exception as e:
        return f"[OpenClaw] Error: {e}", 0


def test() -> dict:
    """
    Run the standard gateway test:
      1. Check if gateway port is reachable.
      2. Send "Say hi in one sentence." to Ollama and measure latency.
    Returns a dict suitable for the /api/openclaw/test endpoint.
    """
    gateway_ok, gw_ms = _gateway_reachable()
    reply, ai_ms = ask("Say hi in one sentence.")
    model = _ollama_model()

    passed = gateway_ok and bool(reply) and "[OpenClaw]" not in reply
    return {
        "passed":         passed,
        "gateway_online": gateway_ok,
        "gateway_ms":     gw_ms,
        "model":          model,
        "response":       reply,
        "response_ms":    ai_ms,
    }


def _contains_word(text: str, phrases) -> bool:
    """Whole-word/phrase match. Plain substring matching false-positived
    constantly — 'rm' fired on 'confirm'/'form', 'reg' on 'regular',
    'no' on 'now'."""
    return any(re.search(rf"\b{re.escape(p)}\b", text) for p in phrases)


def is_dangerous_command(text: str) -> bool:
    """
    Lightweight safety guard — returns True if the message looks like
    a dangerous system command that OpenClaw should not execute.
    """
    return _contains_word(text.lower(), SAFE_DENY_COMMANDS)


# ── Pending confirmation state ────────────────────────────
# When an action requires user approval, it's stored here until confirmed.
_pending: dict = {}

_CONFIRM_REQUIRED = {
    "open_discord_opera_monitor2",
    "move_window_to_monitor",
    "delete_file",
    "kill_process",
}

_CONFIRM_WORDS = {"yes", "yeah", "yep", "sure", "do it", "go ahead", "confirm", "ok", "okay"}
_CANCEL_WORDS  = {"no", "nope", "cancel", "stop", "nevermind", "never mind", "abort"}

_ACTION_DESCRIPTIONS = {
    "open_discord_opera_monitor2": "open Discord in Opera GX and move it to monitor 2",
    "move_window_to_monitor":      "move the window to monitor 2",
}


def _set_pending(action: str, kwargs: dict | None = None, description: str | None = None) -> None:
    global _pending
    _pending = {
        "action":      action,
        "kwargs":      kwargs or {},
        "description": description or _ACTION_DESCRIPTIONS.get(action, action),
    }


def _clear_pending() -> None:
    global _pending
    _pending = {}


def is_confirmation_of_pending(message: str) -> bool:
    """True if there is a pending action and the message looks like a confirmation."""
    if not _pending:
        return False
    return _contains_word(message.lower().strip(), _CONFIRM_WORDS)


def is_cancellation_of_pending(message: str) -> bool:
    """True if there is a pending action and the message looks like a cancellation."""
    if not _pending:
        return False
    return _contains_word(message.lower().strip(), _CANCEL_WORDS)


# ── Intent → action mapping ───────────────────────────────
# Each entry: (list_of_trigger_phrases, action_name, kwargs)
_ACTION_INTENTS: list[tuple[list[str], str, dict]] = [
    (["log into ixl", "login ixl", "open ixl", "ixl login", "sign into ixl"],
     "login_ixl", {}),
    (["log into imagine", "login imagine", "imagine learning", "edgenuity",
      "imagine edgenuity", "sign into imagine"],
     "login_imagine", {}),
    (["take a screenshot", "take screenshot", "screenshot my screen",
      "capture screen", "capture my screen"],
     "screenshot", {}),
    (["open terminal", "open cmd", "open command prompt"],
     "open_terminal", {}),
    (["open vscode", "open vs code", "open visual studio code"],
     "open_vscode", {}),
    (["close browser", "close the browser"],
     "close_browser", {}),
    # Opera GX + Discord + monitor
    (["open discord in opera", "open discord opera", "discord in opera gx",
      "discord on opera", "open discord on opera", "discord opera gx",
      "open discord on my second monitor", "discord on second monitor",
      "open discord on monitor 2"],
     "open_discord_opera_monitor2", {}),
    (["open discord in new tab", "discord new tab opera"],
     "open_discord_opera", {}),
    (["move to monitor 2", "move to second monitor", "put on monitor 2",
      "send to monitor 2", "move opera to monitor"],
     "move_window_to_monitor", {"title": "Opera GX", "monitor": 1}),
    (["open in opera", "launch opera gx", "open opera gx"],
     "open_opera_url", {"url": "https://google.com"}),
    # Volume + media keys
    (["volume up", "turn up the volume", "turn the volume up", "louder"],
     "volume_up", {}),
    (["volume down", "turn down the volume", "turn the volume down", "quieter"],
     "volume_down", {}),
    (["mute", "unmute"],
     "mute_toggle", {}),
    (["pause the music", "pause music", "play music", "resume music",
      "play pause", "pause playback", "resume playback", "pause the song"],
     "play_pause", {}),
    (["next song", "next track", "skip song", "skip track", "skip this song"],
     "next_track", {}),
    (["previous song", "previous track", "last song", "go back a song"],
     "previous_track", {}),
    # Processes
    (["top processes", "using my cpu", "eating my cpu", "using my ram",
      "eating my ram", "using my memory", "hogging my"],
     "top_processes", {}),
]


# ── Parameterized intents — carry arguments out of the message ────────
# (compiled regex, action, needs_confirm, kwargs(match), description(match))
_PARAM_INTENTS: list[tuple] = [
    (re.compile(r"^(?:can you |please )?(?:type out|type|write out)\s+(.+)$", re.I | re.S),
     "type_text", False,
     lambda m: {"text": m.group(1).strip().strip('"')},
     None),
    (re.compile(r"^(?:can you |please )?(?:press|hit)\s+(?:the\s+)?([\w\s+]+?)(?:\s+key)?[.!?]?$", re.I),
     "press_key", False,
     lambda m: {"key": m.group(1).strip()},
     None),
    (re.compile(r"^(?:can you |please )?scroll\s+(up|down)(?:\s+a\s+(?:bit|little))?[.!?]?$", re.I),
     "mouse_scroll", False,
     lambda m: {"direction": m.group(1).lower()},
     None),
    (re.compile(r"^(?:can you |please )?(double[\s-]?click|right[\s-]?click|click)(?:\s+the\s+mouse)?[.!?]?$", re.I),
     "mouse_click", False,
     lambda m: {"button": "right" if "right" in m.group(1).lower() else "left",
                "double": "double" in m.group(1).lower()},
     None),
    (re.compile(r"^(?:can you |please )?create\s+(?:a\s+|new\s+)?file\s+(?:called\s+|named\s+|at\s+)?(.+?)[.!?]?$", re.I),
     "create_file", False,
     lambda m: {"path": m.group(1).strip()},
     None),
    (re.compile(r"^(?:can you |please )?(?:create|make)\s+(?:a\s+|new\s+)?folder\s+(?:called\s+|named\s+|at\s+)?(.+?)[.!?]?$", re.I),
     "create_folder", False,
     lambda m: {"path": m.group(1).strip()},
     None),
    # "append to file notes.txt: buy milk" (filename can't contain spaces;
    # the colon/comma separates it from the text). Also accepts
    # "append <text> to file <name>".
    (re.compile(r"^(?:can you |please )?append\s+to\s+(?:the\s+)?file\s+(\S+?)\s*[:,]\s*(.+)$", re.I | re.S),
     "append_file", False,
     lambda m: {"path": m.group(1).strip(), "content": m.group(2).strip() + "\n"},
     None),
    (re.compile(r"^(?:can you |please )?append\s+(.+?)\s+to\s+(?:the\s+)?file\s+(\S+?)[.!?]?$", re.I | re.S),
     "append_file", False,
     lambda m: {"path": m.group(2).strip(), "content": m.group(1).strip() + "\n"},
     None),
    (re.compile(r"^(?:can you |please )?move\s+(?:the\s+)?file\s+(.+?)\s+to\s+(.+?)[.!?]?$", re.I),
     "move_file", False,
     lambda m: {"src": m.group(1).strip(), "dst": m.group(2).strip()},
     None),
    (re.compile(r"^(?:can you |please )?delete\s+(?:the\s+)?(?:file|folder)\s+(.+?)[.!?]?$", re.I),
     "delete_file", True,
     lambda m: {"path": m.group(1).strip()},
     lambda m: f"send '{m.group(1).strip()}' to the Recycle Bin"),
    (re.compile(r"^(?:can you |please )?(?:kill|end|terminate|close)\s+(?:the\s+)?process\s+(.+?)[.!?]?$", re.I),
     "kill_process", True,
     lambda m: {"name": m.group(1).strip()},
     lambda m: f"terminate every '{m.group(1).strip()}' process"),
]


def dispatch(message: str) -> tuple[str, float]:
    """
    Try to match message to a known executable action first.
    Actions in _CONFIRM_REQUIRED prompt for user confirmation before running.
    Falls back to ask() (LLM) if no action matches.
    Returns (response_text, latency_ms).
    """
    from frameworks.openclaw.actions import run_action
    lower = message.lower()
    t0 = time.monotonic()

    # ── Pending confirmation check ────────────────────────
    if _pending:
        if is_confirmation_of_pending(message):
            action = _pending["action"]
            kwargs = _pending["kwargs"]
            _clear_pending()
            log.info(f"[openclaw] confirmed → running: {action}")
            try:
                result = run_action(action, **kwargs)
            except Exception as e:
                result = f"[OpenClaw] Action '{action}' failed: {e}"
            ms = round((time.monotonic() - t0) * 1000)
            return result, ms

        if is_cancellation_of_pending(message):
            desc = _pending.get("description", "action")
            _clear_pending()
            ms = round((time.monotonic() - t0) * 1000)
            return f"[Nyx] Cancelled: {desc}.", ms

    # ── Parameterized intents (checked first — they carry arguments) ──
    for pattern, action_name, needs_confirm, build_kwargs, describe in _PARAM_INTENTS:
        m = pattern.search(message.strip())
        if not m:
            continue
        kwargs = build_kwargs(m)
        if needs_confirm:
            _set_pending(action_name, kwargs, description=describe(m) if describe else None)
            ms = round((time.monotonic() - t0) * 1000)
            log.info(f"[openclaw] queued for confirmation: {action_name} {kwargs}")
            return (
                f"[Nyx] I'm about to: {_pending['description']}. "
                f"Say yes to confirm or no to cancel.",
                ms,
            )
        log.info(f"[openclaw] dispatching to action: {action_name} {kwargs}")
        try:
            result = run_action(action_name, **kwargs)
        except Exception as e:
            result = f"[OpenClaw] Action '{action_name}' failed: {e}"
        ms = round((time.monotonic() - t0) * 1000)
        return result, ms

    # ── Intent matching ───────────────────────────────────
    for triggers, action_name, kwargs in _ACTION_INTENTS:
        if any(t in lower for t in triggers):
            if action_name in _CONFIRM_REQUIRED:
                _set_pending(action_name, kwargs)
                desc = _pending["description"]
                ms = round((time.monotonic() - t0) * 1000)
                log.info(f"[openclaw] queued for confirmation: {action_name}")
                return (
                    f"[Nyx] I'm about to: {desc}. "
                    f"Say yes to confirm or no to cancel.",
                    ms,
                )
            log.info(f"[openclaw] dispatching to action: {action_name}")
            try:
                result = run_action(action_name, **kwargs)
            except Exception as e:
                result = f"[OpenClaw] Action '{action_name}' failed: {e}"
            ms = round((time.monotonic() - t0) * 1000)
            return result, ms

    # No known action matched — let the LLM handle it
    return ask(message)
