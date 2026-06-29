"""
core/permissions.py — Permission System
Guards what Nyx is allowed to do.

Keyword-based detection. Whether a dangerous phrase actually blocks the
request or just warns is controlled by the user's Privacy setting
(core/app_settings.py: privacy.block_dangerous_actions).
"""

from core import app_settings
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
    Scan user input for dangerous intent.

    Returns:
        True if the request should proceed, False if it should be blocked.
        Whether a flagged phrase actually blocks (vs. just warns) depends on
        the user's Privacy setting (block_dangerous_actions).
    """
    lower = user_input.lower()
    block_mode = app_settings.get_section("privacy").get("block_dangerous_actions", False)

    for phrase in DANGER_PHRASES:
        if phrase in lower:
            log.warning(f"Potentially dangerous input detected: '{phrase}' in message.")
            if block_mode:
                log.warning(f"Blocked — Privacy setting 'block_dangerous_actions' is enabled.")
                return False
            print(f"\n  [⚠ permissions] Flagged phrase: '{phrase}' — proceeding with caution.")
            return True
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