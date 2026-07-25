"""
tools/web/search.py — Explicit web search, Tavily-first with a DuckDuckGo
fallback (no API key needed for DDG). Triggered only when the user says
"search for", "look up", etc. Results are fed as context to the LLM so Nyx
synthesizes a real answer.
"""

import re

import requests
import config
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


DEFAULT_ORDER = ["tavily", "ddg"]


def _search_tavily(query: str, max_results: int) -> list[dict] | None:
    """Pure call — no retry/fallback logic here, that's provider_router's job.

    Returns None if Tavily simply isn't configured (no key — not a failure,
    just unavailable). Raises on any real failure (network error, quota,
    auth, bad response) so the caller can apply health/cooldown tracking.
    A genuine zero-result search still returns [] (a real answer, not a
    failure), same as DDG."""
    if not config.TAVILY_API_KEY:
        return None
    r = requests.post(
        "https://api.tavily.com/search",
        headers={"Authorization": f"Bearer {config.TAVILY_API_KEY}"},
        json={"query": query, "max_results": max_results},
        timeout=10,
    )
    if r.status_code == 432:
        raise RuntimeError(f"Tavily quota exhausted: {r.text[:200]}")
    r.raise_for_status()
    results = [
        {"title": item.get("title", ""), "href": item.get("url", ""), "body": item.get("content", "")}
        for item in r.json().get("results", [])
    ]
    log.info(f"[search] (tavily) '{query}' → {len(results)} results")
    return results


def _search_ddg(query: str, max_results: int) -> list[dict]:
    try:
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
        log.info(f"[search] (ddg) '{query}' → {len(results)} results")
        return results
    except Exception as e:
        log.error(f"[search] DDG error for '{query}': {e}")
        return []


def search(query: str, max_results: int = 5, agent: str = "search") -> list[dict]:
    """Walks `agent`'s configured provider order (core/provider_router.py —
    reorderable per-agent at runtime via tools/system/api_config.py, e.g.
    "make ddg primary for search") until one returns results.

    `agent` lets callers with their own identity (Momus, Hemera) have
    independent provider priority/health even though they share this same
    underlying search call — pass e.g. agent="momus" from a caller that
    should be tracked separately from the generic "search" bucket.

    Tavily gets real health/cooldown tracking through provider_router — a
    hard failure benches it for a while instead of retrying every request.
    DDG is the unconditional final fallback: free, keyless, never benched,
    so a request can never come back completely empty just because every
    paid provider is having a bad day."""
    from core import provider_router

    order = provider_router.get_priority(agent, DEFAULT_ORDER)
    for provider in order:
        if provider == "tavily":
            if not provider_router.is_healthy("tavily"):
                log.info(f"[search] Skipping tavily for agent '{agent}' — in cooldown")
                continue
            try:
                results = _search_tavily(query, max_results)
            except Exception as e:
                log.warning(f"[search] Tavily error for '{query}': {e} — falling back")
                provider_router.mark_failure("tavily")
                continue
            if results is not None:
                provider_router.mark_success("tavily")
                return results
            # None = not configured (no key) — not a failure, just skip.
        elif provider == "ddg":
            return _search_ddg(query, max_results)

    return _search_ddg(query, max_results)


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
