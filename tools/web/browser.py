"""
tools/web/browser.py — Browser Control (Phase 3+)
Opens URLs safely. Full browser automation comes later.
"""

import webbrowser
from utils.logger import get_logger
log = get_logger(__name__)


def open_url(url: str) -> str:
    """Open a URL in the default browser."""
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    webbrowser.open(url)
    log.info(f"Opened URL: {url}")
    return f"Opening {url}"