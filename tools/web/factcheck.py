"""
tools/web/factcheck.py — "Momus", Nyx's fact-checking worker.

Named for Nyx's mythological son, the god of satire, blame, and
fault-finding — fitting for a worker whose whole job is scrutinizing
claims rather than taking them at face value.

Searches for corroborating sources (tools.web.search — Tavily/DDG), then
has the reasoning model weigh them and deliver a verdict with citations,
rather than answering from frozen training data alone.
"""

import re

import config
from utils.logger import get_logger

log = get_logger(__name__)

_PATTERNS = [
    r"fact[\s-]?check\s+(?:that\s+)?(.+)",
    r"is\s+it\s+true\s+that\s+(.+)",
    r"verify\s+(?:that\s+)?(.+)",
    r"debunk\s+(.+)",
    r"check\s+if\s+(.+?)\s+is\s+true",
    r"is\s+(.+?)\s+(?:actually\s+)?(?:true|real|accurate)\??$",
]


def is_factcheck_query(text: str) -> bool:
    lower = text.lower()
    return any(re.search(p, lower) for p in _PATTERNS)


def extract_claim(text: str) -> str | None:
    lower = text.lower().strip().rstrip("?.!")
    for pattern in _PATTERNS:
        m = re.search(pattern, lower)
        if m:
            claim = m.group(1).strip()
            return claim if claim else None
    return None


def check_claim(claim: str) -> str:
    """Momus: search for evidence, then have the model weigh it and give a
    direct verdict — TRUE / FALSE / MIXED / UNVERIFIABLE — rather than a
    hedge-everything non-answer."""
    from tools.web.search import search
    from brain.ollama_provider import ask

    results = search(claim, max_results=6, agent="momus")
    if not results:
        return f"[Momus] Couldn't find any sources to check '{claim}' against — can't verify this one."

    snippets = "\n\n".join(
        f"[{i}] {r.get('title', '')}\n{r.get('body', '')}\nURL: {r.get('href', '')}"
        for i, r in enumerate(results, 1)
    )
    messages = [
        {
            "role": "system",
            "content": (
                "You are Momus, a fact-checking worker. Weigh the evidence below and give a "
                "clear verdict: TRUE, FALSE, MIXED, or UNVERIFIABLE. Be direct about your "
                "confidence and cite which source(s) support your verdict. If sources "
                "disagree or are inconclusive, say so plainly rather than guessing."
            ),
        },
        {"role": "user", "content": f'Claim to check: "{claim}"\n\nSources:\n{snippets}'},
    ]
    return ask(model=config.MODEL_REASON, messages=messages)
