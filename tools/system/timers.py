"""
tools/system/timers.py — Chat-Set Timers

"set a timer for 10 minutes", "set a timer for 30 seconds for the pasta",
"cancel the timer", "how long is left on my timer"

Timers live in the backend process and fire a desktop notification plus an
event-log entry via threading.Timer — no event loop involvement, so they
work identically from chat and voice.
"""

import re
import threading
import time
import uuid

from utils.logger import get_logger

log = get_logger(__name__)

_timers: dict[str, dict] = {}   # id -> {label, ends_at, handle}
_lock = threading.Lock()

MAX_DURATION_SEC = 24 * 3600  # cap at 24h — beyond that it's a reminder

_UNIT_SECONDS = {
    "second": 1, "seconds": 1, "sec": 1, "secs": 1, "s": 1,
    "minute": 60, "minutes": 60, "min": 60, "mins": 60, "m": 60,
    "hour": 3600, "hours": 3600, "hr": 3600, "hrs": 3600, "h": 3600,
}

_SET_RE = re.compile(
    r"\b(?:set|start)\s+(?:a\s+)?(?:\w+\s+)?timer\s+(?:for\s+)?"
    r"(\d+(?:\.\d+)?)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?|[smh])\b"
    r"(?:\s+(?:for|called|named)\s+(.{1,60}?))?[.!?]?$",
    re.I,
)
_ALT_RE = re.compile(
    r"\b(\d+(?:\.\d+)?)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\s+timer\b", re.I,
)
_CANCEL_RE = re.compile(r"\b(?:cancel|stop|clear|kill)\s+(?:the\s+|my\s+|all\s+)?timers?\b", re.I)
_STATUS_RE = re.compile(
    r"\b(?:how\s+(?:long|much\s+time)\s+(?:is\s+)?left|time\s+left|"
    r"timers?\s+(?:left|running|status)|list\s+(?:my\s+)?timers?|check\s+(?:my\s+)?timers?)\b",
    re.I,
)


def _fmt(seconds: float) -> str:
    seconds = int(round(seconds))
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    parts = []
    if h: parts.append(f"{h}h")
    if m: parts.append(f"{m}m")
    if s or not parts: parts.append(f"{s}s")
    return " ".join(parts)


def _fire(timer_id: str) -> None:
    with _lock:
        info = _timers.pop(timer_id, None)
    if not info:
        return  # cancelled
    label = info["label"]
    log.info(f"[timers] Timer done: {label}")
    try:
        from core import event_log
        event_log.log_event("timer", "Timer done", label)
    except Exception as e:
        log.warning(f"[timers] Event log failed: {e}")
    try:
        from tools.system.notifications import notify
        notify("Timer done", label, category="general")
    except Exception as e:
        log.warning(f"[timers] Notification failed: {e}")


def set_timer(seconds: float, label: str = "") -> str:
    if seconds <= 0:
        return "[Nyx] Timer length has to be positive."
    if seconds > MAX_DURATION_SEC:
        return "[Nyx] That's more than 24 hours — set a reminder for that instead."
    timer_id = uuid.uuid4().hex[:8]
    label = label.strip().strip('"').strip() or f"{_fmt(seconds)} timer"
    handle = threading.Timer(seconds, _fire, args=[timer_id])
    handle.daemon = True
    with _lock:
        _timers[timer_id] = {"label": label, "ends_at": time.monotonic() + seconds, "handle": handle}
    handle.start()
    return f"Timer set — {label}, going off in {_fmt(seconds)}."


def cancel_all() -> str:
    with _lock:
        if not _timers:
            return "No timers are running."
        count = len(_timers)
        for info in _timers.values():
            info["handle"].cancel()
        _timers.clear()
    return f"Cancelled {count} timer{'s' if count != 1 else ''}."


def status() -> str:
    with _lock:
        if not _timers:
            return "No timers are running."
        now = time.monotonic()
        lines = [
            f"{info['label']} — {_fmt(max(0, info['ends_at'] - now))} left"
            for info in _timers.values()
        ]
    return "Running timers:\n" + "\n".join(f"  • {l}" for l in lines)


def try_handle(text: str) -> str | None:
    """Handle a timer command; return None if the message isn't one."""
    if "timer" not in text.lower():
        return None

    m = _SET_RE.search(text) or _ALT_RE.search(text)
    if m:
        amount = float(m.group(1))
        unit = m.group(2).lower()
        label = m.group(3) if m.lastindex and m.lastindex >= 3 and m.group(3) else ""
        seconds = amount * _UNIT_SECONDS.get(unit, _UNIT_SECONDS.get(unit.rstrip("s"), 60))
        return set_timer(seconds, label)

    if _CANCEL_RE.search(text):
        return cancel_all()

    if _STATUS_RE.search(text):
        return status()

    return None
