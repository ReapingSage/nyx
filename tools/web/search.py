"""
tools/web/search.py — Explicit web search via DuckDuckGo (no API key needed).
Triggered only when the user says "search for", "look up", etc.
Results are fed as context to the LLM so Nyx synthesizes a real answer.
"""

import re
from utils.logger import get_logger

log = get_logger(__name__)

_TRIGGERS = [
    # explicit search commands
    r"search(?:\s+the\s+web)?\s+for\s+(.+)",
    r"look\s+up\s+(.+)",
    r"lookup\s+(.+)",
    r"find\s+information\s+(?:on|about)\s+(.+)",
    r"find\s+(?:out\s+)?(?:about\s+)?(.+?)\s+(?:online|on the web)",
    r"google\s+(.+)",
    r"web\s+search\s+(?:for\s+)?(.+)",
    r"search\s+(.+)",
    # current / real-time info requests
    r"what(?:'s| is) the (?:latest|current|recent)\s+(?:news\s+(?:on|about)\s+)?(.+)",
    r"what(?:'s| is) happening (?:with|in)\s+(.+)",
    r"(?:latest|recent|current|today'?s?)\s+news\s+(?:on|about)?\s*(.+)",
    r"what(?:'s| is) (?:going on|new) with\s+(.+)",
    r"(?:tell me about|what about)\s+(?:the\s+)?(?:latest|recent|current)\s+(.+)",
    r"(?:price|cost|value|stock)\s+of\s+(.+)",
    r"how much (?:is|does|do)\s+(.+?)(?:\s+cost)?",
    r"news (?:about|on)\s+(.+)",
    r"(?:who won|what happened|results of)\s+(.+)",
    r"(?:weather|forecast)\s+(?:in|for)\s+(.+)",
]

# Patterns that signal the user wants current/live info even without explicit "search"
# NOTE: no bare time-words pattern (today/tonight/right now/...) — it fired a
# multi-second web lookup on personal messages like "I'm tired today" where a
# search result is useless. Time words only count next to a news-ish word.
_LIVE_INFO_PATTERNS = [
    r"\b(?:latest|recent|breaking|live|real.?time)\b",
    r"\b(?:news|headline|announcement)\b",
    r"\b(?:score|result|winner|standings)\b",
    r"\b(?:price|stock|crypto|bitcoin|market)\b",
    r"\b(?:today'?s?|tonight'?s?)\s+(?:news|weather|score|game|match|headlines?)\b",
]


def needs_web(text: str) -> bool:
    """Return True if the query likely needs a live web lookup."""
    lower = text.lower()
    return any(re.search(p, lower) for p in _LIVE_INFO_PATTERNS)


def is_search_query(text: str) -> bool:
    lower = text.lower()
    return any(re.search(p, lower) for p in _TRIGGERS)


def extract_search_query(text: str) -> str | None:
    lower = text.lower().strip().rstrip("?.!")
    for pattern in _TRIGGERS:
        m = re.search(pattern, lower)
        if m:
            q = m.group(1).strip()
            return q if q else None
    return None


def search(query: str, max_results: int = 5) -> list[dict]:
    """Return up to max_results DDG results as [{title, href, body}] dicts."""
    try:
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
        log.info(f"[search] '{query}' → {len(results)} results")
        return results
    except Exception as e:
        log.error(f"[search] DDG error for '{query}': {e}")
        return []


def build_context(query: str, results: list[dict]) -> str:
    """Format search results into a system-context block for the LLM."""
    if not results:
        return ""
    snippets = []
    for i, r in enumerate(results, 1):
        snippets.append(f"[{i}] {r.get('title', '')}\n{r.get('body', '')}\nURL: {r.get('href', '')}")
    joined = "\n\n".join(snippets)
    return (
        f"[Web search results for: '{query}']\n\n"
        f"{joined}\n\n"
        f"Using only the sources above, answer the user's question accurately and concisely. "
        f"If relevant, mention the source URL."
    )
