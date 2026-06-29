"""
core/permissions.py — Permission System
Guards what Nyx is allowed to do.

v1: Keyword-based soft warnings. Nothing is blocked yet.
Future: Hard blocks, user confirmation prompts, per-action allowlists.
"""

from utils.logger import get_logger

log = get_logger(__name__)

# ── Allowlist — safe by default ───────────────────────────
SAFE_ACTIONS = {
    "open_browser",
    "open_notepad",
    "open_calculator",
    "web_search",
    "read_file",
    "send_notification",
    "chat",
}

# ── Blocklist — require confirmation before running ───────
# In v1 these just log a warning.
# In future versions, these will pause and ask the user: "Are you sure?"
DANGEROUS_ACTIONS = {
    "delete_file",
    "format_drive",
    "execute_shell",
    "login_account",
    "send_payment",
    "access_passwords",
    "modify_registry",
    "install_software",
}

# ── Phrases that signal dangerous intent ─────────────────
DANGER_PHRASES = [
    "delete everything",
    "wipe",
    "rm -rf",
    "format c",
    "shutdown",
    "send my password",
    "run as admin",
    "sudo",
]


def check(user_input: str) -> bool:
    """
    Scan user input for dangerous intent and log a warning if found.
    Does NOT block in v1 — that comes in a future phase.

    Args:
        user_input: Raw user message.

    Returns:
        True if safe, False if potentially dangerous (currently just warns).
    """
    lower = user_input.lower()
    for phrase in DANGER_PHRASES:
        if phrase in lower:
            log.warning(f"Potentially dangerous input detected: '{phrase}' in message.")
            print(f"\n  [⚠ permissions] Flagged phrase: '{phrase}' — proceeding with caution.")
            return False
    return True


def can_do(action: str) -> bool:
    """
    Check if a named action is on the safe list.

    Args:
        action: Action identifier string, e.g. "open_browser"

    Returns:
        True if allowed, False if blocked.
    """
    if action in DANGEROUS_ACTIONS:
        log.warning(f"Blocked dangerous action: '{action}'")
        return False
    if action in SAFE_ACTIONS:
        return True
    # Unknown actions are denied by default
    log.warning(f"Unknown action '{action}' — denied by default.")
    return False