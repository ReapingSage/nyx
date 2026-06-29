"""
tools/web/weather.py — Real-time weather lookup via wttr.in (no API key needed).
"""

import re
import requests
from utils.logger import get_logger

log = get_logger(__name__)

# Patterns to extract a location from a weather query
_PATTERNS = [
    r"what(?:'s|\s+is|\s+was)\s+the\s+weather\s+looking\s+like\s+(?:in|for|at)\s+(.+)",
    r"what(?:'s|\s+is|\s+was)\s+the\s+weather\s+(?:like\s+)?(?:in|for|at|around)\s+(.+)",
    r"how(?:'s|\s+is)\s+the\s+weather\s+(?:in|for|at)\s+(.+)",
    r"weather\s+(?:in|for|at|around)\s+(.+)",
    r"weather\s+(?:\w+\s+){0,3}(?:in|for|at)\s+(.+)",
]


def is_weather_query(text: str) -> bool:
    return "weather" in text.lower()


def extract_location(text: str) -> str | None:
    lower = text.lower().strip().rstrip("?").rstrip(".")
    for pattern in _PATTERNS:
        m = re.search(pattern, lower)
        if m:
            loc = m.group(1).strip()
            # Strip trailing filler words
            loc = re.sub(r"\s*(today|right now|currently|please|now)\s*$", "", loc).strip()
            return loc if loc else None
    return None


def get_weather(location: str) -> str:
    """Fetch current conditions from wttr.in for the given location string."""
    try:
        encoded = requests.utils.quote(location)
        url = f"https://wttr.in/{encoded}?format=j1"
        r = requests.get(url, timeout=8, headers={"User-Agent": "Nyx/1.0"})
        r.raise_for_status()
        data = r.json()

        current = data["current_condition"][0]
        area    = data["nearest_area"][0]

        city    = area["areaName"][0]["value"]
        region  = area["region"][0]["value"]
        country = area["country"][0]["value"]

        temp_f   = current["temp_F"]
        feels_f  = current["FeelsLikeF"]
        humidity = current["humidity"]
        desc     = current["weatherDesc"][0]["value"]
        wind_mph = current["windspeedMiles"]
        wind_dir = current["winddir16Point"]
        vis      = current["visibility"]

        place = f"{city}, {region}" if region else f"{city}, {country}"

        return (
            f"Current weather in {place}:\n"
            f"  {desc} — {temp_f}°F (feels like {feels_f}°F)\n"
            f"  Humidity: {humidity}%  ·  Wind: {wind_mph} mph {wind_dir}  ·  Visibility: {vis} mi"
        )

    except requests.exceptions.ConnectionError:
        return "[Nyx] Can't reach the weather service — check your internet connection."
    except requests.exceptions.Timeout:
        return "[Nyx] Weather request timed out."
    except (KeyError, IndexError, ValueError) as e:
        log.error(f"[weather] Unexpected response format for '{location}': {e}")
        return f"[Nyx] Got an unexpected response from the weather service for '{location}'."
    except Exception as e:
        log.error(f"[weather] Error for '{location}': {e}")
        return f"[Nyx] Couldn't get weather for '{location}': {e}"
