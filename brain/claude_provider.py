"""
brain/claude_provider.py — Anthropic Claude Provider (Future)
Placeholder. Wire this in when you want Claude as a fallback.

To activate:
  1. Add ANTHROPIC_API_KEY to .env
  2. pip install anthropic
  3. Implement ask() below
"""

import config
from utils.logger import get_logger

log = get_logger(__name__)


def ask(prompt: str, model: str = "claude-sonnet-4-5") -> str:
    """
    TODO: Send a prompt to Anthropic Claude and return the response.

    Example implementation:
        import anthropic
        client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
        message = client.messages.create(
            model=model,
            max_tokens=1024,
            system=config.NYX_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text
    """
    if not config.ANTHROPIC_API_KEY:
        return "[Nyx] Claude provider not configured. Add ANTHROPIC_API_KEY to .env"

    log.warning("Claude provider called but not implemented yet.")
    return "[Nyx] Claude provider coming soon."