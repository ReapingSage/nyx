"""
brain/model_router.py — Task-to-Model Router
Reads the user's message and decides which local model to use.
Routing is keyword-based for now. Replace with a classifier later.
"""

import re

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
    # Named OpenClaw actions (frameworks/openclaw) — without these here the
    # router never sends their trigger phrases to the OpenClaw layer at all,
    # so the actions were unreachable from chat.
    "ixl", "imagine learning", "edgenuity", "log into imagine", "login imagine",
    "sign into imagine",
    "open vscode", "open vs code", "open visual studio code",
    "open cmd", "open command prompt",
    "close browser",
    "volume up", "volume down", "mute", "unmute", "louder", "quieter",
    # Media playback (tools/system/media.py)
    "play music", "pause music", "pause the music", "resume music",
    "pause the song", "pause playback", "resume playback", "play pause",
    "next song", "next track", "previous song", "previous track",
    "skip song", "skip track",
    # Keyboard/mouse (tools/desktop) — phrases, not bare words, so normal
    # sentences containing "type"/"press" don't get hijacked
    "type out", "write out", "press enter", "press tab", "press escape",
    "press ctrl", "press alt", "press shift", "press the", "hit enter",
    "scroll", "scroll up", "scroll down", "drag", "drop",
    # File operations (tools/system/files.py)
    "create a file", "create file", "new file", "create a folder",
    "make a folder", "new folder", "delete file", "delete the file",
    "delete folder", "delete the folder",
    "append to file", "append to the file", "to file",
    # Process manager (tools/system/processes.py)
    "top processes", "using my cpu", "eating my cpu", "using my ram",
    "eating my ram", "using my memory", "end process", "terminate process",
    "automate", "automation", "desktop task",
    # Opera GX + Discord + monitor control
    "opera gx", "open opera", "launch opera", "new tab in opera", "open in opera",
    "open discord", "launch discord", "close discord",
    "second monitor", "monitor 2", "move to monitor", "put on monitor",
}


def _matches(words: set[str], text: str, keywords: set[str]) -> bool:
    """Single-word keywords must match a whole word ('api' shouldn't fire on
    'rapid', 'fix' shouldn't fire on 'prefix'); multi-word phrases match as
    substrings of the full text."""
    for kw in keywords:
        if " " in kw:
            if kw in text:
                return True
        elif kw in words:
            return True
    return False


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
    words = set(re.findall(r"[a-z0-9+#]+", text))

    from core import app_settings
    from core import model_manager

    # One settings read per message — get_section() re-reads the JSON file
    # on every call, and route() runs for every single chat message.
    settings = app_settings.load()
    automation_enabled = settings.get("automation", {}).get("openclaw_enabled", True)

    # Manual Model Manager role assignments override the config.py defaults —
    # reassigning a role in the UI must actually change routing, not just the
    # label shown on the Models page.
    manual = model_manager.load_assignments()
    model_main  = manual.get("main")   or config.MODEL_MAIN
    model_coder = manual.get("coding") or config.MODEL_CODER
    model_fast  = manual.get("fast")   or config.MODEL_FAST

    # Check desktop/automation keywords — route to OpenClaw layer
    if _matches(words, text, DESKTOP_KEYWORDS):
        if automation_enabled:
            return "openclaw", "desktop/automation action detected"
        return model_main, "desktop action detected but automation is disabled in Settings"

    # Creative requests — check before coding so "description" doesn't hit coder
    if _matches(words, text, CREATIVE_KEYWORDS):
        return model_main, "creative/general request"

    # Check coding keywords
    if _matches(words, text, CODING_KEYWORDS):
        return model_coder, "coding/technical keywords detected"

    # Check fast/lightweight keywords
    if _matches(words, text, FAST_KEYWORDS):
        return model_fast, "fast/simple request detected"

    # Check reasoning keywords
    if _matches(words, text, REASON_KEYWORDS):
        return config.MODEL_REASON, "reasoning/planning keywords detected"

    # Flagship model — config.py sets the build-time default; the
    # Experimental settings toggle overrides it at runtime.
    flagship_enabled = settings.get("experimental", {}).get(
        "flagship_model_enabled", config.FLAGSHIP_ENABLED
    )
    if flagship_enabled:
        return config.MODEL_FLAGSHIP, "flagship model active"

    # Default: main assistant brain
    return model_main, "default assistant model"