"""
core/memory_rag.py — Retrieval-Augmented Vault Memory

Instead of injecting every Memory/*.md file into every conversation (which
gets slower and noisier as the vault grows), embed each note chunk once
with a local Ollama embedding model and inject only the chunks relevant to
the current message.

Degrades gracefully, in order:
  1. Vault is small (≤ MIN_CHUNKS_FOR_RAG chunks) → inject everything,
     retrieval would only lose information.
  2. Embedding model missing / Ollama down → inject everything (the old
     behavior), log a hint once.
  3. Otherwise → top-K chunks by cosine similarity.

Embeddings are cached in memory/vault_embeddings.json keyed by file mtime,
so unchanged files are never re-embedded.
"""

import json
import math
from pathlib import Path

import requests

import config
from core import vault_bridge
from utils.logger import get_logger

log = get_logger(__name__)

CACHE_PATH = Path(__file__).parent.parent / "memory" / "vault_embeddings.json"

TOP_K = 6
MIN_SCORE = 0.35            # below this the chunk is likely irrelevant
MIN_CHUNKS_FOR_RAG = 12     # small vaults: just inject everything

_warned_no_model = False


# ── Chunking ──────────────────────────────────────────────────────────

def _chunk_file(md_file: Path) -> list[str]:
    """One chunk per bullet point; non-bullet prose grouped per paragraph.
    Each chunk is prefixed with the file stem so 'Dark Mode' still carries
    its 'preferences' context after retrieval."""
    chunks = []
    try:
        text = md_file.read_text(encoding="utf-8-sig")
    except OSError as e:
        log.warning(f"[memory_rag] Could not read {md_file.name}: {e}")
        return []

    para: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith(("- ", "* ")):
            if para:
                chunks.append(" ".join(para)); para = []
            content = stripped[2:].strip()
            if len(content) >= 3:
                chunks.append(content)
        elif stripped and not stripped.startswith("#"):
            para.append(stripped)
        elif para:
            chunks.append(" ".join(para)); para = []
    if para:
        chunks.append(" ".join(para))

    stem = md_file.stem
    return [f"[{stem}] {c}"[:500] for c in chunks if len(c.strip()) >= 3]


# ── Embeddings ────────────────────────────────────────────────────────

def _embed(text: str) -> list[float] | None:
    try:
        r = requests.post(
            f"{config.OLLAMA_BASE_URL}/api/embeddings",
            json={"model": config.EMBED_MODEL, "prompt": text, "keep_alive": "30m"},
            timeout=20,
        )
        if r.status_code == 404:
            return None  # model not installed
        r.raise_for_status()
        vec = r.json().get("embedding")
        return vec if vec else None
    except requests.exceptions.RequestException:
        return None


def _load_cache() -> dict:
    if CACHE_PATH.exists():
        try:
            return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {"model": config.EMBED_MODEL, "files": {}}


def _save_cache(cache: dict) -> None:
    try:
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        CACHE_PATH.write_text(json.dumps(cache), encoding="utf-8")
    except OSError as e:
        log.warning(f"[memory_rag] Could not save embedding cache: {e}")


def _indexed_chunks() -> list[dict] | None:
    """Return [{text, vec}] for the whole vault, re-embedding only files
    whose mtime changed. None → embedding unavailable."""
    global _warned_no_model
    memory_dir = vault_bridge.get_memory_dir()
    if not memory_dir.exists():
        return []

    cache = _load_cache()
    if cache.get("model") != config.EMBED_MODEL:
        cache = {"model": config.EMBED_MODEL, "files": {}}

    current_files = {}
    changed = False
    for md_file in sorted(memory_dir.glob("*.md")):
        key = md_file.name
        mtime = md_file.stat().st_mtime
        entry = cache["files"].get(key)
        if entry and entry.get("mtime") == mtime:
            current_files[key] = entry
            continue

        chunks = _chunk_file(md_file)
        embedded = []
        for c in chunks:
            vec = _embed(c)
            if vec is None:
                if not _warned_no_model:
                    log.info(
                        f"[memory_rag] Embedding model '{config.EMBED_MODEL}' unavailable — "
                        f"falling back to full vault injection. (ollama pull {config.EMBED_MODEL})"
                    )
                    _warned_no_model = True
                return None
            embedded.append({"text": c, "vec": vec})
        current_files[key] = {"mtime": mtime, "chunks": embedded}
        changed = True

    if changed or set(cache["files"]) != set(current_files):
        cache["files"] = current_files
        _save_cache(cache)

    return [c for entry in current_files.values() for c in entry["chunks"]]


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0


# ── Public API ────────────────────────────────────────────────────────

def get_context(query: str) -> str:
    """Vault context block for this message — retrieved if the vault is big
    enough and embeddings work, otherwise the full vault (old behavior)."""
    chunks = _indexed_chunks()

    if chunks is None or len(chunks) <= MIN_CHUNKS_FOR_RAG:
        return vault_bridge.read_context()

    qvec = _embed(query)
    if qvec is None:
        return vault_bridge.read_context()

    scored = sorted(
        ((_cosine(qvec, c["vec"]), c["text"]) for c in chunks),
        key=lambda t: t[0],
        reverse=True,
    )
    top = [(s, t) for s, t in scored[:TOP_K] if s >= MIN_SCORE]
    if not top:
        return ""  # nothing relevant — don't stuff noise into the context

    lines = "\n".join(f"- {t}" for _, t in top)
    return f"## Vault Memory (most relevant notes)\n\n{lines}"
