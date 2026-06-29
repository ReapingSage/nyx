"""
core/storage_provider.py — Storage / Memory Provider System

NYX's memory notes (Memory/*.md, Logs/*.md) can live in one of several
places. This module is the single source of truth for which one is active
right now, so the rest of the app never hardcodes a path.

Built as a small provider registry (not a single hardcoded path) so more
storage backends can be added later without touching callers — they only
ever ask this module "where's the active vault?".

Safety notes for the Obsidian provider:
  - We only ever read/write inside <vault>/Memory and <vault>/Logs.
    Nothing else in the user's vault is touched.
  - Connecting requires the folder to already exist — we never silently
    create a brand-new folder somewhere on disk from a typo'd path.
  - A missing .obsidian/ config is reported as informational only; it
    does not block connecting (a brand-new vault won't have it yet).
"""

import json
import os
import platform
from pathlib import Path

from utils.logger import get_logger

log = get_logger(__name__)

ROOT_DIR = Path(__file__).parent.parent
DEFAULT_VAULT_PATH = ROOT_DIR / "NYX_VAULT"
CONFIG_PATH = ROOT_DIR / "memory" / "storage_config.json"

PROVIDERS = {
    "nyx_local": {
        "id": "nyx_local",
        "name": "NYX Local Storage",
        "description": "NYX creates and manages its own memory/storage folder automatically. No setup required.",
        "requires_path": False,
    },
    "obsidian": {
        "id": "obsidian",
        "name": "Obsidian",
        "description": "Connect an existing Obsidian vault. NYX reads/writes only its own Memory and Logs notes inside it.",
        "requires_path": True,
    },
}


def _default_config() -> dict:
    return {"provider": "nyx_local", "obsidian_path": None}


def load_config() -> dict:
    if CONFIG_PATH.exists():
        try:
            data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            return {**_default_config(), **data}
        except (json.JSONDecodeError, OSError) as e:
            log.warning(f"[storage_provider] Could not read config: {e}")
    return _default_config()


def save_config(config: dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(config, indent=2), encoding="utf-8")


def is_obsidian_installed() -> bool:
    """Best-effort detection only — NYX works fine either way, this is just for UI messaging."""
    system = platform.system()
    try:
        if system == "Windows":
            candidates = [Path(os.environ.get("LOCALAPPDATA", "")) / "Obsidian" / "Obsidian.exe"]
        elif system == "Darwin":
            candidates = [Path("/Applications/Obsidian.app")]
        else:
            candidates = [Path.home() / ".config" / "obsidian", Path("/usr/bin/obsidian")]
        return any(c.exists() for c in candidates)
    except OSError:
        return False


def check_path(path_str: str) -> dict:
    """Validate a candidate Obsidian vault path without connecting to it."""
    if not path_str:
        return {"path": path_str, "exists": False, "is_dir": False, "is_obsidian_vault": False}

    p = Path(path_str).expanduser()
    exists = p.exists()
    is_dir = exists and p.is_dir()
    has_obsidian_config = is_dir and (p / ".obsidian").exists()

    return {
        "path": str(p),
        "exists": exists,
        "is_dir": is_dir,
        "is_obsidian_vault": has_obsidian_config,
    }


def get_active_vault_path() -> Path:
    """Resolve the vault path to actually use right now, with a safe fallback."""
    config = load_config()

    if config.get("provider") == "obsidian" and config.get("obsidian_path"):
        p = Path(config["obsidian_path"]).expanduser()
        if p.exists() and p.is_dir():
            return p
        log.warning(f"[storage_provider] Configured Obsidian path missing, falling back to local storage: {p}")

    return DEFAULT_VAULT_PATH


def get_status() -> dict:
    config = load_config()
    active = config.get("provider", "nyx_local")
    obsidian_path = config.get("obsidian_path")

    return {
        "active_provider": active,
        "providers": list(PROVIDERS.values()),
        "active_vault_path": str(get_active_vault_path()),
        "obsidian_path": obsidian_path,
        "obsidian_path_check": check_path(obsidian_path) if obsidian_path else None,
        "obsidian_installed": is_obsidian_installed(),
    }


def set_provider(provider_id: str, obsidian_path: str | None = None) -> dict:
    if provider_id not in PROVIDERS:
        raise ValueError(f"Unknown storage provider '{provider_id}'. Valid options: {list(PROVIDERS)}")

    config = load_config()

    if provider_id == "obsidian":
        if not obsidian_path:
            raise ValueError("obsidian_path is required to select the Obsidian provider.")
        result = check_path(obsidian_path)
        if not result["is_dir"]:
            raise ValueError(
                f"'{obsidian_path}' doesn't exist or isn't a folder. "
                "Point this at an existing Obsidian vault folder."
            )
        config["obsidian_path"] = str(Path(obsidian_path).expanduser())

    config["provider"] = provider_id
    save_config(config)
    log.info(f"[storage_provider] Active provider set to '{provider_id}'")
    return get_status()
