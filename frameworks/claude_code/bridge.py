"""
frameworks/claude_code/bridge.py — Claude Code Bridge (Future)
Placeholder for calling Anthropic's Claude Code CLI externally.

Claude Code is Anthropic's coding agent CLI tool.
It runs as an external process — Nyx does not bundle it.

To use Claude Code when ready:
  1. Install it: npm install -g @anthropic-ai/claude-code
  2. Set ANTHROPIC_API_KEY in .env
  3. Implement call_claude_code() below

This bridge would let Nyx say:
  "Hey Claude Code, go fix the bug in tools/desktop/mouse.py"
  and pipe back the result.
"""

import subprocess
import config
from utils.logger import get_logger

log = get_logger(__name__)


def call_claude_code(prompt: str, working_dir: str = ".") -> str:
    """
    TODO: Call the Claude Code CLI with a prompt and return the output.

    Example implementation (when claude CLI is installed):
        result = subprocess.run(
            ["claude", "-p", prompt],
            cwd=working_dir,
            capture_output=True,
            text=True,
            timeout=120,
        )
        return result.stdout or result.stderr

    Args:
        prompt:      The coding task to hand off.
        working_dir: Directory context for Claude Code to work in.

    Returns:
        Claude Code's output as a string.
    """
    if not config.ANTHROPIC_API_KEY:
        return "[Nyx] ANTHROPIC_API_KEY not set. Add it to .env to use Claude Code."

    log.warning("Claude Code bridge called but not implemented yet.")
    return (
        "[Nyx] Claude Code bridge is a future feature.\n"
        "Install Claude Code CLI and implement this bridge in Phase 6+."
    )