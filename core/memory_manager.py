"""
core/memory_manager.py — Conversation Memory
Saves every exchange to a timestamped log file.
Simple and readable. No database needed yet.

Future Phase 5: Replace with vector DB + RAG retrieval.
"""

import os
import json
from datetime import datetime
from utils.logger import get_logger
from core import vault_bridge

log = get_logger(__name__)

CONVERSATIONS_DIR = os.path.join(os.path.dirname(__file__), "..", "memory", "conversations")


def _ensure_dir():
    """Create the conversations directory if it doesn't exist."""
    os.makedirs(CONVERSATIONS_DIR, exist_ok=True)


def _session_file() -> str:
    """
    Return the path to today's conversation log file.
    One file per day: conversations/2025-01-15.json
    """
    _ensure_dir()
    today = datetime.now().strftime("%Y-%m-%d")
    return os.path.join(CONVERSATIONS_DIR, f"{today}.json")


def save_exchange(user_input: str, response: str, model: str) -> None:
    """
    Append a single Q&A exchange to today's conversation log.

    Args:
        user_input: What the user said.
        response:   What Nyx replied.
        model:      Which model handled the request.
    """
    entry = {
        "timestamp": datetime.now().isoformat(),
        "model":     model,
        "user":      user_input,
        "nyx":       response,
    }

    filepath = _session_file()

    # Load existing entries for today (if any)
    entries = []
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                entries = json.load(f)
        except (json.JSONDecodeError, IOError):
            entries = []

    entries.append(entry)

    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(entries, f, indent=2, ensure_ascii=False)
        log.debug(f"Exchange saved to {filepath}")
    except IOError as e:
        log.error(f"Could not save memory: {e}")

    # Mirror to Obsidian vault (non-fatal)
    try:
        vault_bridge.log_exchange(
            timestamp=entry["timestamp"],
            user=user_input,
            nyx=response,
            model=model,
        )
        vault_bridge.extract_and_save_memory(user_input)
    except Exception as e:
        log.warning(f"[vault] Non-fatal sync error: {e}")


def load_recent(n: int = 5) -> list[dict]:
    """
    Load the n most recent exchanges from today's log.
    Used later for building short-term context.

    Args:
        n: How many recent exchanges to return.

    Returns:
        List of exchange dicts with keys: timestamp, model, user, nyx.
    """
    filepath = _session_file()
    if not os.path.exists(filepath):
        return []

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            entries = json.load(f)
        return entries[-n:]
    except (json.JSONDecodeError, IOError) as e:
        log.error(f"Could not load memory: {e}")
        return []