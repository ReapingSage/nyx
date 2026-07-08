"""
tools/desktop/mouse.py — Mouse Control (Phase 7)

Clicks, moves, and scrolls via pyautogui. pyautogui's failsafe stays on:
slam the mouse into the top-left screen corner to abort any runaway
automation.
"""

from utils.logger import get_logger

log = get_logger(__name__)


def _pyautogui():
    import pyautogui
    pyautogui.FAILSAFE = True
    return pyautogui


def click(button: str = "left", double: bool = False, x: int | None = None, y: int | None = None) -> str:
    """Click at the current cursor position (or x,y if given)."""
    if button not in ("left", "right", "middle"):
        return f"[Nyx] Unknown mouse button '{button}'."
    try:
        pag = _pyautogui()
        clicks = 2 if double else 1
        pag.click(x=x, y=y, clicks=clicks, button=button)
        desc = f"{'double-' if double else ''}{button}-click"
        log.info(f"[mouse] {desc} at {(x, y) if x is not None else 'cursor'}")
        return f"Did a {desc}."
    except Exception as e:
        return f"[Nyx] Could not click: {e}"


def move_to(x: int, y: int) -> str:
    try:
        pag = _pyautogui()
        w, h = pag.size()
        if not (0 <= x < w and 0 <= y < h):
            return f"[Nyx] ({x}, {y}) is off-screen — display is {w}x{h}."
        pag.moveTo(x, y, duration=0.2)
        return f"Moved the cursor to ({x}, {y})."
    except Exception as e:
        return f"[Nyx] Could not move mouse: {e}"


def scroll(direction: str = "down", amount: int = 5) -> str:
    """Scroll the window under the cursor. amount = notches (~1 line each)."""
    amount = max(1, min(50, amount))
    try:
        pag = _pyautogui()
        pag.scroll(amount * (1 if direction == "up" else -1) * 100)
        return f"Scrolled {direction}."
    except Exception as e:
        return f"[Nyx] Could not scroll: {e}"


def position() -> str:
    try:
        pag = _pyautogui()
        x, y = pag.position()
        return f"Cursor is at ({x}, {y})."
    except Exception as e:
        return f"[Nyx] Could not read cursor position: {e}"
