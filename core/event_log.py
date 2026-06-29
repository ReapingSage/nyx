"""
core/event_log.py — System-wide Event Log

A single real event feed for things that actually happen in NYX —
chat replies, model downloads, settings changes, voice wake events,
errors. Used by UpdatesPage, the dashboard "Events" panel, and
notifications, so they all show the same real history instead of
each maintaining separate fake/demo data.

Persisted to disk (capped) so history survives a restart.
"""

import json
import uuid
from datetime import datetime
from pathlib import Path

from utils.logger import get_logger

log = get_logger(__name__)

EVENTS_PATH = Path(__file__).parent.parent / "memory" / "event_log.json"
MAX_EVENTS = 200


def _load() -> list[dict]:
    if EVENTS_PATH.exists():
        try:
            return json.loads(EVENTS_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            log.warning(f"[event_log] Could not read event log: {e}")
    return []


def _save(events: list[dict]) -> None:
    EVENTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    EVENTS_PATH.write_text(json.dumps(events[:MAX_EVENTS], indent=2), encoding="utf-8")


def log_event(category: str, title: str, detail: str = "", status: str = "ok") -> dict:
    """
    Record a real event. Categories are free-form strings like
    'chat', 'model', 'voice', 'settings', 'system', 'error'.
    """
    event = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now().isoformat(),
        "category": category,
        "title": title,
        "detail": detail,
        "status": status,
    }
    events = _load()
    events.insert(0, event)
    _save(events)
    return event


def get_events(limit: int = 50, category: str | None = None) -> list[dict]:
    events = _load()
    if category:
        events = [e for e in events if e["category"] == category]
    return events[:limit]


def clear_events() -> None:
    _save([])
