"""
tools/coding/vscode_tools.py — VSCode Integration
Opens files and folders in VSCode from Nyx.
"""

import subprocess
from utils.logger import get_logger
log = get_logger(__name__)


def open_file(path: str) -> str:
    """Open a file in VSCode."""
    try:
        subprocess.Popen(["code", path])
        log.info(f"Opened in VSCode: {path}")
        return f"Opening {path} in VSCode..."
    except FileNotFoundError:
        return "[Nyx] VSCode CLI ('code') not found. Install it from VSCode: Ctrl+Shift+P → Shell Command."
    except Exception as e:
        return f"[Nyx] Could not open VSCode: {e}"


def open_folder(path: str = ".") -> str:
    """Open a folder in VSCode."""
    try:
        subprocess.Popen(["code", path])
        return f"Opening folder '{path}' in VSCode..."
    except FileNotFoundError:
        return "[Nyx] VSCode CLI not found."
    except Exception as e:
        return f"[Nyx] Error: {e}"