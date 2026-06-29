"""
tools/system/notifications.py — Desktop Notifications
Sends a real OS-native notification. Windows uses an actual toast
(win11toast/WinRT), not a console print. Gated by the user's
Notifications settings (core/app_settings.py).
"""

import platform
import subprocess

from core import app_settings
from utils.logger import get_logger

log = get_logger(__name__)

OS = platform.system()


def notify(title: str, message: str, category: str = "general") -> str:
    """Send a desktop notification, respecting the user's notification settings."""
    settings = app_settings.get_section("notifications")

    if not settings.get("enabled", True):
        log.info(f"Notification suppressed (notifications disabled): {title}")
        return "Notifications are disabled in Settings."

    category_flag = {
        "task_complete": "task_complete",
        "error": "errors",
        "voice_wake": "voice_wake",
    }.get(category)
    if category_flag and not settings.get(category_flag, True):
        log.info(f"Notification suppressed (category '{category}' disabled): {title}")
        return f"Notifications for '{category}' are disabled in Settings."

    try:
        if OS == "Windows":
            from win11toast import toast
            toast(title, message)
        elif OS == "Darwin":
            subprocess.run(["osascript", "-e",
                f'display notification "{message}" with title "{title}"'])
        else:
            subprocess.run(["notify-send", title, message])
        log.info(f"Notification sent: {title}")
        return f"Notification sent: {title}"
    except Exception as e:
        log.error(f"Could not send notification: {e}")
        return f"[Nyx] Could not send notification: {e}"
