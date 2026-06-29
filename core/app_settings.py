"""
core/app_settings.py — Unified App Settings Store

Single JSON file backing the simple persisted-preference Settings
categories: Voice, Notifications, Privacy, Automation, Experimental.
Centralizing these avoids five nearly-identical config modules — each
section's schema is independent, only the load/save plumbing is shared.

Other modules should call get_section()/update_section() rather than
reading the JSON file directly, so defaults stay consistent everywhere.
"""

import json
from pathlib import Path

from utils.logger import get_logger

log = get_logger(__name__)

SETTINGS_PATH = Path(__file__).parent.parent / "memory" / "app_settings.json"

DEFAULTS = {
    "voice": {
        "enabled": False,
        "wake_word": "nyx",
        "voice_mode": "push_to_talk",
        "tts_voice": "en-GB-SoniaNeural",
    },
    "notifications": {
        "enabled": True,
        "task_complete": True,
        "errors": True,
        "voice_wake": False,
    },
    "privacy": {
        "block_dangerous_actions": False,  # False = warn only, True = hard block
    },
    "automation": {
        "openclaw_enabled": True,
        "confirm_before_actions": True,
    },
    "experimental": {
        "flagship_model_enabled": False,
    },
}


def load() -> dict:
    if SETTINGS_PATH.exists():
        try:
            data = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
            return {section: {**defaults, **data.get(section, {})} for section, defaults in DEFAULTS.items()}
        except (json.JSONDecodeError, OSError) as e:
            log.warning(f"[app_settings] Could not read settings, using defaults: {e}")
    return {section: dict(values) for section, values in DEFAULTS.items()}


def save(data: dict) -> None:
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


def get_section(name: str) -> dict:
    if name not in DEFAULTS:
        raise ValueError(f"Unknown settings section '{name}'. Valid: {list(DEFAULTS)}")
    return load().get(name, dict(DEFAULTS[name]))


def update_section(name: str, updates: dict) -> dict:
    if name not in DEFAULTS:
        raise ValueError(f"Unknown settings section '{name}'. Valid: {list(DEFAULTS)}")
    data = load()
    data[name].update(updates)
    save(data)
    log.info(f"[app_settings] Updated section '{name}': {updates}")
    return data[name]
