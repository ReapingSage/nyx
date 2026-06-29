"""
core/vault_bridge.py — Vault / Memory Storage Bridge

Reads and writes NYX's memory notes as plain markdown files. WHERE those
files live is decided by core/storage_provider.py (NYX's own NYX_VAULT/
folder by default, or a connected external Obsidian vault) — this module
always asks for the current path rather than caching it, so switching
providers in Settings takes effect immediately without a restart.

Two-way sync:
  Read  — Memory/*.md files injected as AI context each session
  Write — conversation exchanges appended to Logs/YYYY-MM-DD.md
  Write — explicit memory triggers saved to Memory/auto.md
"""

import re
from datetime import datetime
from pathlib import Path

from core import storage_provider
from utils.logger import get_logger

log = get_logger(__name__)

# Phrases that trigger explicit memory saving
_REMEMBER_PATTERNS = [
    re.compile(r"remember (?:that |this |:)?(.+)",    re.I),
    re.compile(r"don[''']t forget (?:that |this |:)?(.+)", re.I),
    re.compile(r"note (?:that |this |:)?(.+)",         re.I),
    re.compile(r"save this:? (.+)",                    re.I),
    re.compile(r"keep in mind:? (.+)",                 re.I),
]


def get_vault_path() -> Path:
    return storage_provider.get_active_vault_path()


def get_memory_dir() -> Path:
    return get_vault_path() / "Memory"


def get_logs_dir() -> Path:
    return get_vault_path() / "Logs"


def _ensure_dirs() -> None:
    get_memory_dir().mkdir(parents=True, exist_ok=True)
    get_logs_dir().mkdir(parents=True, exist_ok=True)


def read_context() -> str:
    """
    Read all .md files from Memory/ and return a formatted context block.
    Returns empty string if the vault has no memory notes yet.
    """
    memory_dir = get_memory_dir()
    if not memory_dir.exists():
        return ""

    blocks = []
    for md_file in sorted(memory_dir.glob("*.md")):
        try:
            content = md_file.read_text(encoding="utf-8").strip()
            if content:
                blocks.append(f"### {md_file.stem}\n{content}")
        except IOError as e:
            log.warning(f"[vault] Could not read {md_file.name}: {e}")

    if not blocks:
        return ""

    return "## Vault Memory\n\n" + "\n\n".join(blocks)


def log_exchange(timestamp: str, user: str, nyx: str, model: str) -> None:
    """Append a conversation exchange to today's vault log note."""
    _ensure_dirs()
    today    = datetime.now().strftime("%Y-%m-%d")
    log_file = get_logs_dir() / f"{today}.md"

    if not log_file.exists():
        log_file.write_text(f"# NYX Log — {today}\n\n", encoding="utf-8")

    entry = (
        f"---\n"
        f"**{timestamp}** · `{model}`\n\n"
        f"**You:** {user}\n\n"
        f"**NYX:** {nyx}\n\n"
    )
    try:
        with log_file.open("a", encoding="utf-8") as f:
            f.write(entry)
    except IOError as e:
        log.error(f"[vault] Could not write log: {e}")


def extract_and_save_memory(user_input: str) -> None:
    """
    Detect explicit memory triggers in the user's message and save the fact
    to Memory/auto.md. Triggers: 'remember that...', 'note that...', etc.
    """
    _ensure_dirs()
    auto_file = get_memory_dir() / "auto.md"

    for pattern in _REMEMBER_PATTERNS:
        match = pattern.search(user_input)
        if match:
            fact      = match.group(1).strip().rstrip(".")
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")

            if not auto_file.exists():
                auto_file.write_text("# Auto-Detected Memories\n\n", encoding="utf-8")

            try:
                with auto_file.open("a", encoding="utf-8") as f:
                    f.write(f"- **{timestamp}:** {fact}\n")
                log.info(f"[vault] Memory saved: {fact}")
            except IOError as e:
                log.error(f"[vault] Could not save memory: {e}")
            break
