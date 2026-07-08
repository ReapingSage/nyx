"""
tools/desktop/keyboard.py — Keyboard Control (Phase 7)

Types text and presses keys/hotkeys via pyautogui into whatever window
currently has focus. pyautogui's failsafe stays on: slam the mouse into
the top-left screen corner to abort any runaway automation.
"""

from utils.logger import get_logger

log = get_logger(__name__)


def _pyautogui():
    import pyautogui
    pyautogui.FAILSAFE = True
    return pyautogui


def type_text(text: str, interval: float = 0.02) -> str:
    """Type text into the focused window, like a human typing quickly."""
    if not text:
        return "[Nyx] Nothing to type."
    if len(text) > 2000:
        return "[Nyx] That's too much to type at once (2000 character limit)."
    try:
        pag = _pyautogui()
        pag.write(text, interval=interval)
        log.info(f"[keyboard] Typed {len(text)} chars")
        return f"Typed it ({len(text)} characters)."
    except Exception as e:
        return f"[Nyx] Could not type: {e}"


def press_key(key: str) -> str:
    """Press a single key ('enter', 'f5') or a hotkey combo ('ctrl+s', 'alt+tab')."""
    key = key.lower().strip().replace(" ", "")
    try:
        pag = _pyautogui()
        if "+" in key:
            parts = [p for p in key.split("+") if p]
            bad = [p for p in parts if p not in pag.KEYBOARD_KEYS]
            if bad:
                return f"[Nyx] Unknown key(s) in combo: {', '.join(bad)}"
            pag.hotkey(*parts)
            log.info(f"[keyboard] Hotkey: {key}")
            return f"Pressed {'+'.join(parts)}."
        if key not in pag.KEYBOARD_KEYS:
            return f"[Nyx] Unknown key: '{key}'"
        pag.press(key)
        log.info(f"[keyboard] Key: {key}")
        return f"Pressed {key}."
    except Exception as e:
        return f"[Nyx] Could not press key: {e}"


# Back-compat with the old placeholder API
def press(key: str) -> str:
    return press_key(key)
