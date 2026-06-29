"""
core/task_store.py — Persisted Task Store

A real, file-backed task list shared by the dashboard's "Active Tasks"
widget and the Tasks page — both read/write the same data instead of
each keeping separate (and previously, fake) state.
"""

import json
import uuid
from datetime import datetime
from pathlib import Path

from utils.logger import get_logger

log = get_logger(__name__)

TASKS_PATH = Path(__file__).parent.parent / "memory" / "tasks.json"

VALID_STATUSES = {"PENDING", "IN PROGRESS", "SCHEDULED", "COMPLETE", "FAILED"}


def _load() -> list[dict]:
    if TASKS_PATH.exists():
        try:
            return json.loads(TASKS_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            log.warning(f"[task_store] Could not read tasks: {e}")
    return []


def _save(tasks: list[dict]) -> None:
    TASKS_PATH.parent.mkdir(parents=True, exist_ok=True)
    TASKS_PATH.write_text(json.dumps(tasks, indent=2), encoding="utf-8")


def list_tasks() -> list[dict]:
    return _load()


def create_task(name: str, status: str = "PENDING", task_type: str = "general") -> dict:
    if status not in VALID_STATUSES:
        raise ValueError(f"Invalid status '{status}'. Valid: {VALID_STATUSES}")
    task = {
        "id": str(uuid.uuid4()),
        "name": name,
        "status": status,
        "type": task_type,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }
    tasks = _load()
    tasks.insert(0, task)
    _save(tasks)
    return task


def update_task(task_id: str, updates: dict) -> dict | None:
    if "status" in updates and updates["status"] not in VALID_STATUSES:
        raise ValueError(f"Invalid status '{updates['status']}'. Valid: {VALID_STATUSES}")
    tasks = _load()
    for task in tasks:
        if task["id"] == task_id:
            task.update(updates)
            task["updated_at"] = datetime.now().isoformat()
            _save(tasks)
            return task
    return None


def delete_task(task_id: str) -> bool:
    tasks = _load()
    remaining = [t for t in tasks if t["id"] != task_id]
    if len(remaining) == len(tasks):
        return False
    _save(remaining)
    return True
