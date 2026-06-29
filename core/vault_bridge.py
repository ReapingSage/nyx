"""
core/vault_bridge.py — Obsidian Vault Integration

Two-way sync between NYX and the Obsidian vault:
  Read  — vault Memory/*.md files injected as AI context each session
  Write — conversation exchanges appended to vault Logs/YYYY-MM-DD.md
  Write — explicit memory triggers saved to vault Memory/auto.md
"""

import re
from datetime import datetime
from pathlib import Path
from utils.logger import get_logger

log = get_logger(__name__)

_BASE       = Path(__file__).parent.parent
VAULT_PATH  = _BASE / "NYX_VAULT"
MEMORY_DIR  = VAULT_PATH / "Memory"
LOGS_DIR    = VAULT_PATH / "Logs"

# Phrases that trigger explicit memory saving
_REMEMBER_PATTERNS = [
    re.compile(r"remember (?:that |this |:)?(.+)",    re.I),
    re.compile(r"don[''']t forget (?:that |this |:)?(.+)", re.I),
    re.compile(r"note (?:that |this |:)?(.+)",         re.I),
    re.compile(r"save this:? (.+)",                    re.I),
    re.compile(r"keep in mind:? (.+)",                 re.I),
]


def _ensure_dirs() -> None:
    MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    LOGS_DIR.mkdir(parents=True, exist_ok=True)


def read_context() -> str:
    """
    Read all .md files from Memory/ and return a formatted context block.
    Returns empty string if the vault has no memory notes yet.
    """
    if not MEMORY_DIR.exists():
        return ""

    blocks = []
    for md_file in sorted(MEMORY_DIR.glob("*.md")):
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
    log_file = LOGS_DIR / f"{today}.md"

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
    auto_file = MEMORY_DIR / "auto.md"

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
