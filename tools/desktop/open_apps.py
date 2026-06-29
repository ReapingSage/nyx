"""
tools/desktop/open_apps.py — Safe App Launcher
Opens common applications using platform-safe methods.
No arbitrary shell execution. Hardcoded safe list only.
"""

import subprocess
import platform
import webbrowser
from utils.logger import get_logger

log = get_logger(__name__)

OS = platform.system()  # "Windows", "Darwin", or "Linux"


def open_browser(url: str = "https://www.google.com") -> str:
    try:
        webbrowser.open(url)
        log.info(f"Opened browser at {url}")
        return f"Opening browser at {url}"
    except Exception as e:
        return f"[Nyx] Could not open browser: {e}"


def open_notepad() -> str:
    try:
        if OS == "Windows":
            subprocess.Popen(["notepad.exe"])
        elif OS == "Darwin":
            subprocess.Popen(["open", "-a", "TextEdit"])
        else:
            for editor in ["gedit", "mousepad", "xed", "kate"]:
                try:
                    subprocess.Popen([editor])
                    break
                except FileNotFoundError:
                    continue
        log.info("Opened text editor.")
        return "Opening text editor..."
    except Exception as e:
        return f"[Nyx] Could not open text editor: {e}"


def open_calculator() -> str:
    try:
        if OS == "Windows":
            subprocess.Popen(["calc.exe"])
        elif OS == "Darwin":
            subprocess.Popen(["open", "-a", "Calculator"])
        else:
            for calc in ["gnome-calculator", "kcalc", "xcalc"]:
                try:
                    subprocess.Popen([calc])
                    break
                except FileNotFoundError:
                    continue
        log.info("Opened calculator.")
        return "Opening calculator..."
    except Exception as e:
        return f"[Nyx] Could not open calculator: {e}"


def open_discord() -> str:
    try:
        if OS == "Windows":
            subprocess.Popen(["cmd", "/c", "start", "discord://"])
        elif OS == "Darwin":
            subprocess.Popen(["open", "-a", "Discord"])
        else:
            subprocess.Popen(["xdg-open", "discord://"])
        log.info("Opened Discord.")
        return "Opening Discord..."
    except Exception as e:
        return f"[Nyx] Could not open Discord: {e}"


APP_COMMANDS = {
    "open browser":    open_browser,
    "open notepad":    open_notepad,
    "open calculator": open_calculator,
    "open discord":    open_discord,
}


def handle_app_command(user_input: str):
    """Returns a result string if input matches an app command, else None."""
    text = user_input.strip().lower()
    for cmd, fn in APP_COMMANDS.items():
        if text.startswith(cmd):
            return fn()
    return None