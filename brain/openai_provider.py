"""
brain/openai_provider.py — OpenAI Cloud Provider (Future)
Placeholder. Wire this in when you want GPT-4o as a fallback.

To activate:
  1. Add OPENAI_API_KEY to .env
  2. pip install openai
  3. Implement ask() below
"""

import config
from utils.logger import get_logger

log = get_logger(__name__)


def ask(prompt: str, model: str = "gpt-4o-mini") -> str:
    """
    TODO: Send a prompt to OpenAI and return the response.

    Example implementation:
        from openai import OpenAI
        client = OpenAI(api_key=config.OPENAI_API_KEY)
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": config.NYX_SYSTEM_PROMPT},
                {"role": "user",   "content": prompt},
            ],
        )
        return response.choices[0].message.content
    """
    if not config.OPENAI_API_KEY:
        return "[Nyx] OpenAI provider not configured. Add OPENAI_API_KEY to .env"

    log.warning("OpenAI provider called but not implemented yet.")
    return "[Nyx] OpenAI provider coming soon."