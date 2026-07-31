"""
core/constellation_manager.py — Memory Constellation
Manages the user's memory graph: nodes, edges, confidence scoring, and decay.
Every memory must be earned through real interaction — no fake data ever seeded.
"""

import json
import uuid
from datetime import datetime
from pathlib import Path
from utils.logger import get_logger

log = get_logger(__name__)

DB_PATH = Path(__file__).parent.parent / "memory" / "constellation.json"

VALID_CATEGORIES = {
    'projects', 'technology', 'people', 'hardware', 'software', 'ai_models',
    'servers_network', 'research', 'ideas', 'goals', 'decisions', 'tasks',
    'events', 'preferences', 'personal_knowledge', 'documents', 'uncategorized',
}

# Map every category name this field has ever held → the current 17-category
# taxonomy (core/category_manager.py owns the taxonomy itself; this map just
# keeps the legacy single `category` field on old nodes in sync with it).
_OLD_CAT_MAP = {
    # Pre-8-category names
    'interests':     'preferences',
    'values':        'personal_knowledge',
    'experiences':   'events',
    'personal':      'personal_knowledge',
    'knowledge':     'documents',
    # Previous 8-category taxonomy → new 17 (confirmed mapping)
    'identity':      'personal_knowledge',
    'skills':        'technology',
    'systems':       'servers_network',
    'relationships': 'people',
    'vault':         'personal_knowledge',
    # 'projects', 'preferences', 'events' are unchanged names, no entry needed
}


def _now() -> str:
    return datetime.now().isoformat()


def _days_ago(iso: str) -> int:
    try:
        return (datetime.now() - datetime.fromisoformat(iso)).days
    except Exception:
        return 0


class ConstellationManager:
    def __init__(self):
        self._data: dict | None = None

    # ── Persistence ──────────────────────────────────────────────────

    def _load(self):
        if self._data is not None:
            return
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        if DB_PATH.exists():
            try:
                with open(DB_PATH, 'r', encoding='utf-8-sig') as f:  # utf-8-sig strips BOM if present
                    self._data = json.load(f)
                # Migrate old category names to new schema
                changed = False
                for node in self._data.get('nodes', []):
                    old = node.get('category', '')
                    if old in _OLD_CAT_MAP:
                        node['category'] = _OLD_CAT_MAP[old]
                        changed = True
                if changed:
                    self._save()
                    log.info("[constellation] Migrated old category names to new schema.")
                return
            except Exception as e:
                log.warning(f"[constellation] DB corrupt, resetting: {e}")
        self._data = {"nodes": [], "edges": []}

    def _save(self):
        try:
            with open(DB_PATH, 'w', encoding='utf-8') as f:
                json.dump(self._data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            log.error(f"[constellation] Save failed: {e}")

    # ── Queries ───────────────────────────────────────────────────────

    def get_all(self) -> dict:
        self._load()
        nodes = [self._apply_decay(n) for n in self._data['nodes']]
        # Legacy edges predate the typed-relationship schema — default them
        # to what they always implicitly were, rather than showing `None`.
        edges = [
            e if 'relationship_type' in e else {**e, 'relationship_type': 'mentioned_with',
                                                  'confidence': e.get('strength', 0.5),
                                                  'supporting_source_ids': [], 'creation_method': 'co_mention',
                                                  'manually_confirmed': False}
            for e in self._data['edges']
        ]
        return {
            "nodes": nodes,
            "edges": edges,
            "stats": {
                "total_memories": len(nodes),
                "total_edges":    len(self._data['edges']),
                "categories":     len({n['category'] for n in nodes}),
                "last_synced":    _now(),
            }
        }

    def _apply_decay(self, node: dict) -> dict:
        n = dict(node)
        days = _days_ago(n.get('last_referenced', n['timestamp']))
        if days > 30:
            decay = min(0.45, (days - 30) * 0.010)
            n['confidence'] = round(max(0.05, n.get('confidence', 0.7) - decay), 3)
        n['days_since_referenced'] = days
        return n

    def find_by_label(self, label: str, category: str) -> dict | None:
        self._load()
        ll = label.lower().strip()
        return next(
            (n for n in self._data['nodes']
             if n['label'].lower() == ll and n['category'] == category),
            None
        )

    def find_by_id(self, node_id: str) -> dict | None:
        self._load()
        return next((n for n in self._data['nodes'] if n['id'] == node_id), None)

    # ── Mutations ─────────────────────────────────────────────────────

    def add_memory(self, label: str, category: str, description: str = "",
                   source: str = "chat", confidence: float = 0.65,
                   importance: int = 3, tags: list = None) -> dict:
        self._load()
        category = category.lower()
        category = _OLD_CAT_MAP.get(category, category)   # migrate old names on the fly
        if category not in VALID_CATEGORIES:
            category = 'uncategorized'

        existing = self.find_by_label(label, category)
        if existing:
            return self.reinforce(existing['id'])

        node = {
            "id":              str(uuid.uuid4()),
            "label":           label.strip()[:80],
            "category":        category,
            "description":     description[:400],
            "source":          source,
            "timestamp":       _now(),
            "last_referenced": _now(),
            "confidence":      round(min(1.0, max(0.0, confidence)), 3),
            "importance":      max(1, min(5, importance)),
            "mention_count":   1,
            "tags":            (tags or [])[:10],
            "archived":        False,
            "pinned":          False,
        }
        self._data['nodes'].append(node)
        self._save()
        log.info(f"[constellation] New memory [{category}] → {label}")
        return node

    def reinforce(self, node_id: str) -> dict:
        """Strengthen a memory — called every time it's mentioned again."""
        self._load()
        node = self.find_by_id(node_id)
        if not node:
            return {}
        node['mention_count']   = node.get('mention_count', 1) + 1
        node['last_referenced'] = _now()
        node['confidence']      = round(min(1.0, node.get('confidence', 0.5) + 0.06), 3)
        if node['mention_count'] % 5 == 0 and node.get('importance', 3) < 5:
            node['importance'] += 1
        self._save()
        return node

    def update_memory(self, node_id: str, updates: dict) -> dict:
        self._load()
        node = self.find_by_id(node_id)
        if not node:
            return {}
        allowed = {'label', 'description', 'category', 'importance', 'tags', 'pinned', 'archived'}
        for k, v in updates.items():
            if k in allowed:
                node[k] = v
        node['last_referenced'] = _now()
        self._save()
        return node

    def delete_memory(self, node_id: str) -> bool:
        self._load()
        before = len(self._data['nodes'])
        self._data['nodes'] = [n for n in self._data['nodes'] if n['id'] != node_id]
        self._data['edges'] = [
            e for e in self._data['edges']
            if e['source'] != node_id and e['target'] != node_id
        ]
        if len(self._data['nodes']) < before:
            self._save()
            return True
        return False

    # Relationship types this system will ever create on its own — no
    # unsupported type gets invented merely because it "sounds plausible".
    SAFE_RELATIONSHIP_TYPES = {
        "mentioned_with", "related_to", "belongs_to", "supports", "duplicate_of", "supersedes",
    }

    def add_edge(self, source_id: str, target_id: str, relationship_type: str = "mentioned_with",
                 confidence: float = 0.5, supporting_source_ids: list | None = None,
                 creation_method: str = "co_mention") -> dict:
        """Create or strengthen a typed, evidence-backed edge. Defaults
        preserve the original co-mention behavior for existing callers
        (core/memory_extractor.py) that don't pass the new fields."""
        self._load()
        if source_id == target_id:
            return {}
        if relationship_type not in self.SAFE_RELATIONSHIP_TYPES:
            relationship_type = "related_to"

        pair = tuple(sorted([source_id, target_id]))
        existing = next(
            (e for e in self._data['edges']
             if tuple(sorted([e['source'], e['target']])) == pair
             and e.get('relationship_type', 'mentioned_with') == relationship_type),
            None
        )
        if existing:
            existing['strength'] = round(min(1.0, existing.get('strength', 0.3) + 0.08), 3)
            existing['confidence'] = round(max(existing.get('confidence', 0.5), confidence), 3)
            for sid in (supporting_source_ids or []):
                if sid not in existing.setdefault('supporting_source_ids', []):
                    existing['supporting_source_ids'].append(sid)
            self._save()
            return existing

        edge = {
            "id":                    str(uuid.uuid4()),
            "source":                source_id,
            "target":                target_id,
            "relationship_type":     relationship_type,
            "strength":              0.30,
            "confidence":            round(max(0.0, min(1.0, confidence)), 3),
            "supporting_source_ids": list(supporting_source_ids or []),
            "creation_method":       creation_method,
            "manually_confirmed":    False,
            "created":               _now(),
        }
        self._data['edges'].append(edge)
        self._save()
        return edge

    def confirm_edge(self, edge_id: str, confirmed: bool) -> dict | None:
        """User confirms or rejects a relationship — an explicit human
        judgment that future automatic passes should not silently override."""
        self._load()
        edge = next((e for e in self._data['edges'] if e['id'] == edge_id), None)
        if not edge:
            return None
        edge['manually_confirmed'] = confirmed
        self._save()
        return edge

    def get_export(self) -> dict:
        self._load()
        return {
            "version":  "1.0",
            "exported": _now(),
            "nodes":    self._data['nodes'],
            "edges":    self._data['edges'],
        }


# Singleton
constellation = ConstellationManager()
