"""
tools/web/steam.py — Real-time Steam game price/info lookup via Steam's public
Store API (no API key needed, free, 100k requests/day).
"""

import html
import re

import requests
from utils.logger import get_logger

log = get_logger(__name__)

_PATTERNS = [
    r"(?:steam\s+)?price\s+(?:of|for)\s+(.+?)\s+on\s+steam",
    r"how much (?:is|does|do)\s+(.+?)\s+cost\s+on\s+steam",
    r"is\s+(.+?)\s+on\s+sale\s+on\s+steam",
    r"(?:check|look\s?up|find)\s+(.+?)\s+on\s+steam",
    r"steam\s+price\s+(?:of|for)\s+(.+)",
    r"steam\s+(?:page|listing|info|details)\s+(?:for|on|about)\s+(.+)",
]


def is_steam_query(text: str) -> bool:
    lower = text.lower()
    return any(re.search(p, lower) for p in _PATTERNS)


def extract_game_name(text: str) -> str | None:
    lower = text.lower().strip().rstrip("?.!")
    for pattern in _PATTERNS:
        m = re.search(pattern, lower)
        if m:
            name = m.group(1).strip()
            return name if name else None
    return None


def _find_appid(name: str) -> tuple[int, str] | None:
    """Resolve a game name to (appid, matched_name) via Steam's store search."""
    r = requests.get(
        "https://store.steampowered.com/api/storesearch",
        params={"term": name, "cc": "us", "l": "en"},
        timeout=8, headers={"User-Agent": "Nyx/1.0"},
    )
    r.raise_for_status()
    items = r.json().get("items", [])
    # Prefer an exact (case-insensitive) title match over the first result —
    # storesearch often ranks DLC/soundtracks above the base game.
    exact = next((i for i in items if i.get("name", "").lower() == name.lower()), None)
    best = exact or (items[0] if items else None)
    if best is None:
        return None
    return best["id"], best["name"]


def get_game_info(name: str) -> str:
    """Fetch price/release/genre info for a game from the Steam Store API."""
    try:
        found = _find_appid(name)
        if found is None:
            return f"[Nyx] Couldn't find '{name}' on Steam."
        appid, matched_name = found

        r = requests.get(
            "https://store.steampowered.com/api/appdetails",
            params={"appids": appid, "cc": "us", "l": "en"},
            timeout=8, headers={"User-Agent": "Nyx/1.0"},
        )
        r.raise_for_status()
        entry = r.json().get(str(appid), {})
        if not entry.get("success"):
            return f"[Nyx] Steam has no store page data for '{matched_name}'."
        data = entry["data"]

        if data.get("is_free"):
            price_line = "Free to play"
        elif "price_overview" in data:
            p = data["price_overview"]
            price_line = p["final_formatted"]
            if p.get("discount_percent"):
                price_line = f"{p['final_formatted']} ({p['discount_percent']}% off {p['initial_formatted']})"
        else:
            price_line = "No price listed (not available for purchase, or region-locked)"

        release = data.get("release_date", {})
        release_line = "Coming soon" if release.get("coming_soon") else release.get("date", "Unknown")

        genres = ", ".join(g["description"] for g in data.get("genres", [])) or "Unlisted"
        desc = html.unescape(re.sub(r"<[^>]+>", "", data.get("short_description", ""))).strip()

        lines = [
            f"{data.get('name', matched_name)} (Steam):",
            f"  Price: {price_line}",
            f"  Released: {release_line}  ·  Genres: {genres}",
        ]
        if desc:
            lines.append(f"  {desc}")
        return "\n".join(lines)

    except requests.exceptions.ConnectionError:
        return "[Nyx] Can't reach Steam — check your internet connection."
    except requests.exceptions.Timeout:
        return "[Nyx] Steam request timed out."
    except Exception as e:
        log.error(f"[steam] Error for '{name}': {e}")
        return f"[Nyx] Couldn't get Steam info for '{name}': {e}"
