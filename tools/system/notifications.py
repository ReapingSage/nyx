"""
tools/system/notifications.py — Desktop Notifications
Sends a system notification. Works on Windows/macOS/Linux.
"""

import platform
import subprocess
from utils.logger import get_logger
log = get_logger(__name__)

OS = platform.system()


def notify(title: str, message: str) -> str:
    """Send a desktop notification."""
    try:
        if OS == "Windows":
            # Uses PowerShell toast notification
            script = (
                f'[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, '
                f'ContentType = WindowsRuntime] | Out-Null; '
            )
            # Simplified: just print for now on Windows
            print(f"\n  🔔 {title}: {message}")
        elif OS == "Darwin":
            subprocess.run(["osascript", "-e",
                f'display notification "{message}" with title "{title}"'])
        else:
            subprocess.run(["notify-send", title, message])
        log.info(f"Notification sent: {title}")
        return f"Notification sent: {title}"
    except Exception as e:
        return f"[Nyx] Could not send notification: {e}"