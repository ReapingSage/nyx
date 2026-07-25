"""
core/category_manager.py — Multi-label automatic categorization.

Extends (not replaces) constellation_manager.py's existing single
`category` field — that field stays as the node's primary/legacy category
(used for the existing color/grouping logic), while this module adds real
multi-label assignments: a node can belong to several categories at once,
each with its own confidence and source (automatic vs. manual).

Deliberately conservative about creating new categories — starts from the
existing 8-category taxonomy constellation_manager.py already uses, and
only ever auto-assigns *existing* categories by embedding similarity. It
does not invent new categories from isolated keywords; that's a distinct,
higher-risk operation left as an explicit manual/future action, per "avoid
producing hundreds of nearly identical categories."
"""

import json
from datetime import datetime
from pathlib import Path

from utils.logger import get_logger

log = get_logger(__name__)

TAXONOMY_PATH = Path(__file__).parent.parent / "memory" / "categories.json"
ASSIGNMENTS_PATH = Path(__file__).parent.parent / "memory" / "node_categories.json"

# Seed taxonomy — matches constellation_manager.VALID_CATEGORIES exactly so
# every existing node's legacy `category` field is already a valid entry
# here. `description` is what gets embedded to auto-match new nodes against.
_SEED_TAXONOMY = [
    {"id": "identity",      "name": "Identity",      "description": "Who the user is, their name, role, and core identity facts.", "parent_id": None},
    {"id": "projects",      "name": "Projects",      "description": "Software projects, apps, and things being actively built.", "parent_id": None},
    {"id": "skills",        "name": "Skills",        "description": "Technical skills, languages, tools, and areas of expertise.", "parent_id": None},
    {"id": "systems",       "name": "Systems",       "description": "Hardware, infrastructure, servers, machines, and technical setup.", "parent_id": None},
    {"id": "preferences",   "name": "Preferences",   "description": "Likes, dislikes, personal preferences, and habits.", "parent_id": None},
    {"id": "events",        "name": "Events",        "description": "Things that happened, dated occurrences, and experiences.", "parent_id": None},
    {"id": "relationships", "name": "Relationships",  "description": "People, teams, and relationships the user has.", "parent_id": None},
    {"id": "vault",         "name": "Vault",         "description": "General notes and knowledge not covered elsewhere.", "parent_id": None},
]

ASSIGN_THRESHOLD = 0.42   # a node scoring above this for a category gets that label
MAX_LABELS = 3            # cap auto-assigned labels per node — avoid every node tagging everything


def _load_json(path: Path, default):
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return default


def _save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def get_taxonomy() -> list[dict]:
    data = _load_json(TAXONOMY_PATH, None)
    if data is None:
        _save_json(TAXONOMY_PATH, _SEED_TAXONOMY)
        return list(_SEED_TAXONOMY)
    return data


def add_category(cat_id: str, name: str, description: str, parent_id: str | None = None) -> dict:
    """Manual category creation — not called automatically per-node. A
    human (or a future, explicitly-invoked suggestion flow) decides when a
    genuinely new category is warranted."""
    taxonomy = get_taxonomy()
    if any(c["id"] == cat_id for c in taxonomy):
        raise ValueError(f"Category '{cat_id}' already exists")
    taxonomy.append({"id": cat_id, "name": name, "description": description, "parent_id": parent_id})
    _save_json(TAXONOMY_PATH, taxonomy)
    return taxonomy[-1]


def _load_assignments() -> dict:
    return _load_json(ASSIGNMENTS_PATH, {})


def _save_assignments(data: dict) -> None:
    _save_json(ASSIGNMENTS_PATH, data)


def get_node_categories(node_id: str) -> list[dict]:
    return _load_assignments().get(node_id, [])


def set_manual_category(node_id: str, category_id: str, add: bool = True) -> list[dict]:
    """Explicit user correction — always preserved, never overwritten by
    a later automatic pass (see assign_categories_for_node)."""
    taxonomy_ids = {c["id"] for c in get_taxonomy()}
    if category_id not in taxonomy_ids:
        raise ValueError(f"Unknown category '{category_id}'")

    assignments = _load_assignments()
    node_cats = assignments.get(node_id, [])
    node_cats = [c for c in node_cats if c["category_id"] != category_id]
    if add:
        node_cats.append({
            "category_id": category_id, "confidence": 1.0,
            "source": "manual", "assigned_at": datetime.now().isoformat(),
        })
    assignments[node_id] = node_cats
    _save_assignments(assignments)
    return node_cats


def _category_embedding_cache() -> dict:
    """Embeds each category's description once, cached to disk — same
    embedding model/pipeline as memory_rag.py, reused rather than
    duplicated."""
    from core import memory_rag
    cache_path = Path(__file__).parent.parent / "memory" / "category_embeddings.json"
    cache = _load_json(cache_path, {"model": None, "vecs": {}})
    taxonomy = get_taxonomy()

    import config
    if cache.get("model") != config.EMBED_MODEL or set(cache["vecs"]) != {c["id"] for c in taxonomy}:
        vecs = {}
        for c in taxonomy:
            vec = memory_rag._embed(f"{c['name']}: {c['description']}")
            if vec is not None:
                vecs[c["id"]] = vec
        cache = {"model": config.EMBED_MODEL, "vecs": vecs}
        _save_json(cache_path, cache)
    return cache["vecs"]


def assign_categories_for_node(node_id: str, node_text: str) -> list[dict] | None:
    """Auto-assign categories by embedding similarity against the taxonomy.
    Returns None if embeddings are unavailable (caller should leave
    existing assignments untouched, not clear them). Manual assignments on
    this node are never removed by an automatic pass."""
    from core import memory_rag

    cat_vecs = _category_embedding_cache()
    if not cat_vecs:
        return None
    node_vec = memory_rag._embed(node_text)
    if node_vec is None:
        return None

    scored = sorted(
        ((memory_rag._cosine(node_vec, vec), cat_id) for cat_id, vec in cat_vecs.items()),
        key=lambda x: x[0], reverse=True,
    )
    auto_labels = [
        {"category_id": cat_id, "confidence": round(score, 3), "source": "automatic",
         "assigned_at": datetime.now().isoformat()}
        for score, cat_id in scored[:MAX_LABELS] if score >= ASSIGN_THRESHOLD
    ]

    assignments = _load_assignments()
    manual = [c for c in assignments.get(node_id, []) if c["source"] == "manual"]
    manual_ids = {c["category_id"] for c in manual}
    auto_labels = [c for c in auto_labels if c["category_id"] not in manual_ids]
    assignments[node_id] = manual + auto_labels
    _save_assignments(assignments)
    return assignments[node_id]


def reassign_all() -> dict:
    """Re-run automatic categorization for every node — the real backing
    for a 'recategorize' action. Manual corrections are preserved."""
    from core.constellation_manager import constellation
    from core.memory_rag import _node_text

    nodes = constellation.get_all()["nodes"]
    updated, skipped = 0, 0
    for node in nodes:
        result = assign_categories_for_node(node["id"], _node_text(node))
        if result is None:
            skipped += 1
        else:
            updated += 1
    return {"updated": updated, "skipped_no_embeddings": skipped, "total": len(nodes)}
