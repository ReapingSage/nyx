"""
core/provider_router.py — Generic provider health/priority/fallback routing.

Shared by any agent backed by more than one provider (currently Momus and
Hemera, both via tools.web.search). Extends core/api_credentials.py (which
owns *storing* keys) with *runtime routing*: per-agent priority order and
provider health tracking with cooldown-based automatic recovery.

In-memory only, synchronous, no queue — matches how the rest of Nyx's tool
layer works (a chat request is one blocking call, not a job system). Health
state resets on backend restart, which is fine: a fresh start re-earns
trust in a provider rather than carrying a stale failure forward forever.
"""

import time
from threading import Lock

from core import app_settings
from utils.logger import get_logger

log = get_logger(__name__)

COOLDOWN_SECONDS = 300          # 5 min before a failed provider is retried
MAX_COOLDOWN_SECONDS = 3600     # exponential backoff caps at 1h

_lock = Lock()
_health: dict[str, dict] = {}   # provider -> {"unhealthy_until": float|None, "consecutive_failures": int}


def _entry(provider: str) -> dict:
    return _health.setdefault(provider, {"unhealthy_until": None, "consecutive_failures": 0})


def is_healthy(provider: str) -> bool:
    with _lock:
        until = _entry(provider)["unhealthy_until"]
        return until is None or time.time() >= until


def mark_failure(provider: str) -> None:
    """Never logs the failure detail here — callers log their own error
    message; this only ever sees the provider name, never a key or payload."""
    with _lock:
        e = _entry(provider)
        e["consecutive_failures"] += 1
        cooldown = min(COOLDOWN_SECONDS * (2 ** (e["consecutive_failures"] - 1)), MAX_COOLDOWN_SECONDS)
        e["unhealthy_until"] = time.time() + cooldown
        log.warning(
            f"[provider_router] '{provider}' unhealthy for {cooldown:.0f}s "
            f"(failure #{e['consecutive_failures']})"
        )


def mark_success(provider: str) -> None:
    with _lock:
        e = _entry(provider)
        if e["consecutive_failures"] or e["unhealthy_until"]:
            log.info(f"[provider_router] '{provider}' recovered — clearing unhealthy state")
        e["consecutive_failures"] = 0
        e["unhealthy_until"] = None


def health_snapshot(provider: str) -> dict:
    """Read-only view for the UI — provider name and timing only, never key material."""
    with _lock:
        e = _entry(provider)
        healthy = e["unhealthy_until"] is None or time.time() >= e["unhealthy_until"]
        return {
            "healthy": healthy,
            "consecutive_failures": e["consecutive_failures"],
            "retry_at": e["unhealthy_until"] if not healthy else None,
        }


def get_priority(agent_id: str, default_order: list[str]) -> list[str]:
    """Per-agent provider order — each agent (e.g. Momus vs Hemera) can be
    reordered independently even though they may share underlying tools."""
    priority = app_settings.get_section("api_priority")
    order = priority.get(agent_id, list(default_order))
    # Defensive: if a custom order somehow dropped a known provider, keep it
    # reachable by appending it at the end rather than hiding it silently.
    for p in default_order:
        if p not in order:
            order.append(p)
    return order


def set_priority(agent_id: str, order: list[str]) -> None:
    app_settings.update_section("api_priority", {agent_id: order})
