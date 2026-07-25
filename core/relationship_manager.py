"""
core/relationship_manager.py — Evidence-backed relationship discovery.

Computes real relationships between Constellation nodes from actual
evidence — semantic similarity and co-occurrence — never from an LLM
guessing that two things "sound related". Stores them through
constellation_manager.add_edge() (reused, not duplicated), which already
tracks strength; this module is what actually decides *which* edges to
create and *why*.

Two relationship types computed here:
  - duplicate_of  — near-identical content (cosine >= DUPLICATE_THRESHOLD)
  - related_to    — genuinely similar content (cosine >= RELATED_THRESHOLD)

belongs_to/supports/supersedes are real, safe types in the schema
(constellation_manager.SAFE_RELATIONSHIP_TYPES) but nothing here invents
them without evidence this module doesn't yet compute (e.g. supersedes
needs explicit "this replaces X" user intent, not similarity alone) — they
stay unused until a real evidence source for them exists, rather than
being faked.
"""

from core.memory_rag import DUPLICATE_THRESHOLD
from utils.logger import get_logger

log = get_logger(__name__)

RELATED_THRESHOLD = 0.75


def discover_relationships() -> dict:
    """Pairwise-compare every Constellation node's embedding and create
    real, evidence-backed edges. O(n^2) — fine at current scale (dozens of
    nodes); would need an ANN index before this scales to thousands, a
    known limitation, not a hidden one."""
    from core import memory_rag
    from core.constellation_manager import constellation

    chunks = memory_rag._indexed_constellation_chunks()
    if chunks is None:
        return {"status": "unavailable", "message": "Embedding model unavailable", "created": 0, "duplicates_found": 0}

    duplicates_found = 0
    related_found = 0
    n = len(chunks)
    for i in range(n):
        for j in range(i + 1, n):
            a, b = chunks[i], chunks[j]
            score = memory_rag._cosine(a["vec"], b["vec"])
            if score >= DUPLICATE_THRESHOLD:
                constellation.add_edge(
                    a["source_id"], b["source_id"],
                    relationship_type="duplicate_of", confidence=score,
                    supporting_source_ids=[a["source_id"], b["source_id"]],
                    creation_method="semantic_similarity",
                )
                duplicates_found += 1
            elif score >= RELATED_THRESHOLD:
                constellation.add_edge(
                    a["source_id"], b["source_id"],
                    relationship_type="related_to", confidence=score,
                    supporting_source_ids=[a["source_id"], b["source_id"]],
                    creation_method="semantic_similarity",
                )
                related_found += 1

    return {
        "status": "ok", "message": None,
        "duplicates_found": duplicates_found, "related_found": related_found,
        "nodes_compared": n,
    }
