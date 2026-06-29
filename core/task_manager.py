"""
core/task_manager.py — Task Complexity Scorer
Scores incoming tasks so the agent can make smarter routing decisions.

v1: Simple heuristics (length, question marks, keyword density).
Future: Replace with a phi3 classifier call for zero-shot complexity scoring.
"""

from utils.logger import get_logger

log = get_logger(__name__)

# Complexity tiers
SIMPLE   = "simple"
MODERATE = "moderate"
COMPLEX  = "complex"

COMPLEX_SIGNALS = {
    "explain", "how does", "why does", "compare", "difference between",
    "step by step", "in detail", "walk me through", "architecture",
    "design", "implement", "build", "create a system",
}

SIMPLE_SIGNALS = {
    "what is", "define", "yes or no", "quick", "briefly",
    "one word", "spell", "remind me", "when is",
}


def score(user_input: str) -> str:
    """
    Assign a complexity tier to the user's input.

    Args:
        user_input: Raw user message.

    Returns:
        "simple", "moderate", or "complex"
    """
    text = user_input.lower()
    word_count = len(text.split())

    # Short messages are usually simple
    if word_count <= 6:
        if any(sig in text for sig in SIMPLE_SIGNALS):
            return SIMPLE

    # Long or detailed messages are complex
    if word_count > 40 or any(sig in text for sig in COMPLEX_SIGNALS):
        log.debug(f"Task scored as COMPLEX ({word_count} words)")
        return COMPLEX

    if any(sig in text for sig in SIMPLE_SIGNALS):
        log.debug("Task scored as SIMPLE")
        return SIMPLE

    log.debug("Task scored as MODERATE")
    return MODERATE