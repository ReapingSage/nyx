"""
frameworks/openclaw/claw.py — OpenClaw Desktop Controller
Mouse, keyboard, and screenshot control via pyautogui.

All actions route through permissions.can_do() first.
"""

import time
from pathlib import Path
from utils.logger import get_logger

log = get_logger(__name__)

SCREENSHOT_DIR = Path.home() / ".nyx" / "screenshots"
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)


class Claw:
    """Nyx's desktop control engine — mouse, keyboard, and screen capture."""

    def __init__(self):
        self._pg = None
        try:
            import pyautogui
            pyautogui.FAILSAFE = True
            pyautogui.PAUSE    = 0.08
            self._pg = pyautogui
            log.info("[claw] pyautogui ready.")
        except ImportError:
            log.warning("[claw] pyautogui not installed — desktop control unavailable.")

    def _pg_or_raise(self):
        if self._pg is None:
            raise RuntimeError("pyautogui is not installed. Run: pip install pyautogui pillow")
        return self._pg

    def screenshot(self) -> str:
        pg   = self._pg_or_raise()
        ts   = int(time.time())
        path = SCREENSHOT_DIR / f"nyx_{ts}.png"
        pg.screenshot().save(str(path))
        log.info(f"[claw] Screenshot saved to {path}")
        return str(path)

    def click(self, x: int, y: int) -> str:
        self._pg_or_raise().click(x, y)
        log.info(f"[claw] Clicked ({x}, {y})")
        return f"Clicked at ({x}, {y})."

    def right_click(self, x: int, y: int) -> str:
        self._pg_or_raise().rightClick(x, y)
        return f"Right-clicked at ({x}, {y})."

    def double_click(self, x: int, y: int) -> str:
        self._pg_or_raise().doubleClick(x, y)
        return f"Double-clicked at ({x}, {y})."

    def type(self, text: str, interval: float = 0.04) -> str:
        self._pg_or_raise().typewrite(text, interval=interval)
        log.info(f"[claw] Typed {len(text)} chars.")
        return f"Typed: {text[:40]}{'…' if len(text) > 40 else ''}"

    def hotkey(self, *keys: str) -> str:
        self._pg_or_raise().hotkey(*keys)
        return f"Pressed {'+'.join(keys)}."

    def scroll(self, clicks: int, x: int | None = None, y: int | None = None) -> str:
        pg = self._pg_or_raise()
        if x is not None and y is not None:
            pg.scroll(clicks, x=x, y=y)
        else:
            pg.scroll(clicks)
        return f"Scrolled {clicks} clicks."

    def open(self, app_name: str) -> str:
        import subprocess, platform
        name = app_name.lower().strip()
        OS   = platform.system()

        safe_apps: dict[str, list[str]] = {
            "notepad":    ["notepad.exe"]                       if OS == "Windows" else ["gedit"],
            "calculator": ["calc.exe"]                          if OS == "Windows" else ["gnome-calculator"],
            "discord":    ["cmd", "/c", "start", "discord://"] if OS == "Windows" else ["xdg-open", "discord://"],
            "explorer":   ["explorer.exe"]                      if OS == "Windows" else ["nautilus"],
            "terminal":   ["cmd.exe"]                           if OS == "Windows" else ["x-terminal-emulator"],
            "vscode":     ["code"],
            "chrome":     ["cmd", "/c", "start", "chrome"]     if OS == "Windows" else ["google-chrome"],
            "browser":    ["cmd", "/c", "start", ""]           if OS == "Windows" else ["xdg-open", "https://google.com"],
        }

        cmd = safe_apps.get(name)
        if cmd is None:
            return f"[Nyx] '{app_name}' is not in the safe app list. Ask me to add it."
        try:
            subprocess.Popen(cmd)
            log.info(f"[claw] Opened {app_name}")
            return f"Opening {app_name}…"
        except Exception as e:
            return f"[Nyx] Could not open {app_name}: {e}"

    def find_window(self, title: str) -> str:
        try:
            import pygetwindow as gw
            wins = gw.getWindowsWithTitle(title)
            if not wins:
                return f"[Nyx] No window with title containing '{title}' found."
            wins[0].activate()
            return f"Focused window: '{wins[0].title}'"
        except ImportError:
            return "[Nyx] pygetwindow not installed. Run: pip install pygetwindow"
        except Exception as e:
            return f"[Nyx] Could not focus window '{title}': {e}"

    def move_to_monitor(self, window_title: str, monitor_index: int = 1) -> str:
        """Move a window to the specified monitor (0=primary, 1=secondary)."""
        try:
            import pygetwindow as gw
            wins = gw.getWindowsWithTitle(window_title)
            if not wins:
                return f"[Nyx] No window with title containing '{window_title}' found."
            win = wins[0]
            bounds = get_monitor_bounds(monitor_index)
            if bounds is None:
                return f"[Nyx] Could not get bounds for monitor {monitor_index}. Is screeninfo installed? (pip install screeninfo)"
            left, top, *_ = bounds
            win.moveTo(left + 40, top + 40)
            win.activate()
            log.info(f"[claw] Moved '{win.title}' to monitor {monitor_index}")
            return f"Moved '{win.title}' to monitor {monitor_index + 1}."
        except ImportError:
            return "[Nyx] pygetwindow not installed. Run: pip install pygetwindow"
        except Exception as e:
            return f"[Nyx] Could not move window: {e}"


def get_monitor_bounds(monitor_index: int) -> tuple[int, int, int, int] | None:
    """Return (left, top, width, height) for the monitor at monitor_index (0-based)."""
    # Try screeninfo first
    try:
        import screeninfo
        monitors = screeninfo.get_monitors()
        if 0 <= monitor_index < len(monitors):
            m = monitors[monitor_index]
            return m.x, m.y, m.width, m.height
        return None
    except ImportError:
        pass

    # ctypes fallback (Windows only)
    try:
        import ctypes
        import ctypes.wintypes
        found: list[tuple[int, int, int, int]] = []

        def _cb(hMon, hdcMon, lpRect, _data):
            r = lpRect.contents
            found.append((r.left, r.top, r.right - r.left, r.bottom - r.top))
            return 1

        MonitorEnumProc = ctypes.WINFUNCTYPE(
            ctypes.c_bool,
            ctypes.c_ulong, ctypes.c_ulong,
            ctypes.POINTER(ctypes.wintypes.RECT),
            ctypes.c_double,
        )
        ctypes.windll.user32.EnumDisplayMonitors(None, None, MonitorEnumProc(_cb), 0)
        if 0 <= monitor_index < len(found):
            return found[monitor_index]
    except Exception:
        pass

    return None
