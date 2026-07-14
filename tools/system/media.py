"""
tools/system/media.py — System Volume + Media Key Control

Presses the same virtual keys a keyboard's media buttons send, via the
Win32 API (ctypes) — no extra dependencies, and it controls whatever app
currently owns playback (Spotify, browser, game), exactly like the
physical keys would.

Each volume key press changes Windows volume by 2 units (out of 100).
"""

import platform

from utils.logger import get_logger

log = get_logger(__name__)

_VK = {
    "mute":       0xAD,  # VK_VOLUME_MUTE
    "vol_down":   0xAE,  # VK_VOLUME_DOWN
    "vol_up":     0xAF,  # VK_VOLUME_UP
    "next":       0xB0,  # VK_MEDIA_NEXT_TRACK
    "prev":       0xB1,  # VK_MEDIA_PREV_TRACK
    "stop":       0xB2,  # VK_MEDIA_STOP
    "play_pause": 0xB3,  # VK_MEDIA_PLAY_PAUSE
}

_KEYEVENTF_KEYUP = 0x0002


def _press(name: str, times: int = 1) -> bool:
    if platform.system() != "Windows":
        return False
    import ctypes
    code = _VK[name]
    for _ in range(times):
        ctypes.windll.user32.keybd_event(code, 0, 0, 0)
        ctypes.windll.user32.keybd_event(code, 0, _KEYEVENTF_KEYUP, 0)
    return True


def volume_up(steps: int = 5) -> str:
    """Each step = one key press = +2 volume units."""
    steps = max(1, min(25, steps))
    if not _press("vol_up", steps):
        return "[Nyx] Volume control is only supported on Windows right now."
    return f"Volume up {steps * 2}%."


def volume_down(steps: int = 5) -> str:
    steps = max(1, min(25, steps))
    if not _press("vol_down", steps):
        return "[Nyx] Volume control is only supported on Windows right now."
    return f"Volume down {steps * 2}%."


def mute_toggle() -> str:
    if not _press("mute"):
        return "[Nyx] Volume control is only supported on Windows right now."
    return "Toggled mute."


def play_pause() -> str:
    if not _press("play_pause"):
        return "[Nyx] Media keys are only supported on Windows right now."
    return "Toggled play/pause."


def next_track() -> str:
    if not _press("next"):
        return "[Nyx] Media keys are only supported on Windows right now."
    return "Skipped to the next track."


def previous_track() -> str:
    if not _press("prev"):
        return "[Nyx] Media keys are only supported on Windows right now."
    return "Went back a track."


def stop_playback() -> str:
    if not _press("stop"):
        return "[Nyx] Media keys are only supported on Windows right now."
    return "Stopped playback."
