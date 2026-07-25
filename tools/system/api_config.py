"""
tools/system/api_config.py — Chat-driven API key + provider priority control.

"add my tavily key tvly-xxx", "make tavily primary for search",
"use ddg first for search"

Deliberately narrow: only ever writes a whitelisted .env var (via
core.api_credentials) or reorders a provider list in app_settings.json.
Never touches application code.
"""

import re

from core import api_credentials, app_settings
from utils.logger import get_logger

log = get_logger(__name__)

_ALIASES = {"duckduckgo": "ddg", "duck duck go": "ddg", "duck-duck-go": "ddg"}

_SET_KEY_RE = re.compile(
    r"\b(?:add|set|save|update)\s+(?:my\s+)?(\w+)\s+(?:api\s+)?key\s*(?:to|is|:)?\s+(\S+)",
    re.I,
)

_PRIORITY_RE = re.compile(
    r"\b(?:make|set|use)\s+(\w+)\s+(?:as\s+)?(?:the\s+)?(?:primary|priority|first)"
    r"(?:\s+(?:for\s+)?(\w+))?\b",
    re.I,
)
_PRIORITIZE_RE = re.compile(r"\bprioritize\s+(\w+)(?:\s+(?:for\s+)?(\w+))?\b", re.I)


def _normalize(name: str) -> str:
    name = name.lower().strip()
    return _ALIASES.get(name, name)


def _set_priority(provider: str, category: str | None) -> str:
    provider = _normalize(provider)

    if category is None:
        entry = api_credentials.PROVIDERS.get(provider)
        if entry is None:
            return (
                f"[Nyx] '{provider}' primary for what? I know it as a provider for: "
                f"{', '.join(sorted({e['category'] for e in api_credentials.PROVIDERS.values()})) or 'nothing yet'}. "
                f"Try \"make {provider} primary for search\"."
            )
        category = entry["category"]

    priority = app_settings.get_section("api_priority")
    current = priority.get(category)
    if current is None:
        return f"[Nyx] I don't have a '{category}' provider list to prioritize."

    if provider not in current:
        return f"[Nyx] '{provider}' isn't a known {category} provider. I know: {', '.join(current)}."

    new_order = [provider] + [p for p in current if p != provider]
    app_settings.update_section("api_priority", {category: new_order})
    return f"[Nyx] {provider} is now primary for {category}. Order: {' → '.join(new_order)}."


def try_handle(text: str) -> str | None:
    m = _SET_KEY_RE.search(text)
    if m:
        provider, key = m.group(1), m.group(2)
        return api_credentials.set_key(provider, key)

    m = _PRIORITY_RE.search(text) or _PRIORITIZE_RE.search(text)
    if m:
        provider, category = m.group(1), m.group(2)
        return _set_priority(provider, category)

    return None
