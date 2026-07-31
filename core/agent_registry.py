"""
core/agent_registry.py — Registry of Nyx's real specialized workers.

Static metadata (name, purpose, tools, which providers it can use) combined
with live status computed from actual system state — Ollama reachability,
whether a provider's key is configured, real health/cooldown state from
provider_router. Nothing here is fabricated; an agent with no meaningful
provider concept (Analyst, OpenClaw) is honestly represented as local-only
rather than padded out with invented integrations.

Backs the Agents dashboard (nyx_frontend AgentsPage.jsx) via the /api/workers
routes in ui/server.py.
"""

import importlib.util
import threading

import config
from core import api_credentials, provider_router
from utils.logger import get_logger

log = get_logger(__name__)

# Shared by Momus and Hemera below — both use tools/web/search.py, so both
# start with the same default order, even though each is tracked and can be
# reordered independently once running (see provider_router.get_priority).
_SEARCH_PROVIDERS = {
    "tavily": {"label": "Tavily Search API", "requires_key": True},
    "ddg": {"label": "DuckDuckGo (built-in)", "requires_key": False},
}

# Every agent here is real and already does something — see tools/web/*.py,
# brain/model_router.py, and frameworks/openclaw/. Adding a new agent means
# adding an entry here once it actually exists, not before.
AGENTS: dict[str, dict] = {
    "momus": {
        "name": "Momus",
        "purpose": (
            "Fact-checks claims: searches for corroborating sources, then has "
            "the reasoning model weigh the evidence and deliver a verdict "
            "(TRUE / FALSE / MIXED / UNVERIFIABLE) with citations."
        ),
        "tools": ["tools.web.search", "tools.web.factcheck"],
        "engine_kind": "search",
        "default_provider_order": ["tavily", "ddg"],
        "providers": _SEARCH_PROVIDERS,
    },
    "hemera": {
        "name": "Hemera",
        "purpose": (
            "Tracks what's currently trending on a topic: searches live "
            "sources, then has the reasoning model summarize the actual, "
            "current trends rather than answering from stale training data."
        ),
        "tools": ["tools.web.search", "tools.web.trends"],
        "engine_kind": "search",
        "default_provider_order": ["tavily", "ddg"],
        "providers": _SEARCH_PROVIDERS,
    },
    "analyst": {
        "name": "Analyst",
        "purpose": (
            "Handles analysis, planning, and reasoning-heavy requests — "
            "routed here by brain/model_router.py's REASON_KEYWORDS."
        ),
        "tools": ["brain.model_router", "brain.ollama_provider"],
        "engine_kind": "local-model",
        "default_provider_order": ["local"],
        "providers": {
            "local": {"label": "Local Ollama (reasoning model)", "requires_key": False},
        },
    },
    "openclaw": {
        "name": "OpenClaw",
        "purpose": "Desktop automation — mouse/keyboard control, screenshots, opening apps, window management.",
        "tools": ["frameworks.openclaw.claw", "frameworks.openclaw.actions"],
        "engine_kind": "automation",
        "default_provider_order": ["local"],
        "providers": {
            "local": {"label": "pyautogui (local)", "requires_key": False},
        },
    },
}


# Real "processing" state — set by agent.py's shortcut handlers around the
# actual call (see core/agent.py's Momus/Hemera blocks), not simulated.
# A status poll landing mid-request genuinely sees "processing".
_busy: set[str] = set()
_busy_lock = threading.Lock()


def mark_busy(agent_id: str) -> None:
    with _busy_lock:
        _busy.add(agent_id)


def mark_idle(agent_id: str) -> None:
    with _busy_lock:
        _busy.discard(agent_id)


def is_busy(agent_id: str) -> bool:
    with _busy_lock:
        return agent_id in _busy


def _ollama_reachable() -> bool:
    from core import model_manager
    return model_manager.is_ollama_running()


def _pyautogui_available() -> bool:
    # A lightweight presence check — not instantiating Claw(), which would
    # re-log "[claw] pyautogui ready." on every status poll for no reason.
    return importlib.util.find_spec("pyautogui") is not None


def _search_agent_runtime(agent_id: str) -> dict:
    """Momus and Hemera share the same underlying search machinery but are
    tracked independently — each can have its own provider priority/health."""
    meta = AGENTS[agent_id]
    order = provider_router.get_priority(agent_id, meta["default_provider_order"])
    ollama_up = _ollama_reachable()

    active_provider = "ddg"
    for p in order:
        if p == "tavily" and api_credentials.is_configured("tavily") and provider_router.is_healthy("tavily"):
            active_provider = "tavily"
            break
        if p == "ddg":
            active_provider = "ddg"
            break

    if is_busy(agent_id):
        status = "processing"
    elif not ollama_up:
        status = "unavailable"  # the reasoning-model step can't run
    else:
        status = "active"
    return {"status": status, "active_provider": active_provider, "ollama_reachable": ollama_up}


def _local_model_runtime(agent_id: str) -> dict:
    ollama_up = _ollama_reachable()
    if is_busy(agent_id):
        status = "processing"
    else:
        status = "active" if ollama_up else "unavailable"
    return {"status": status, "active_provider": "local", "ollama_reachable": ollama_up}


def _openclaw_runtime(agent_id: str) -> dict:
    available = _pyautogui_available()
    if is_busy(agent_id):
        status = "processing"
    else:
        status = "active" if available else "missing_configuration"
    return {"status": status, "active_provider": "local", "pyautogui_available": available}


def _runtime(agent_id: str) -> dict:
    if agent_id in ("momus", "hemera"):
        return _search_agent_runtime(agent_id)
    if agent_id == "analyst":
        return _local_model_runtime(agent_id)
    if agent_id == "openclaw":
        return _openclaw_runtime(agent_id)
    return {"status": "unavailable"}


def list_agent_ids() -> list[str]:
    return list(AGENTS)


def get_agent(agent_id: str) -> dict | None:
    meta = AGENTS.get(agent_id)
    if meta is None:
        return None

    order = provider_router.get_priority(agent_id, meta["default_provider_order"])
    providers = []
    for pname in order:
        pmeta = meta["providers"].get(pname)
        if pmeta is None:
            continue
        requires_key = pmeta["requires_key"]
        configured = (not requires_key) or api_credentials.is_configured(pname)
        health = provider_router.health_snapshot(pname) if requires_key else {
            "healthy": True, "consecutive_failures": 0, "retry_at": None,
        }
        providers.append({
            "id": pname,
            "label": pmeta["label"],
            "requires_key": requires_key,
            "configured": configured,
            "masked_key": api_credentials.get_masked_key(pname) if requires_key and configured else None,
            **health,
        })

    return {
        "id": agent_id,
        "name": meta["name"],
        "purpose": meta["purpose"],
        "tools": meta["tools"],
        "engine_kind": meta["engine_kind"],
        "provider_order": order,
        "default_provider_order": meta["default_provider_order"],
        "providers": providers,
        **_runtime(agent_id),
    }


def list_agents() -> list[dict]:
    return [get_agent(aid) for aid in AGENTS]
