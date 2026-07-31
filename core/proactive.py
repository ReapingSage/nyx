"""
core/proactive.py — Unified Proactive Notification Pipeline

One place Nyx tells the user something without being asked: a reminder or
timer fired, a task completed, an audiobook finished narrating, disk space
is low. Every trigger source funnels through fire() instead of each one
inventing its own toast+log+broadcast combination — reminder_loop and
tools/system/timers.py used to each do this inline; this centralizes it and
adds the missing piece none of them had: actually showing up in chat / being
spoken, not just an OS toast.

fire() is synchronous and safe to call from any thread — a bare
threading.Timer callback (tools/system/timers.py has no event loop at all),
a FastAPI request handler via run_in_executor, or a background asyncio-loop
task also via run_in_executor. It never touches the event loop directly.
The one piece that DOES need the event loop (the voice_ws WebSocket
broadcast) is handed off through a registered callback — the same
registration pattern already used by tools/system/music_control.register()
for the identical reason (see ui/server.py's startup handler).
"""

import uuid
from datetime import datetime
from pathlib import Path

from core import app_settings, event_log
from tools.system.notifications import notify
from utils.logger import get_logger

log = get_logger(__name__)

VOICE_OUTPUTS = Path(__file__).parent.parent / "voice" / "outputs"

_broadcast_fn = None  # registered by ui/server.py at startup


def register(broadcast_fn) -> None:
    """broadcast_fn(payload: dict) is called for every fired notification.
    ui/server.py wires this to voice_ws.broadcast via
    asyncio.run_coroutine_threadsafe — same pattern as music_control.register()."""
    global _broadcast_fn
    _broadcast_fn = broadcast_fn


# Proactive-specific settings gate, in addition to the master "enabled"
# switch. Categories not listed here are only gated by the master switch.
_CATEGORY_FLAGS = {
    "reminders":     "proactive_reminders",
    "timers":        "proactive_timers",
    "tasks":         "proactive_tasks",
    "audiobooks":    "proactive_audiobooks",
    "system_health": "proactive_system_health",
}

# Maps a proactive category onto notify()'s OWN (pre-existing, narrower)
# toast-specific gate where one already exists and means the same thing —
# "tasks" already had a dedicated "task_complete" toggle in Settings before
# this feature existed, and firing task-completion through here must keep
# honoring it, not silently bypass it. Categories with no prior notify()
# gate pass "general", which notify() only checks against its master switch
# (already covered above by fire()'s own check).
_NOTIFY_CATEGORY = {
    "tasks": "task_complete",
}


def _in_quiet_hours(settings: dict) -> bool:
    start, end = settings.get("quiet_hours_start"), settings.get("quiet_hours_end")
    if not start or not end:
        return False
    now = datetime.now().strftime("%H:%M")
    if start <= end:
        return start <= now < end
    return now >= start or now < end  # window wraps past midnight


def _speak(message: str) -> str | None:
    try:
        from voice.text_to_speech import speak_to_file
        path = VOICE_OUTPUTS / f"nyx_proactive_{uuid.uuid4().hex[:10]}.mp3"
        result = speak_to_file(message, path)
        if result and result.exists():
            return f"/voice-audio/{result.name}"
    except Exception as e:
        log.warning(f"[proactive] TTS failed: {e}")
    return None


def fire(category: str, title: str, message: str, speak: bool = True) -> bool:
    """
    Fire a proactive notification: always logged, toasted + (optionally)
    spoken + broadcast to any open Nyx window unless suppressed by settings
    or quiet hours. Returns True if it actually went out, False if
    suppressed. Blocking — callers already on the asyncio event loop must
    wrap the call in run_in_executor, same as every existing notify() call
    site already does.
    """
    settings = app_settings.get_section("notifications")

    if not settings.get("enabled", True):
        log.info(f"[proactive] Suppressed (notifications disabled): {title}")
        return False

    flag = _CATEGORY_FLAGS.get(category)
    if flag and not settings.get(flag, True):
        log.info(f"[proactive] Suppressed (category '{category}' disabled): {title}")
        return False

    quiet = _in_quiet_hours(settings)

    # Always logged, even during quiet hours — it just doesn't interrupt.
    event_log.log_event(category, title, message)

    audio_url = None
    if not quiet:
        notify(title, message, category=_NOTIFY_CATEGORY.get(category, "general"))
        if speak and settings.get("speak_proactive", True):
            audio_url = _speak(message)
    else:
        log.info(f"[proactive] Quiet hours — logged only, no toast/voice: {title}")

    if _broadcast_fn:
        _broadcast_fn({
            "type":      "proactive_notification",
            "category":  category,
            "title":     title,
            "message":   message,
            "audio_url": audio_url,
            "timestamp": datetime.now().isoformat(),
        })
    return True
