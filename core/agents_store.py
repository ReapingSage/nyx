"""
core/agents_store.py — NYX Agents (The Forge → Agents)

Backs the Agents plugin: a living space where each deployed agent is a
character. V1 ships one real, working agent — OpenClaw — whose status is
live and whose assigned tasks actually run through NYX's OpenClaw pipeline
(brain/openclaw_provider), executing real desktop/web/file/system actions.

Data model is a persisted list of agents (memory/agents.json). Running
state + activity are tracked so the room's character can reflect what the
agent is genuinely doing right now (Idle vs. Working), not a fake loop.

Deploy/create is here too so more agents can be added later; V1 exposes the
OpenClaw one and leaves the door open.
"""

import json
import time
import uuid
from datetime import datetime
from pathlib import Path

from utils.logger import get_logger

log = get_logger(__name__)

ROOT_DIR = Path(__file__).parent.parent
AGENTS_PATH = ROOT_DIR / "memory" / "agents.json"

MAX_ACTIVITY = 40

# The built-in OpenClaw agent — the one real, working agent in V1.
# "OpenClaw is a tool all agents can use" — this agent IS the one wired to
# drive it directly, so assigning it a task runs real OpenClaw actions.
_OPENCLAW_AGENT = {
    "id": "openclaw",
    "name": "OpenClaw",
    "personality": "Curious Hacker",
    "avatar": "hooded",       # character style rendered by the frontend
    "accent": "#7B4DFF",
    "builtin": True,
    "engine": "openclaw",     # how assigned tasks are executed
    "tools": ["OpenClaw", "Desktop", "Web", "Files", "System"],
    "room_seed": 1,
    "created": None,
}

# In-memory: which agents are mid-task right now (drives the Working status).
_running: dict[str, dict] = {}   # agent_id -> {"task": str, "started": float}


# ── Persistence ───────────────────────────────────────────────────────

def _load() -> dict:
    if AGENTS_PATH.exists():
        try:
            data = json.loads(AGENTS_PATH.read_text(encoding="utf-8"))
            data.setdefault("agents", [])
            data.setdefault("activity", {})
            return data
        except (json.JSONDecodeError, OSError) as e:
            log.warning(f"[agents] Could not read store: {e}")
    # First run — seed the OpenClaw agent
    seed = {"agents": [dict(_OPENCLAW_AGENT, created=datetime.now().isoformat())], "activity": {}}
    _save(seed)
    return seed


def _save(data: dict) -> None:
    AGENTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    AGENTS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


# ── Status ────────────────────────────────────────────────────────────

def _status(agent_id: str) -> str:
    if agent_id in _running:
        return "Working"
    return "Idle"


def _model_for(agent: dict) -> str:
    if agent.get("engine") == "openclaw":
        try:
            from brain import openclaw_provider
            return openclaw_provider._ollama_model()
        except Exception:
            return "unknown"
    return "—"


def _decorate(agent: dict) -> dict:
    """Attach live/computed fields for the UI."""
    a = dict(agent)
    a["status"] = _status(agent["id"])
    a["model"] = _model_for(agent)
    a["current_task"] = _running.get(agent["id"], {}).get("task")
    return a


# ── Queries ───────────────────────────────────────────────────────────

def list_agents() -> list[dict]:
    return [_decorate(a) for a in _load()["agents"]]


def get_agent(agent_id: str) -> dict | None:
    a = next((x for x in _load()["agents"] if x["id"] == agent_id), None)
    return _decorate(a) if a else None


def get_activity(agent_id: str, limit: int = 15) -> list[dict]:
    return _load()["activity"].get(agent_id, [])[:limit]


def _log_activity(agent_id: str, kind: str, text: str) -> None:
    data = _load()
    entries = data["activity"].setdefault(agent_id, [])
    entries.insert(0, {"time": datetime.now().isoformat(), "kind": kind, "text": text[:300]})
    data["activity"][agent_id] = entries[:MAX_ACTIVITY]
    _save(data)


# ── Deploy / remove (future-facing; V1 keeps OpenClaw) ────────────────

def create_agent(name: str, personality: str = "Curious", model: str | None = None,
                 accent: str = "#7B4DFF", avatar: str = "hooded") -> dict:
    data = _load()
    agent = {
        "id": uuid.uuid4().hex[:10],
        "name": name.strip()[:40] or "Agent",
        "personality": personality,
        "avatar": avatar,
        "accent": accent,
        "builtin": False,
        "engine": "chat",           # future agents route through the model
        "model_pref": model,
        "tools": ["Chat", "Memory"],
        "room_seed": (len(data["agents"]) * 37 + 11) % 997,
        "created": datetime.now().isoformat(),
    }
    data["agents"].append(agent)
    _save(data)
    _log_activity(agent["id"], "system", "Agent deployed.")
    return _decorate(agent)


def delete_agent(agent_id: str) -> bool:
    data = _load()
    agent = next((a for a in data["agents"] if a["id"] == agent_id), None)
    if not agent or agent.get("builtin"):
        return False   # the built-in OpenClaw agent can't be removed
    data["agents"] = [a for a in data["agents"] if a["id"] != agent_id]
    data["activity"].pop(agent_id, None)
    _save(data)
    return True


def rename_agent(agent_id: str, name: str) -> dict | None:
    data = _load()
    for a in data["agents"]:
        if a["id"] == agent_id:
            a["name"] = name.strip()[:40] or a["name"]
            _save(data)
            return _decorate(a)
    return None


# ── Task execution — the "actually works" part ────────────────────────

def assign_task(agent_id: str, task: str) -> dict:
    """Run a task on an agent and return the real result.

    For the OpenClaw agent this dispatches through brain/openclaw_provider,
    which executes genuine actions (screenshots, opening apps, file ops,
    system queries, web) behind its existing safety guards. Blocking — the
    server calls this off the event loop.
    """
    agent = next((a for a in _load()["agents"] if a["id"] == agent_id), None)
    if not agent:
        return {"ok": False, "error": "Agent not found."}
    task = task.strip()
    if not task:
        return {"ok": False, "error": "Empty task."}

    _running[agent_id] = {"task": task, "started": time.time()}
    _log_activity(agent_id, "task", f"Assigned: {task}")
    try:
        if agent.get("engine") == "openclaw":
            from brain import openclaw_provider
            result, _ms = openclaw_provider.dispatch(task)
        else:
            from core.agent import NyxAgent
            result = NyxAgent().handle(task)
        result = result or "(no output)"
        _log_activity(agent_id, "result", result)
        return {"ok": True, "result": result}
    except Exception as e:
        log.error(f"[agents] Task failed for {agent_id}: {e}", exc_info=True)
        _log_activity(agent_id, "error", str(e))
        return {"ok": False, "error": str(e)}
    finally:
        _running.pop(agent_id, None)


def openclaw_online() -> bool:
    """Real reachability of the OpenClaw gateway (informational for the UI)."""
    try:
        from brain import openclaw_provider
        return openclaw_provider.status().get("online", False)
    except Exception:
        return False
