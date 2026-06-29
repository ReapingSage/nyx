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


def run_action(name: str, **kwargs) -> str:
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
