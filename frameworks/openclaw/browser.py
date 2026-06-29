"""
frameworks/openclaw/browser.py — Playwright Browser Automation
Handles web logins and navigation for Nyx.

Credentials come from .env — never hardcoded here.
Browser stays visible (headless=False) so you can see and take over at any time.
"""

import os
import time
import config
from utils.logger import get_logger

log = get_logger(__name__)

# Persistent browser state — reused across calls so the session stays logged in
_pw       = None
_browser  = None
_page     = None


def _get_page():
    """Return the current page, launching Chromium if not already open."""
    global _pw, _browser, _page
    try:
        from playwright.sync_api import sync_playwright
        if _browser is None or not _browser.is_connected():
            _pw      = sync_playwright().start()
            _browser = _pw.chromium.launch(headless=False, slow_mo=60)
            _page    = _browser.new_page()
            log.info("[browser] Chromium launched.")
        return _page
    except Exception as e:
        log.error(f"[browser] Failed to launch browser: {e}")
        raise


def _try_fill(page, selectors: list[str], value: str) -> bool:
    """Try each CSS selector in order, fill the first one found."""
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            if loc.count() > 0:
                loc.fill(value, timeout=4000)
                return True
        except Exception:
            continue
    return False


def _try_click(page, selectors: list[str]) -> bool:
    """Try each CSS selector in order, click the first one found."""
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            if loc.count() > 0:
                loc.click(timeout=4000)
                return True
        except Exception:
            continue
    return False


def navigate(url: str) -> str:
    """Open a URL in the managed browser."""
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    page = _get_page()
    page.goto(url, wait_until="domcontentloaded", timeout=20000)
    log.info(f"[browser] Navigated to {url}")
    return f"Opened {url} in browser."


def login_ixl() -> str:
    """Log into IXL using IXL_USERNAME / IXL_PASSWORD from .env."""
    username = config.IXL_USERNAME
    password = config.IXL_PASSWORD
    if not username or not password:
        return (
            "[Nyx] IXL credentials not set. "
            "Add IXL_USERNAME and IXL_PASSWORD to your .env file, then restart Nyx."
        )

    try:
        from playwright.sync_api import TimeoutError as PWTimeout
        page = _get_page()
        page.goto("https://www.ixl.com/signin/student", wait_until="domcontentloaded", timeout=20000)
        time.sleep(1)

        user_selectors = [
            'input[name="username"]',
            'input[placeholder*="username" i]',
            'input[placeholder*="user" i]',
            'input[type="text"]',
            '#username',
        ]
        pass_selectors = [
            'input[name="password"]',
            'input[placeholder*="password" i]',
            'input[type="password"]',
            '#password',
        ]
        submit_selectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Sign in")',
            'button:has-text("Log in")',
            '.signin-btn',
        ]

        if not _try_fill(page, user_selectors, username):
            return "[Nyx] Couldn't find the IXL username field. The page layout may have changed."
        if not _try_fill(page, pass_selectors, password):
            return "[Nyx] Couldn't find the IXL password field."
        if not _try_click(page, submit_selectors):
            return "[Nyx] Couldn't find the IXL submit button."

        page.wait_for_load_state("networkidle", timeout=15000)

        if "signin" in page.url or "login" in page.url:
            return "[Nyx] IXL login may have failed — still on the login page. Check your credentials in .env."

        log.info("[browser] IXL login successful.")
        return "Logged into IXL. The browser is open — go ahead and start your work."

    except Exception as e:
        return f"[Nyx] IXL login error: {e}"


def login_imagine() -> str:
    """Log into Imagine Learning / Edgenuity using credentials from .env."""
    username   = config.IMAGINE_USERNAME
    password   = config.IMAGINE_PASSWORD
    portal_url = config.IMAGINE_PORTAL_URL

    if not username or not password:
        return (
            "[Nyx] Imagine Learning credentials not set. "
            "Add IMAGINE_USERNAME, IMAGINE_PASSWORD (and optionally IMAGINE_PORTAL_URL) "
            "to your .env file, then restart Nyx."
        )

    try:
        page = _get_page()
        page.goto(portal_url, wait_until="domcontentloaded", timeout=20000)
        time.sleep(1)

        user_selectors = [
            'input[name="username"]',
            'input[name="loginId"]',
            'input[placeholder*="username" i]',
            'input[placeholder*="user" i]',
            'input[type="text"]',
            '#username', '#loginId',
        ]
        pass_selectors = [
            'input[name="password"]',
            'input[placeholder*="password" i]',
            'input[type="password"]',
            '#password',
        ]
        submit_selectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Sign in")',
            'button:has-text("Log in")',
            'button:has-text("Continue")',
        ]

        if not _try_fill(page, user_selectors, username):
            return "[Nyx] Couldn't find the username field on the Imagine portal."
        if not _try_fill(page, pass_selectors, password):
            return "[Nyx] Couldn't find the password field on the Imagine portal."
        if not _try_click(page, submit_selectors):
            return "[Nyx] Couldn't find the submit button on the Imagine portal."

        page.wait_for_load_state("networkidle", timeout=15000)
        log.info("[browser] Imagine Learning login attempted.")
        return "Logged into Imagine Learning. The browser is open — you're in."

    except Exception as e:
        return f"[Nyx] Imagine Learning login error: {e}"


def _find_opera_gx() -> str | None:
    """Scan common Windows install paths for the Opera GX executable."""
    candidates = [
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Opera GX\opera.exe"),
        os.path.expandvars(r"%PROGRAMFILES%\Opera GX\opera.exe"),
        os.path.expandvars(r"%PROGRAMFILES(X86)%\Opera GX\opera.exe"),
    ]
    for path in candidates:
        if os.path.isfile(path):
            return path
    return None


def open_in_opera(url: str) -> str:
    """Open a URL in Opera GX in a new tab."""
    import subprocess
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    opera = _find_opera_gx()
    if opera is None:
        return "[Nyx] Opera GX executable not found. Is Opera GX installed?"
    try:
        subprocess.Popen([opera, "--new-tab", url])
        log.info(f"[browser] Opened {url} in Opera GX")
        return f"Opened {url} in Opera GX."
    except Exception as e:
        return f"[Nyx] Could not open Opera GX: {e}"


def close_browser() -> str:
    """Close the managed browser and release resources."""
    global _pw, _browser, _page
    if _browser:
        try:
            _browser.close()
        except Exception:
            pass
        _browser = None
        _page    = None
    if _pw:
        try:
            _pw.stop()
        except Exception:
            pass
        _pw = None
    return "Browser closed."
