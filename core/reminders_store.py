"""
core/reminders_store.py — Persisted Reminders Store

Real, file-backed reminders for the dashboard widget — replaces the
hardcoded MOCK_REMINDERS that never changed.
"""

import json
import uuid
from datetime import datetime
from pathlib import Path

from utils.logger import get_logger

log = get_logger(__name__)

REMINDERS_PATH = Path(__file__).parent.parent / "memory" / "reminders.json"


def _load() -> list[dict]:
    if REMINDERS_PATH.exists():
        try:
            return json.loads(REMINDERS_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            log.warning(f"[reminders_store] Could not read reminders: {e}")
    return []


def _save(reminders: list[dict]) -> None:
    REMINDERS_PATH.parent.mkdir(parents=True, exist_ok=True)
    REMINDERS_PATH.write_text(json.dumps(reminders, indent=2), encoding="utf-8")


def list_reminders() -> list[dict]:
    reminders = _load()
    reminders.sort(key=lambda r: r["due_at"])
    return reminders


def create_reminder(name: str, due_at: str) -> dict:
    reminder = {
        "id": str(uuid.uuid4()),
        "name": name,
        "due_at": due_at,
        "created_at": datetime.now().isoformat(),
        "fired": False,
    }
    reminders = _load()
    reminders.append(reminder)
    _save(reminders)
    return reminder


def due_unfired() -> list[dict]:
    """Reminders whose due_at has passed and that haven't notified yet."""
    due = []
    for r in _load():
        if r.get("fired"):
            continue
        try:
            due_at = datetime.fromisoformat(r["due_at"].replace("Z", "+00:00"))
            # JS toISOString() sends timezone-aware strings, manual entry may
            # be naive — pick the matching "now" or the comparison raises.
            now = datetime.now(due_at.tzinfo) if due_at.tzinfo else datetime.now()
            if due_at <= now:
                due.append(r)
        except (ValueError, TypeError, AttributeError):
            log.warning(f"[reminders_store] Unparseable due_at on '{r.get('name')}' — skipping")
    return due


def mark_fired(reminder_id: str) -> None:
    reminders = _load()
    for r in reminders:
        if r["id"] == reminder_id:
            r["fired"] = True
            r["fired_at"] = datetime.now().isoformat()
            _save(reminders)
            return


def delete_reminder(reminder_id: str) -> bool:
    reminders = _load()
    remaining = [r for r in reminders if r["id"] != reminder_id]
    if len(remaining) == len(reminders):
        return False
    _save(remaining)
    return True
