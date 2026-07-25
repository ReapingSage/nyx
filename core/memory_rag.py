"""
core/memory_rag.py — Retrieval-Augmented Memory

Instead of injecting every Memory/*.md file into every conversation (which
gets slower and noisier as the vault grows), embed each note chunk once
with a local Ollama embedding model and inject only the chunks relevant to
the current message.

Two sources feed the same embedding index, previously disconnected:
  - Vault Memory/*.md files (chunked per bullet/paragraph)
  - Constellation nodes (core/constellation_manager.py) — the graph the
    Constellation page visualizes, now actually searchable/retrievable
    instead of being a keyword-tagged graph with no semantic layer.

Degrades gracefully, in order:
  1. Combined corpus is small (≤ MIN_CHUNKS_FOR_RAG chunks) → inject
     everything, retrieval would only lose information.
  2. Embedding model missing / Ollama down → inject everything (the old
     behavior), log a hint once.
  3. Otherwise → top-K chunks by cosine similarity.

Embeddings are cached in memory/vault_embeddings.json (vault chunks, keyed
by file mtime) and memory/constellation_embeddings.json (node chunks, keyed
by a content hash so an edited node re-embeds but an untouched one doesn't).
No vector DB — brute-force cosine over a flat cache, which is honestly
appropriate at current scale (see the file's own docstring reasoning); this
does not scale to a large corpus and that's a known, named limitation, not
a hidden one.
"""

import hashlib
import json
import math
from pathlib import Path

import requests

import config
from core import vault_bridge
from utils.logger import get_logger

log = get_logger(__name__)

CACHE_PATH = Path(__file__).parent.parent / "memory" / "vault_embeddings.json"
CONSTELLATION_CACHE_PATH = Path(__file__).parent.parent / "memory" / "constellation_embeddings.json"

TOP_K = 6
MIN_SCORE = 0.35            # below this the chunk is likely irrelevant
MIN_CHUNKS_FOR_RAG = 12     # small corpus: just inject everything

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
    """Return [{text, vec, source_type, source_id}] for the whole vault,
    re-embedding only files whose mtime changed. None → embedding
    unavailable."""
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

    return [
        {**c, "source_type": "vault", "source_id": key}
        for key, entry in current_files.items() for c in entry["chunks"]
    ]


def _load_constellation_cache() -> dict:
    if CONSTELLATION_CACHE_PATH.exists():
        try:
            return json.loads(CONSTELLATION_CACHE_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {"model": config.EMBED_MODEL, "nodes": {}}


def _save_constellation_cache(cache: dict) -> None:
    try:
        CONSTELLATION_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        CONSTELLATION_CACHE_PATH.write_text(json.dumps(cache), encoding="utf-8")
    except OSError as e:
        log.warning(f"[memory_rag] Could not save constellation embedding cache: {e}")


def _node_text(node: dict) -> str:
    label = node.get("label", "")
    desc = node.get("description", "")
    return f"[{node.get('category', '')}] {label}: {desc}" if desc else f"[{node.get('category', '')}] {label}"


def _indexed_constellation_chunks() -> list[dict] | None:
    """Embed every real Constellation node (core/constellation_manager.py) —
    this is what makes the Constellation graph actually semantically
    searchable/retrievable instead of just keyword-tagged. Cached per node
    by a content hash (label+description+category), so editing a node
    re-embeds just that node, not the whole graph."""
    global _warned_no_model
    from core.constellation_manager import constellation

    nodes = constellation.get_all()["nodes"]
    cache = _load_constellation_cache()
    if cache.get("model") != config.EMBED_MODEL:
        cache = {"model": config.EMBED_MODEL, "nodes": {}}

    current_nodes = {}
    changed = False
    for node in nodes:
        node_id = node["id"]
        text = _node_text(node)
        content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]
        entry = cache["nodes"].get(node_id)
        if entry and entry.get("hash") == content_hash:
            current_nodes[node_id] = entry
            continue

        vec = _embed(text)
        if vec is None:
            if not _warned_no_model:
                log.info(
                    f"[memory_rag] Embedding model '{config.EMBED_MODEL}' unavailable — "
                    f"Constellation search will fall back to keyword matching."
                )
                _warned_no_model = True
            return None
        current_nodes[node_id] = {"hash": content_hash, "text": text, "vec": vec}
        changed = True

    if changed or set(cache["nodes"]) != set(current_nodes):
        cache["nodes"] = current_nodes
        _save_constellation_cache(cache)

    return [
        {"text": entry["text"], "vec": entry["vec"], "source_type": "constellation", "source_id": node_id}
        for node_id, entry in current_nodes.items()
    ]


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0


# ── Public API ────────────────────────────────────────────────────────

def get_context(query: str) -> str:
    """Combined vault + Constellation context block for this message —
    retrieved if the corpus is big enough and embeddings work, otherwise
    everything is injected (old behavior)."""
    vault_chunks = _indexed_chunks()
    node_chunks = _indexed_constellation_chunks()
    chunks = None if vault_chunks is None and node_chunks is None else (vault_chunks or []) + (node_chunks or [])

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
    return f"## Relevant Memory\n\n{lines}"


def semantic_search(query: str, top_k: int = 10) -> dict:
    """Real semantic search across vault chunks + Constellation nodes —
    backs GET /api/constellation/search. Returns ranked, source-attributed
    results so the frontend can highlight the actual matching nodes and
    explain why each result matched (the score), never a fabricated match.
    """
    vault_chunks = _indexed_chunks()
    node_chunks = _indexed_constellation_chunks()
    embeddings_available = not (vault_chunks is None and node_chunks is None)
    chunks = (vault_chunks or []) + (node_chunks or [])

    if not embeddings_available:
        return {"query": query, "results": [], "mode": "unavailable",
                "message": f"Embedding model '{config.EMBED_MODEL}' unavailable — run: ollama pull {config.EMBED_MODEL}"}

    qvec = _embed(query)
    if qvec is None:
        return {"query": query, "results": [], "mode": "unavailable",
                "message": "Could not embed the search query — is Ollama running?"}

    scored = sorted(
        (
            {"score": round(_cosine(qvec, c["vec"]), 4), "text": c["text"],
             "source_type": c["source_type"], "source_id": c["source_id"]}
            for c in chunks
        ),
        key=lambda r: r["score"], reverse=True,
    )
    results = [r for r in scored[:top_k] if r["score"] >= MIN_SCORE]
    return {"query": query, "results": results, "mode": "semantic", "message": None}
