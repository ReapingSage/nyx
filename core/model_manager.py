"""
core/model_manager.py — Ollama Model Manager
Detects Ollama, lists/categorizes installed models, assigns them to
roles (coding / main / fast), and pulls new models with live progress.

Uses Ollama's HTTP API directly (not the `ollama` CLI) so it works the
same whether or not `ollama` is on PATH — only the daemon needs to be
running at config.OLLAMA_BASE_URL.
"""

import json
import shutil
from pathlib import Path

import requests

import config
from utils.logger import get_logger

log = get_logger(__name__)

OLLAMA_INSTALL_URL = "https://ollama.com/download"

ASSIGNMENTS_PATH = Path(__file__).parent.parent / "memory" / "model_assignments.json"

ROLES = ("coding", "main", "fast")

# ── Categorization ────────────────────────────────────────
CODING_KEYWORDS = ("coder", "starcoder", "codellama")
FAST_KEYWORDS = ("phi", "tiny", "mini")
FAST_SIZE_TAGS = (":1b", ":2b", ":3b")
MAIN_KEYWORDS = ("llama", "mistral", "gemma", "qwen")

RECOMMENDED_MODELS = {
    "laptop": [
        {"name": "qwen2.5-coder:3b", "role": "coding"},
        {"name": "llama3.2:3b", "role": "main"},
        {"name": "phi3", "role": "fast"},
    ],
    "desktop": [
        {"name": "qwen2.5-coder:7b", "role": "coding"},
        {"name": "llama3.1:8b", "role": "main"},
    ],
}


def categorize_model_name(name: str) -> str:
    """Bucket a model name into 'coding', 'fast', or 'main'."""
    n = name.lower()
    if any(k in n for k in CODING_KEYWORDS):
        return "coding"
    if any(k in n for k in FAST_KEYWORDS) or any(t in n for t in FAST_SIZE_TAGS):
        return "fast"
    if any(k in n for k in MAIN_KEYWORDS):
        return "main"
    return "main"


# ── Ollama detection ───────────────────────────────────────

def find_ollama_binary() -> str | None:
    return shutil.which("ollama")


def is_ollama_running() -> bool:
    try:
        r = requests.get(f"{config.OLLAMA_BASE_URL}/api/tags", timeout=2)
        return r.status_code == 200
    except requests.exceptions.RequestException:
        return False


def get_ollama_status() -> dict:
    binary = find_ollama_binary()
    running = is_ollama_running()
    return {
        "installed": bool(binary) or running,
        "running": running,
        "binary_path": binary,
        "base_url": config.OLLAMA_BASE_URL,
        "install_url": OLLAMA_INSTALL_URL,
    }


# ── Listing models ─────────────────────────────────────────

def list_installed_models() -> list[dict]:
    """Equivalent to `ollama list`, via the HTTP API."""
    try:
        r = requests.get(f"{config.OLLAMA_BASE_URL}/api/tags", timeout=5)
        r.raise_for_status()
        return r.json().get("models", [])
    except requests.exceptions.RequestException as e:
        log.warning(f"[model_manager] Could not list models: {e}")
        return []


def get_profile() -> str:
    """Return 'laptop' when running the lite config (3b-class models), else 'desktop'."""
    m = config.MODEL_MAIN.lower()
    if any(t in m for t in (":1b", ":2b", ":3b")):
        return "laptop"
    return "desktop"


def missing_recommended(profile: str = "desktop") -> list[dict]:
    installed_names = {m["name"] for m in list_installed_models()}
    recs = RECOMMENDED_MODELS.get(profile, [])
    return [r for r in recs if r["name"] not in installed_names]


# ── Role assignment ────────────────────────────────────────

def load_assignments() -> dict:
    if ASSIGNMENTS_PATH.exists():
        try:
            return json.loads(ASSIGNMENTS_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            log.warning(f"[model_manager] Could not read assignments: {e}")
    return {}


def save_assignments(assignments: dict) -> None:
    ASSIGNMENTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    ASSIGNMENTS_PATH.write_text(json.dumps(assignments, indent=2), encoding="utf-8")


def auto_assign_roles(installed_names: list[str]) -> dict:
    """Pick a default model per role. If only one model exists, it fills every role."""
    if not installed_names:
        return {role: None for role in ROLES}

    if len(installed_names) == 1:
        only = installed_names[0]
        return {role: only for role in ROLES}

    buckets: dict[str, list[str]] = {role: [] for role in ROLES}
    for name in installed_names:
        buckets[categorize_model_name(name)].append(name)

    assignment = {role: (models[0] if models else None) for role, models in buckets.items()}

    fallback = installed_names[0]
    for role in ROLES:
        if assignment[role] is None:
            assignment[role] = fallback

    return assignment


def get_role_assignments() -> dict:
    """Manual overrides win when the chosen model is still installed; otherwise auto-assign."""
    installed = [m["name"] for m in list_installed_models()]
    merged = auto_assign_roles(installed)

    manual = load_assignments()
    for role, model_name in manual.items():
        if role in merged and model_name in installed:
            merged[role] = model_name

    return merged


def set_role_assignment(role: str, model_name: str) -> dict:
    if role not in ROLES:
        raise ValueError(f"Unknown role '{role}'. Must be one of {ROLES}.")

    assignments = load_assignments()
    assignments[role] = model_name
    save_assignments(assignments)
    return get_role_assignments()


# ── Pulling / removing models ──────────────────────────────

def pull_model(name: str):
    """
    Generator yielding Ollama's own progress JSON objects while pulling a model.
    Each item looks like {"status": "...", "total": int, "completed": int}.
    """
    url = f"{config.OLLAMA_BASE_URL}/api/pull"

    with requests.post(url, json={"name": name, "stream": True}, stream=True, timeout=None) as resp:
        resp.raise_for_status()
        for line in resp.iter_lines():
            if not line:
                continue
            yield json.loads(line.decode("utf-8"))


def delete_model(name: str) -> bool:
    try:
        r = requests.delete(f"{config.OLLAMA_BASE_URL}/api/delete", json={"name": name}, timeout=30)
        return r.status_code == 200
    except requests.exceptions.RequestException as e:
        log.warning(f"[model_manager] Could not delete model '{name}': {e}")
        return False
