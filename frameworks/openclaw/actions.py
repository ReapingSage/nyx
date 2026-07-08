"""
frameworks/openclaw/actions.py — OpenClaw Named Action Library
Pre-built, named desktop and browser actions.

Usage:
    run_action("login_ixl")
    run_action("login_imagine")
    run_action("screenshot")
    run_action("open_browser", url="https://google.com")
"""

from utils.logger import get_logger
log = get_logger(__name__)

ACTION_REGISTRY: dict = {}


def register(name: str):
    def wrapper(fn):
        ACTION_REGISTRY[name] = fn
        return fn
    return wrapper


def run_action(name: str, /, **kwargs) -> str:
    # `/` makes name positional-only — otherwise an action kwarg that is
    # itself called "name" (e.g. kill_process) collides with this parameter.
    if name not in ACTION_REGISTRY:
        available = ", ".join(ACTION_REGISTRY.keys()) or "none"
        return f"[OpenClaw] Unknown action '{name}'. Available: {available}"
    log.info(f"[actions] Running: {name}")
    return ACTION_REGISTRY[name](**kwargs)


# ── Browser actions ───────────────────────────────────────────────────────────

@register("login_ixl")
def _login_ixl(**_) -> str:
    from frameworks.openclaw.browser import login_ixl
    return login_ixl()


@register("login_imagine")
def _login_imagine(**_) -> str:
    from frameworks.openclaw.browser import login_imagine
    return login_imagine()


@register("open_browser")
def _open_browser(url: str = "https://google.com", **_) -> str:
    from frameworks.openclaw.browser import navigate
    return navigate(url)


@register("close_browser")
def _close_browser(**_) -> str:
    from frameworks.openclaw.browser import close_browser
    return close_browser()


# ── Desktop actions ───────────────────────────────────────────────────────────

@register("screenshot")
def _screenshot(**_) -> str:
    from frameworks.openclaw.claw import Claw
    return Claw().screenshot()


@register("open_vscode")
def _open_vscode(**_) -> str:
    from frameworks.openclaw.claw import Claw
    return Claw().open("vscode")


@register("open_terminal")
def _open_terminal(**_) -> str:
    from frameworks.openclaw.claw import Claw
    return Claw().open("terminal")


@register("focus_vscode")
def _focus_vscode(**_) -> str:
    from frameworks.openclaw.claw import Claw
    return Claw().find_window("Visual Studio Code")


# ── Opera GX + monitor actions ────────────────────────────────────────────────

@register("open_opera_url")
def _open_opera_url(url: str = "https://google.com", **_) -> str:
    from frameworks.openclaw.browser import open_in_opera
    return open_in_opera(url)


@register("open_discord_opera")
def _open_discord_opera(**_) -> str:
    from frameworks.openclaw.browser import open_in_opera
    return open_in_opera("https://discord.com/app")


@register("move_window_to_monitor")
def _move_window_to_monitor(title: str = "Opera GX", monitor: int = 1, **_) -> str:
    from frameworks.openclaw.claw import Claw
    return Claw().move_to_monitor(title, monitor)


@register("open_discord_opera_monitor2")
def _open_discord_opera_monitor2(**_) -> str:
    """Open Discord in Opera GX, then move the Opera GX window to monitor 2."""
    import time
    from frameworks.openclaw.browser import open_in_opera
    from frameworks.openclaw.claw import Claw
    open_result = open_in_opera("https://discord.com/app")
    time.sleep(2.5)
    move_result = Claw().move_to_monitor("Opera GX", 1)
    return f"{open_result}\n{move_result}"


# ── Volume + media keys ───────────────────────────────────────────────────────

@register("volume_up")
def _volume_up(steps: int = 5, **_) -> str:
    from tools.system.media import volume_up
    return volume_up(steps)


@register("volume_down")
def _volume_down(steps: int = 5, **_) -> str:
    from tools.system.media import volume_down
    return volume_down(steps)


@register("mute_toggle")
def _mute_toggle(**_) -> str:
    from tools.system.media import mute_toggle
    return mute_toggle()


@register("play_pause")
def _play_pause(**_) -> str:
    from tools.system.media import play_pause
    return play_pause()


@register("next_track")
def _next_track(**_) -> str:
    from tools.system.media import next_track
    return next_track()


@register("previous_track")
def _previous_track(**_) -> str:
    from tools.system.media import previous_track
    return previous_track()


# ── Keyboard + mouse ──────────────────────────────────────────────────────────

@register("type_text")
def _type_text(text: str = "", **_) -> str:
    from tools.desktop.keyboard import type_text
    return type_text(text)


@register("press_key")
def _press_key(key: str = "", **_) -> str:
    from tools.desktop.keyboard import press_key
    return press_key(key)


@register("mouse_click")
def _mouse_click(button: str = "left", double: bool = False, **_) -> str:
    from tools.desktop.mouse import click
    return click(button=button, double=double)


@register("mouse_scroll")
def _mouse_scroll(direction: str = "down", amount: int = 5, **_) -> str:
    from tools.desktop.mouse import scroll
    return scroll(direction=direction, amount=amount)


# ── Files (write ops are home-dir-scoped; delete/move confirm first) ─────────

@register("create_file")
def _create_file(path: str = "", content: str = "", **_) -> str:
    from tools.system.files import create_file
    return create_file(path, content)


@register("append_file")
def _append_file(path: str = "", content: str = "", **_) -> str:
    from tools.system.files import append_file
    return append_file(path, content)


@register("create_folder")
def _create_folder(path: str = "", **_) -> str:
    from tools.system.files import create_folder
    return create_folder(path)


@register("move_file")
def _move_file(src: str = "", dst: str = "", **_) -> str:
    from tools.system.files import move_file
    return move_file(src, dst)


@register("delete_file")
def _delete_file(path: str = "", **_) -> str:
    from tools.system.files import delete_file
    return delete_file(path)


# ── Processes ─────────────────────────────────────────────────────────────────

@register("top_processes")
def _top_processes(**_) -> str:
    from tools.system.processes import top_processes
    return top_processes()


@register("kill_process")
def _kill_process(name: str = "", **_) -> str:
    from tools.system.processes import kill_process
    return kill_process(name)
