"""
core/category_manager.py — Multi-label automatic categorization.

Extends (not replaces) constellation_manager.py's existing single
`category` field — that field is migrated to the new taxonomy below and
kept as the node's *primary* legacy category, while this module adds real
multi-label assignments: a node can belong to several categories at once,
one marked primary (controls its color), the rest secondary.

Controlled, non-explosive taxonomy — 17 fixed top-level categories.
Auto-assignment only ever picks from this set by embedding similarity; it
never invents a new top-level category on its own. Subcategories can be
added explicitly (add_category with a parent_id) but require the caller
to justify them — this module doesn't do that judgment itself.
"""

import json
from datetime import datetime
from pathlib import Path

from utils.logger import get_logger

log = get_logger(__name__)

TAXONOMY_PATH = Path(__file__).parent.parent / "memory" / "categories.json"
ASSIGNMENTS_PATH = Path(__file__).parent.parent / "memory" / "node_categories.json"

# Controlled top-level taxonomy. `description` is what gets embedded to
# auto-match nodes against — kept concrete and example-rich so embedding
# similarity actually discriminates between neighbors (e.g. Hardware vs.
# Servers & Network, Software vs. AI & Models).
_SEED_TAXONOMY = [
    {"id": "projects",            "name": "Projects",            "description": "Active software projects, apps, and things being built — e.g. Nyx, Unionfall, Ashwake.", "parent_id": None},
    {"id": "technology",          "name": "Technology",          "description": "General technical skills, languages, and areas of technical expertise.", "parent_id": None},
    {"id": "people",              "name": "People",              "description": "People, teams, relationships, and who the user knows or works with.", "parent_id": None},
    {"id": "hardware",            "name": "Hardware",            "description": "Physical machines, devices, and equipment — e.g. a MINISFORUM box, a GPU, a phone.", "parent_id": None},
    {"id": "software",            "name": "Software",            "description": "Software tools, frameworks, and applications — e.g. React Native, Obsidian, VS Code.", "parent_id": None},
    {"id": "ai_models",           "name": "AI & Models",         "description": "AI models, LLMs, and AI tooling — e.g. Ollama, embedding models, Claude, GPT.", "parent_id": None},
    {"id": "servers_network",     "name": "Servers & Network",   "description": "Servers, self-hosting, networking, and infrastructure — e.g. Proxmox, a home server, Tailscale.", "parent_id": None},
    {"id": "research",            "name": "Research",            "description": "Things being researched, investigated, or learned about before a decision.", "parent_id": None},
    {"id": "ideas",               "name": "Ideas",               "description": "Early, unconfirmed ideas and concepts not yet committed to.", "parent_id": None},
    {"id": "goals",               "name": "Goals",               "description": "Things the user wants to achieve or build in the future.", "parent_id": None},
    {"id": "decisions",           "name": "Decisions",           "description": "Choices that have been made, including why one option was picked over another.", "parent_id": None},
    {"id": "tasks",               "name": "Tasks",               "description": "Concrete to-do items and action items.", "parent_id": None},
    {"id": "events",              "name": "Events",              "description": "Things that happened, dated occurrences, and experiences.", "parent_id": None},
    {"id": "preferences",         "name": "Preferences",         "description": "Likes, dislikes, personal preferences, taste, and habits — e.g. dark mode.", "parent_id": None},
    {"id": "personal_knowledge",  "name": "Personal Knowledge",  "description": "Who the user is, identity facts, and general personal notes not covered elsewhere.", "parent_id": None},
    {"id": "documents",           "name": "Documents",           "description": "Saved documents, files, and references.", "parent_id": None},
    {"id": "uncategorized",       "name": "Uncategorized",       "description": "Nothing else fit confidently — needs a human look or more context.", "parent_id": None},
]

# Old 8-category taxonomy → new 17, confirmed mapping. Applied once by
# migrate_legacy_categories() to both node_categories.json assignments and
# constellation_manager's legacy single `category` field.
LEGACY_CATEGORY_MAP = {
    "identity":      "personal_knowledge",
    "projects":      "projects",
    "skills":        "technology",
    "systems":       "servers_network",
    "preferences":   "preferences",
    "events":        "events",
    "relationships": "people",
    "vault":         "personal_knowledge",
}

ASSIGN_THRESHOLD = 0.42   # a node scoring above this for a category gets that label
MAX_SECONDARY = 2          # cap secondary labels — avoid every node tagging everything
UNCATEGORIZED_ID = "uncategorized"


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
    changed = False

    # Purge any leftover pre-migration category definitions (the old
    # 8-category taxonomy) — their assignments already got remapped by
    # migrate_legacy_categories(), so keeping the old *definitions* around
    # would just let auto-categorization pick a superseded ID again.
    superseded = {c["id"] for c in data if c["id"] in LEGACY_CATEGORY_MAP}
    if superseded:
        data = [c for c in data if c["id"] not in superseded]
        changed = True

    # Self-heal: a taxonomy file saved before a new seed category existed
    # (e.g. upgrading from an older Nyx version) gets missing entries
    # appended, never loses user-added categories or custom colors.
    existing_ids = {c["id"] for c in data}
    missing = [c for c in _SEED_TAXONOMY if c["id"] not in existing_ids]
    if missing:
        data = data + missing
        changed = True

    if changed:
        _save_json(TAXONOMY_PATH, data)
    return data


def get_category(cat_id: str) -> dict | None:
    return next((c for c in get_taxonomy() if c["id"] == cat_id), None)


def add_category(cat_id: str, name: str, description: str, parent_id: str | None = None) -> dict:
    """Manual category creation — not called automatically per-node. A
    human (or a future, explicitly-invoked suggestion flow) decides when a
    genuinely new category is warranted."""
    taxonomy = get_taxonomy()
    if any(c["id"] == cat_id for c in taxonomy):
        raise ValueError(f"Category '{cat_id}' already exists")
    if parent_id and not any(c["id"] == parent_id for c in taxonomy):
        raise ValueError(f"Parent category '{parent_id}' does not exist")
    taxonomy.append({"id": cat_id, "name": name, "description": description, "parent_id": parent_id})
    _save_json(TAXONOMY_PATH, taxonomy)
    _invalidate_category_embeddings()
    return taxonomy[-1]


def rename_category(cat_id: str, new_name: str) -> dict:
    taxonomy = get_taxonomy()
    cat = next((c for c in taxonomy if c["id"] == cat_id), None)
    if not cat:
        raise ValueError(f"Category '{cat_id}' not found")
    cat["name"] = new_name
    _save_json(TAXONOMY_PATH, taxonomy)
    return cat


def set_category_color(cat_id: str, color_hex: str) -> dict:
    """User-chosen override — persists across restarts, takes priority
    over the frontend's default palette for this category."""
    taxonomy = get_taxonomy()
    cat = next((c for c in taxonomy if c["id"] == cat_id), None)
    if not cat:
        raise ValueError(f"Category '{cat_id}' not found")
    cat["custom_color"] = color_hex
    _save_json(TAXONOMY_PATH, taxonomy)
    return cat


def restore_category_color(cat_id: str) -> dict:
    taxonomy = get_taxonomy()
    cat = next((c for c in taxonomy if c["id"] == cat_id), None)
    if not cat:
        raise ValueError(f"Category '{cat_id}' not found")
    cat.pop("custom_color", None)
    _save_json(TAXONOMY_PATH, taxonomy)
    return cat


def merge_categories(from_id: str, into_id: str) -> dict:
    """Moves every assignment from `from_id` to `into_id`, then removes
    `from_id` from the taxonomy. Only for categories that turned out to be
    near-duplicates — not part of automatic behavior, always explicit."""
    if from_id == into_id:
        raise ValueError("Cannot merge a category into itself")
    taxonomy = get_taxonomy()
    if not any(c["id"] == into_id for c in taxonomy):
        raise ValueError(f"Target category '{into_id}' not found")

    assignments = _load_assignments()
    moved = 0
    for node_id, cats in assignments.items():
        for c in cats:
            if c["category_id"] == from_id:
                c["category_id"] = into_id
                moved += 1
        # Collapse duplicates if both from/into ended up assigned to the same node
        seen = set()
        deduped = []
        for c in cats:
            if c["category_id"] in seen:
                continue
            seen.add(c["category_id"])
            deduped.append(c)
        assignments[node_id] = deduped
    _save_assignments(assignments)

    taxonomy = [c for c in taxonomy if c["id"] != from_id]
    _save_json(TAXONOMY_PATH, taxonomy)
    return {"moved_assignments": moved, "removed_category": from_id, "merged_into": into_id}


# ── Node assignments ────────────────────────────────────────────────

def _load_assignments() -> dict:
    return _load_json(ASSIGNMENTS_PATH, {})


def _save_assignments(data: dict) -> None:
    _save_json(ASSIGNMENTS_PATH, data)


def get_node_categories(node_id: str) -> list[dict]:
    return _load_assignments().get(node_id, [])


def get_primary_category(node_id: str) -> dict | None:
    cats = get_node_categories(node_id)
    return next((c for c in cats if c.get("is_primary")), cats[0] if cats else None)


def set_primary_category(node_id: str, category_id: str) -> list[dict]:
    """Explicit user choice — never silently overwritten by a later
    automatic pass (see assign_categories_for_node)."""
    taxonomy_ids = {c["id"] for c in get_taxonomy()}
    if category_id not in taxonomy_ids:
        raise ValueError(f"Unknown category '{category_id}'")

    assignments = _load_assignments()
    node_cats = [c for c in assignments.get(node_id, []) if c["category_id"] != category_id]
    for c in node_cats:
        c["is_primary"] = False
    node_cats.insert(0, {
        "category_id": category_id, "confidence": 1.0, "source": "manual",
        "is_primary": True, "assigned_at": datetime.now().isoformat(),
    })
    assignments[node_id] = node_cats
    _save_assignments(assignments)
    return node_cats


def add_secondary_category(node_id: str, category_id: str) -> list[dict]:
    taxonomy_ids = {c["id"] for c in get_taxonomy()}
    if category_id not in taxonomy_ids:
        raise ValueError(f"Unknown category '{category_id}'")
    assignments = _load_assignments()
    node_cats = assignments.get(node_id, [])
    if not any(c["category_id"] == category_id for c in node_cats):
        node_cats.append({
            "category_id": category_id, "confidence": 1.0, "source": "manual",
            "is_primary": False, "assigned_at": datetime.now().isoformat(),
        })
    assignments[node_id] = node_cats
    _save_assignments(assignments)
    return node_cats


def remove_category(node_id: str, category_id: str) -> list[dict]:
    assignments = _load_assignments()
    node_cats = assignments.get(node_id, [])
    was_primary = any(c["category_id"] == category_id and c.get("is_primary") for c in node_cats)
    node_cats = [c for c in node_cats if c["category_id"] != category_id]
    # Losing the primary promotes the next-highest-confidence label rather
    # than leaving the node with no primary category at all.
    if was_primary and node_cats:
        node_cats.sort(key=lambda c: c["confidence"], reverse=True)
        node_cats[0]["is_primary"] = True
    assignments[node_id] = node_cats
    _save_assignments(assignments)
    return node_cats


def confirm_category(node_id: str, category_id: str) -> list[dict]:
    """User confirms an automatic suggestion — converts it to manual so it
    can never be silently overwritten later."""
    assignments = _load_assignments()
    node_cats = assignments.get(node_id, [])
    for c in node_cats:
        if c["category_id"] == category_id:
            c["source"] = "manual"
    assignments[node_id] = node_cats
    _save_assignments(assignments)
    return node_cats


def reject_category(node_id: str, category_id: str) -> list[dict]:
    return remove_category(node_id, category_id)


# ── Automatic assignment ────────────────────────────────────────────

def _invalidate_category_embeddings() -> None:
    cache_path = Path(__file__).parent.parent / "memory" / "category_embeddings.json"
    if cache_path.exists():
        cache_path.unlink()


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
    """Auto-assign one primary + up to MAX_SECONDARY secondary categories
    by embedding similarity against the controlled taxonomy. Low
    confidence on everything → explicit Uncategorized, never a silent
    empty assignment. Returns None if embeddings are unavailable (caller
    should leave existing assignments untouched). A manually-set primary
    is never demoted or replaced by this function."""
    from core import memory_rag

    cat_vecs = _category_embedding_cache()
    if not cat_vecs:
        return None
    node_vec = memory_rag._embed(node_text)
    if node_vec is None:
        return None

    scored = sorted(
        ((memory_rag._cosine(node_vec, vec), cat_id) for cat_id, vec in cat_vecs.items() if cat_id != UNCATEGORIZED_ID),
        key=lambda x: x[0], reverse=True,
    )
    above_threshold = [(s, c) for s, c in scored if s >= ASSIGN_THRESHOLD]

    assignments = _load_assignments()
    existing = assignments.get(node_id, [])
    manual_primary = next((c for c in existing if c.get("is_primary") and c["source"] == "manual"), None)
    manual_secondary = [c for c in existing if not c.get("is_primary") and c["source"] == "manual"]
    manual_ids = {c["category_id"] for c in ([manual_primary] if manual_primary else []) + manual_secondary}

    auto_candidates = [(s, c) for s, c in above_threshold if c not in manual_ids][:MAX_SECONDARY + 1]

    new_cats = []
    if manual_primary:
        new_cats.append(manual_primary)
    elif auto_candidates:
        s, c = auto_candidates[0]
        new_cats.append({"category_id": c, "confidence": round(s, 3), "source": "automatic",
                          "is_primary": True, "assigned_at": datetime.now().isoformat()})
        auto_candidates = auto_candidates[1:]
    else:
        # Nothing scored high enough — honest Uncategorized, not silence.
        new_cats.append({"category_id": UNCATEGORIZED_ID, "confidence": 1.0, "source": "automatic",
                          "is_primary": True, "assigned_at": datetime.now().isoformat()})

    new_cats.extend(manual_secondary)
    for s, c in auto_candidates[:MAX_SECONDARY]:
        if c in manual_ids:
            continue
        new_cats.append({"category_id": c, "confidence": round(s, 3), "source": "automatic",
                          "is_primary": False, "assigned_at": datetime.now().isoformat()})

    assignments[node_id] = new_cats
    _save_assignments(assignments)
    return new_cats


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


def category_counts() -> dict[str, int]:
    """Real per-category node counts — what the Constellation uses to
    decide which categories are actually visible (only-when-populated)."""
    counts: dict[str, int] = {}
    for cats in _load_assignments().values():
        for c in cats:
            counts[c["category_id"]] = counts.get(c["category_id"], 0) + 1
    return counts


def migrate_legacy_categories() -> dict:
    """One-time migration: old 8-category taxonomy → new 17 for
    node_categories.json multi-label assignments. The legacy single
    `category` field on each node is migrated separately, automatically,
    by constellation_manager's own _load() (see its _OLD_CAT_MAP) —
    this only needs to handle the assignments this module owns.
    Idempotent — safe to call more than once."""
    new_ids = {c["id"] for c in get_taxonomy()}
    assignments = _load_assignments()
    migrated_assignments = 0
    for node_id, cats in assignments.items():
        for c in cats:
            if c["category_id"] in LEGACY_CATEGORY_MAP:
                c["category_id"] = LEGACY_CATEGORY_MAP[c["category_id"]]
                migrated_assignments += 1
            elif c["category_id"] not in new_ids:
                c["category_id"] = UNCATEGORIZED_ID
    if migrated_assignments:
        _save_assignments(assignments)

    return {"migrated_assignments": migrated_assignments}
