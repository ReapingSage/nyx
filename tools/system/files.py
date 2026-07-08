"""
tools/system/files.py — File Operations (Phase 7)

Read operations are unrestricted. Write/move/delete are restricted to the
user's home directory, deletes go to the Recycle Bin (send2trash), and the
chat layer requires a spoken confirmation before delete/move runs
(brain/openclaw_provider.py pending-action flow).
"""

import os
import shutil
from pathlib import Path

from utils.logger import get_logger

log = get_logger(__name__)

HOME = Path.home()


def _resolve(path: str) -> Path:
    """Expand ~ and make bare names land in the user's home folder."""
    p = Path(path.strip().strip('"').strip("'")).expanduser()
    if not p.is_absolute():
        p = HOME / p
    return p.resolve()


def _guard(path: str) -> tuple[Path | None, str | None]:
    """Resolve and require the target to be inside the home directory."""
    try:
        p = _resolve(path)
    except (OSError, ValueError) as e:
        return None, f"[Nyx] Bad path '{path}': {e}"
    if p != HOME and HOME not in p.parents:
        return None, (
            f"[Nyx] I only write inside your user folder ({HOME}) — "
            f"'{p}' is outside it."
        )
    return p, None


# ── Read (unrestricted) ───────────────────────────────────────────────

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


# ── Write (home-directory only) ───────────────────────────────────────

def create_file(path: str, content: str = "") -> str:
    p, err = _guard(path)
    if err:
        return err
    if p.exists():
        return (
            f"[Nyx] '{p}' already exists — I won't overwrite it. "
            f"Say: append to file {p.name}: <your text>"
        )
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        log.info(f"[files] Created: {p}")
        return f"Created {p}."
    except Exception as e:
        return f"[Nyx] Could not create file: {e}"


def append_file(path: str, content: str) -> str:
    p, err = _guard(path)
    if err:
        return err
    if p.exists() and not p.is_file():
        return f"[Nyx] '{p}' isn't a file."
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        with p.open("a", encoding="utf-8") as f:
            f.write(content)
        return f"Appended to {p}."
    except Exception as e:
        return f"[Nyx] Could not append: {e}"


def create_folder(path: str) -> str:
    p, err = _guard(path)
    if err:
        return err
    if p.exists():
        return f"[Nyx] '{p}' already exists."
    try:
        p.mkdir(parents=True)
        log.info(f"[files] Folder created: {p}")
        return f"Created folder {p}."
    except Exception as e:
        return f"[Nyx] Could not create folder: {e}"


def move_file(src: str, dst: str) -> str:
    s, err = _guard(src)
    if err:
        return err
    d, err = _guard(dst)
    if err:
        return err
    if not s.exists():
        return f"[Nyx] '{s}' doesn't exist."
    try:
        if d.is_dir():
            d = d / s.name
        if d.exists():
            return f"[Nyx] '{d}' already exists — I won't overwrite it."
        d.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(s), str(d))
        log.info(f"[files] Moved: {s} -> {d}")
        return f"Moved {s.name} to {d}."
    except Exception as e:
        return f"[Nyx] Could not move: {e}"


def delete_file(path: str) -> str:
    """Send a file or folder to the Recycle Bin — never a permanent delete."""
    p, err = _guard(path)
    if err:
        return err
    if not p.exists():
        return f"[Nyx] '{p}' doesn't exist."
    if p == HOME:
        return "[Nyx] Not deleting your entire home folder."
    try:
        from send2trash import send2trash
    except ImportError:
        return "[Nyx] Deletion needs send2trash (pip install send2trash) so files go to the Recycle Bin."
    try:
        send2trash(str(p))
        log.info(f"[files] Recycled: {p}")
        return f"Sent {p.name} to the Recycle Bin (recoverable from there)."
    except Exception as e:
        return f"[Nyx] Could not delete: {e}"
