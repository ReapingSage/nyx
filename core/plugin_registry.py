"""
core/plugin_registry.py — NYX Plugin System (SageTech MarketPlace)

NYX is a lean core; every optional capability is an installable plugin.
This module:
  - fetches the plugin catalog from the SageTech MarketPlace repo (raw URL),
    falling back to a bundled copy when offline
  - tracks which plugins are installed (memory/plugins.json)
  - installs a plugin: pip-installs its Python deps (streamed), marks it
    installed, and reports whether a restart is needed to finish
  - uninstalls: marks it disabled (deps are left in place — cheap to keep,
    risky to auto-remove shared packages)

Version A: plugins are first-party and ship bundled with NYX, so "install"
means enable + deps + reveal sidebar. The catalog schema already carries the
fields (source/download_url/version) for Version B remote plugins.

Other modules ask is_installed("music") to gate their features/routes.
"""

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

import requests

from utils.logger import get_logger

log = get_logger(__name__)

ROOT_DIR = Path(__file__).parent.parent
STATE_PATH = ROOT_DIR / "memory" / "plugins.json"
BUNDLED_CATALOG = ROOT_DIR / "core" / "marketplace_catalog.json"

CATALOG_URL = "https://raw.githubusercontent.com/ReapingSage/sagetech-marketplace/main/marketplace.json"

# Plugins that are part of NYX's permanent core and can't be uninstalled.
# (None yet — everything optional is a real plugin. Kept for clarity/future.)
CORE_LOCKED: set[str] = set()

def _first_run_seed() -> dict:
    """On the very first run, preserve features an existing setup already used
    (so introducing the plugin gate doesn't make anything vanish), while a
    genuinely fresh install starts lean with nothing pre-installed.
    Heuristic: if the Music library file exists, Music was already in use."""
    installed = {}
    if (ROOT_DIR / "memory" / "music_library.json").exists():
        installed["music"] = {"installed_at": datetime.now().isoformat(), "version": None}
    return {"installed": installed}


# ── Catalog ───────────────────────────────────────────────────────────

def get_catalog() -> dict:
    """Live catalog from the SageTech repo, or the bundled copy if offline."""
    try:
        r = requests.get(CATALOG_URL, timeout=5)
        r.raise_for_status()
        data = r.json()
        if data.get("plugins") is not None:
            return data
    except Exception as e:
        log.info(f"[plugins] Using bundled catalog (remote fetch failed: {e})")
    try:
        return json.loads(BUNDLED_CATALOG.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        log.warning(f"[plugins] Bundled catalog unreadable: {e}")
        return {"marketplace": "SageTech MarketPlace", "plugins": []}


def get_plugin(plugin_id: str) -> dict | None:
    return next((p for p in get_catalog().get("plugins", []) if p["id"] == plugin_id), None)


# ── Install state ─────────────────────────────────────────────────────

def _load_state() -> dict:
    if STATE_PATH.exists():
        try:
            data = json.loads(STATE_PATH.read_text(encoding="utf-8"))
            data.setdefault("installed", {})
            return data
        except (json.JSONDecodeError, OSError) as e:
            log.warning(f"[plugins] Could not read state: {e}")
    seed = _first_run_seed()
    _save_state(seed)
    return seed


def _save_state(state: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")


def installed_ids() -> set[str]:
    return set(_load_state()["installed"].keys())


def is_installed(plugin_id: str) -> bool:
    return plugin_id in _load_state()["installed"]


def _mark_installed(plugin_id: str, version: str | None) -> None:
    state = _load_state()
    state["installed"][plugin_id] = {
        "installed_at": datetime.now().isoformat(),
        "version": version,
    }
    _save_state(state)


def _mark_uninstalled(plugin_id: str) -> None:
    state = _load_state()
    state["installed"].pop(plugin_id, None)
    _save_state(state)


# ── Listing (catalog + state merged, for the store UI) ────────────────

def list_plugins() -> list[dict]:
    inst = _load_state()["installed"]
    out = []
    for p in get_catalog().get("plugins", []):
        entry = dict(p)
        entry["installed"] = p["id"] in inst
        entry["locked"] = p["id"] in CORE_LOCKED
        out.append(entry)
    return out


# ── Dependency check / install ────────────────────────────────────────

def _dep_missing(pkg: str) -> bool:
    import importlib.util
    # Distribution name may differ from import name; check both simply.
    mod = pkg.split("[")[0].replace("-", "_")
    try:
        return importlib.util.find_spec(mod) is None
    except (ImportError, ValueError):
        return True


def install_stream(plugin_id: str):
    """Generator yielding progress dicts while installing a plugin.
    Each item: {"status": str, "pct": int, "done": bool, ...}."""
    plugin = get_plugin(plugin_id)
    if not plugin:
        yield {"status": f"Unknown plugin '{plugin_id}'.", "pct": 100, "done": True, "error": True}
        return

    if is_installed(plugin_id):
        yield {"status": "Already installed.", "pct": 100, "done": True}
        return

    deps = plugin.get("python_deps", [])
    missing = [d for d in deps if _dep_missing(d)]

    yield {"status": f"Installing {plugin['name']}…", "pct": 5, "done": False}

    if missing:
        yield {"status": f"Fetching dependencies: {', '.join(missing)}", "pct": 20, "done": False}
        try:
            proc = subprocess.run(
                [sys.executable, "-m", "pip", "install", "--disable-pip-version-check", *missing],
                capture_output=True, text=True, timeout=600,
            )
            if proc.returncode != 0:
                tail = (proc.stderr or proc.stdout).strip().splitlines()[-1:] or ["pip failed"]
                yield {"status": f"Dependency install failed: {tail[0]}", "pct": 100, "done": True, "error": True}
                return
        except subprocess.TimeoutExpired:
            yield {"status": "Dependency install timed out.", "pct": 100, "done": True, "error": True}
            return
        yield {"status": "Dependencies ready.", "pct": 80, "done": False}
    else:
        yield {"status": "Dependencies already present.", "pct": 80, "done": False}

    _mark_installed(plugin_id, plugin.get("version"))
    log.info(f"[plugins] Installed: {plugin_id}")

    yield {
        "status": "Installed." + (" Restart NYX to finish." if plugin.get("requires_restart") else ""),
        "pct": 100,
        "done": True,
        "requires_restart": bool(plugin.get("requires_restart")),
        "sidebar": plugin.get("sidebar"),
    }


def uninstall(plugin_id: str) -> dict:
    plugin = get_plugin(plugin_id)
    if plugin_id in CORE_LOCKED:
        return {"ok": False, "message": "This is a core component and can't be removed."}
    if not is_installed(plugin_id):
        return {"ok": False, "message": "Not installed."}
    _mark_uninstalled(plugin_id)
    log.info(f"[plugins] Uninstalled: {plugin_id}")
    return {
        "ok": True,
        "requires_restart": bool(plugin and plugin.get("requires_restart")),
        "message": "Removed." + (" Restart NYX to finish." if plugin and plugin.get("requires_restart") else ""),
    }
