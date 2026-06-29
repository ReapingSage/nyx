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
    'identity', 'projects', 'skills', 'systems',
    'preferences', 'events', 'relationships', 'vault',
}

# Map old category names → new ones (migration for existing data)
_OLD_CAT_MAP = {
    'goals':       'identity',
    'interests':   'preferences',
    'values':      'identity',
    'experiences': 'events',
    'personal':    'identity',
    'knowledge':   'vault',
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
        return {
            "nodes": nodes,
            "edges": self._data['edges'],
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
            category = 'vault'

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

    def add_edge(self, source_id: str, target_id: str) -> dict:
        """Create or strengthen a co-mention edge."""
        self._load()
        if source_id == target_id:
            return {}
        pair = tuple(sorted([source_id, target_id]))
        existing = next(
            (e for e in self._data['edges']
             if tuple(sorted([e['source'], e['target']])) == pair),
            None
        )
        if existing:
            existing['strength'] = round(min(1.0, existing.get('strength', 0.3) + 0.08), 3)
            self._save()
            return existing

        edge = {
            "id":       str(uuid.uuid4()),
            "source":   source_id,
            "target":   target_id,
            "strength": 0.30,
            "created":  _now(),
        }
        self._data['edges'].append(edge)
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
