"""
tools/web/trends.py — "Hemera", Nyx's trend-tracking worker.

Named for Nyx's mythological daughter, the goddess of Day — a fitting
counterpart to Nyx herself: Nyx handles what's local and private, Hemera
surfaces what's current and visible out in the world.

Searches for what's currently trending (tools.web.search — Tavily/DDG),
then has the reasoning model summarize it, rather than answering from
frozen training data that can't know what's trending *today*.
"""

import re

import config
from utils.logger import get_logger

log = get_logger(__name__)

_PATTERNS = [
    r"what(?:'s|s|\s+is)\s+trending\s+(?:in|on|for|with)\s+(.+)",
    r"trending\s+(?:topics|news)\s+(?:in|on|for)\s+(.+)",
    r"(?:latest|current)\s+trends\s+(?:in|for)\s+(.+)",
    r"what(?:'s|s|\s+is)\s+(?:new|happening)\s+(?:in|with)\s+(.+)",
]


def is_trend_query(text: str) -> bool:
    lower = text.lower()
    return any(re.search(p, lower) for p in _PATTERNS)


def extract_topic(text: str) -> str | None:
    lower = text.lower().strip().rstrip("?.!")
    for pattern in _PATTERNS:
        m = re.search(pattern, lower)
        if m:
            topic = m.group(1).strip()
            topic = re.sub(r"\s*(today|right now|lately|currently)\s*$", "", topic).strip()
            return topic if topic else None
    return None


def get_trends(topic: str) -> str:
    """Hemera: search for what's current, then have the model summarize it
    as concrete named trends, not generic commentary."""
    from tools.web.search import search
    from brain.ollama_provider import ask

    results = search(f"trending {topic}", max_results=6, agent="hemera")
    if not results:
        return f"[Hemera] Couldn't find anything currently trending for '{topic}'."

    snippets = "\n\n".join(
        f"[{i}] {r.get('title', '')}\n{r.get('body', '')}\nURL: {r.get('href', '')}"
        for i, r in enumerate(results, 1)
    )
    messages = [
        {
            "role": "system",
            "content": (
                "You are Hemera, a trend-tracking worker. Summarize what's currently trending "
                "based on the sources below — list the actual, specific trends (not generic "
                "commentary about the topic), and mention which source each comes from."
            ),
        },
        {"role": "user", "content": f'Topic: "{topic}"\n\nSources:\n{snippets}'},
    ]
    return ask(model=config.MODEL_REASON, messages=messages)
