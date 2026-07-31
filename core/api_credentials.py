"""
core/api_credentials.py — Safe, narrow API key storage.

Deliberately NOT general file/code editing. This only ever writes a single
whitelisted KEY=value line into .env for a provider in PROVIDERS below —
never arbitrary env vars, never application code. Adding a new provider
means adding a registry entry here, not opening up free-form writes.

Also applies the change live (os.environ + config module attribute) so a
key added mid-conversation works immediately, not just after a restart.
"""

import re
from pathlib import Path

import config
from utils.logger import get_logger

log = get_logger(__name__)

ROOT_DIR = Path(__file__).parent.parent
ENV_PATH = ROOT_DIR / ".env"

# Registry of API keys Nyx is allowed to set on request. Each entry maps a
# spoken provider name to the .env var it controls and which settings
# category (see app_settings.py's "api_priority" section) it belongs to.
PROVIDERS: dict[str, dict[str, str]] = {
    "tavily": {"env_var": "TAVILY_API_KEY", "category": "search"},
}

_KEY_LINE_RE = re.compile(r"^([A-Z0-9_]+)=(.*)$")


def _read_env_lines() -> list[str]:
    if ENV_PATH.exists():
        return ENV_PATH.read_text(encoding="utf-8").splitlines(keepends=False)
    return []


def _write_env_lines(lines: list[str]) -> None:
    ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def set_key(provider: str, key: str) -> str:
    """Write `key` for `provider` into .env (updating an existing line or
    appending a new one) and apply it live to the running process. Returns
    a user-facing confirmation or error string."""
    provider = provider.lower().strip()
    entry = PROVIDERS.get(provider)
    if entry is None:
        known = ", ".join(PROVIDERS)
        return f"[Nyx] I don't know a provider called '{provider}'. I can currently manage: {known}."

    key = key.strip()
    if not key or "\n" in key or "\r" in key:
        return "[Nyx] That doesn't look like a valid key."

    env_var = entry["env_var"]
    lines = _read_env_lines()
    replaced = False
    for i, line in enumerate(lines):
        m = _KEY_LINE_RE.match(line)
        if m and m.group(1) == env_var:
            lines[i] = f"{env_var}={key}"
            replaced = True
            break
    if not replaced:
        lines.append(f"{env_var}={key}")
    _write_env_lines(lines)

    # Apply live — .env is only re-read by dotenv at process start otherwise,
    # so without this the key wouldn't take effect until a manual restart.
    import os
    os.environ[env_var] = key
    setattr(config, env_var, key)

    log.info(f"[api_credentials] Set {env_var} for provider '{provider}' (applied live + saved to .env)")
    return f"[Nyx] Saved your {provider} API key — it's active now, no restart needed."


def is_configured(provider: str) -> bool:
    entry = PROVIDERS.get(provider.lower().strip())
    if entry is None:
        return False
    return bool(getattr(config, entry["env_var"], ""))


def get_masked_key(provider: str) -> str | None:
    """For display only — never the real key. 'tvly-••••••••dqN9' style,
    never returned in a form that could be reassembled into the real value."""
    entry = PROVIDERS.get(provider.lower().strip())
    if entry is None:
        return None
    key = getattr(config, entry["env_var"], "")
    if not key:
        return None
    if len(key) <= 8:
        return "•" * len(key)
    return f"{key[:4]}{'•' * 8}{key[-4:]}"


def remove_key(provider: str) -> str:
    """Clear a provider's key from .env and the running process — the
    "disconnect provider" action. Provider must already be in PROVIDERS;
    same whitelist as set_key, no arbitrary env var can be targeted."""
    provider = provider.lower().strip()
    entry = PROVIDERS.get(provider)
    if entry is None:
        known = ", ".join(PROVIDERS)
        return f"[Nyx] I don't know a provider called '{provider}'. I can currently manage: {known}."

    env_var = entry["env_var"]
    lines = _read_env_lines()
    for i, line in enumerate(lines):
        m = _KEY_LINE_RE.match(line)
        if m and m.group(1) == env_var:
            lines[i] = f"{env_var}="
            break
    _write_env_lines(lines)

    import os
    os.environ[env_var] = ""
    setattr(config, env_var, "")

    log.info(f"[api_credentials] Removed {env_var} for provider '{provider}'")
    return f"[Nyx] Disconnected your {provider} key."


def providers_in_category(category: str) -> list[str]:
    return [name for name, entry in PROVIDERS.items() if entry["category"] == category]
