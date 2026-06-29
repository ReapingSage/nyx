"""
tools/system/files.py — Safe File Operations
Only safe read operations for now.
Write/delete operations require explicit permission confirmation (Phase 7).
"""

import os
from utils.logger import get_logger
log = get_logger(__name__)


def read_file(path: str) -> str:
    """Read and return the contents of a text file."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        log.info(f"Read file: {path}")
        return content
    except FileNotFoundError:
        return f"[Nyx] File not found: {path}"
    except Exception as e:
        return f"[Nyx] Could not read file: {e}"


def list_dir(path: str = ".") -> str:
    """List files in a directory."""
    try:
        items = os.listdir(path)
        return "\n".join(sorted(items))
    except Exception as e:
        return f"[Nyx] Could not list directory: {e}"