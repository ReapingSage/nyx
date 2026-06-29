"""
brain/model_router.py — Task-to-Model Router
Reads the user's message and decides which local model to use.
Routing is keyword-based for now. Replace with a classifier later.
"""

import config
from utils.logger import get_logger

log = get_logger(__name__)

# ── Keyword routing tables ────────────────────────────────
# Add more keywords to any list to expand routing coverage.

CODING_KEYWORDS = {
    "code", "coding", "python", "javascript", "debug", "debugger",
    "error", "traceback", "exception", "function", "class", "import",
    "script", "program", "syntax", "variable", "loop", "algorithm",
    "fix", "bug", "refactor", "compile", "install package", "pip",
    "typescript", "html", "css", "sql", "bash", "shell", "api",
    "git", "github", "vscode",
}

FAST_KEYWORDS = {
    "quick", "fast", "simple", "short", "briefly", "one line",
    "yes or no", "what is", "define", "meaning of", "spell",
    "reminder", "note", "timer",
}

REASON_KEYWORDS = {
    "reason", "reasoning", "analyze", "analyse", "plan", "planning",
    "architecture", "architect", "compare", "pros and cons", "decide",
    "strategy", "breakdown", "step by step", "think through",
    "evaluate", "assess", "tool", "workflow", "structure",
}

# Creative / general — explicitly route to main model, not coder
CREATIVE_KEYWORDS = {
    "description", "describe", "write a", "give me a", "create a",
    "story", "bio", "backstory", "lore", "name ideas", "caption",
    "poem", "lyrics", "slogan", "tagline", "summary", "explain",
    "what should i", "help me think", "ideas for", "suggestion",
    "discord server", "server description", "about section",
}

# Desktop/automation actions — routed to OpenClaw, NOT Ollama
DESKTOP_KEYWORDS = {
    "open app", "launch app", "open browser", "open chrome", "open firefox",
    "open edge", "open notepad", "open explorer", "open terminal",
    "close app", "close window", "quit app", "kill process",
    "click", "right-click", "double-click",
    "type into", "press key", "keyboard shortcut",
    "screenshot", "take screenshot", "screen capture",
    "move window", "resize window", "minimize", "maximize",
    "open file", "open folder", "find file", "move file", "copy file",
    "navigate to url", "go to website", "browse to",
    "volume up", "volume down", "mute", "unmute",
    "scroll", "drag", "drop",
    "automate", "automation", "desktop task",
    # Opera GX + Discord + monitor control
    "opera gx", "open opera", "launch opera", "new tab in opera", "open in opera",
    "open discord", "launch discord", "close discord",
    "second monitor", "monitor 2", "move to monitor", "put on monitor",
}


def route(user_input: str) -> tuple[str, str]:
    """
    Decide which model to use for a given user message.

    Args:
        user_input: Raw text from the user.

    Returns:
        Tuple of (model_name, reason_string)
        reason_string explains why this model was chosen — useful for debugging.
    """
    text = user_input.lower()
    words = set(text.split())

    # Check desktop/automation keywords — route to OpenClaw layer
    if any(kw in text for kw in DESKTOP_KEYWORDS):
        return "openclaw", "desktop/automation action detected"

    # Creative requests — check before coding so "description" doesn't hit coder
    if any(kw in text for kw in CREATIVE_KEYWORDS):
        return config.MODEL_MAIN, "creative/general request"

    # Check coding keywords
    if words & CODING_KEYWORDS or any(kw in text for kw in CODING_KEYWORDS):
        return config.MODEL_CODER, "coding/technical keywords detected"

    # Check fast/lightweight keywords
    if words & FAST_KEYWORDS or any(kw in text for kw in FAST_KEYWORDS):
        return config.MODEL_FAST, "fast/simple request detected"

    # Check reasoning keywords
    if words & REASON_KEYWORDS or any(kw in text for kw in REASON_KEYWORDS):
        return config.MODEL_REASON, "reasoning/planning keywords detected"

    # Flagship model — used as default when enabled
    if config.FLAGSHIP_ENABLED:
        return config.MODEL_FLAGSHIP, "flagship model active"

    # Default: main assistant brain
    return config.MODEL_MAIN, "default assistant model"