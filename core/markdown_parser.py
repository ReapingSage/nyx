"""
core/markdown_parser.py — Obsidian-aware Markdown parsing.

Read-only. Never writes to or rewrites a vault file — this only extracts
structure from what's already there: YAML frontmatter, headings,
[[wiki-links]], and #tags. Works identically on plain Markdown with none
of that present (an ordinary file just parses as a single untitled
section, zero frontmatter, zero links) — Obsidian features are additive,
never required.

Stable IDs are derived from file identity + heading path + chunk content,
so renaming a file doesn't silently orphan a chunk's history the way a
random UUID would, and editing one section doesn't change the ID of
every other section in the same file (needed for real incremental
re-indexing, not a full-file rebuild on every edit).
"""

import hashlib
import re
from pathlib import Path

import yaml

# [[Page Name]], [[Page Name|Display]], [[Page Name#Heading]] — captures
# just the target page name, ignoring the optional display text/heading.
_WIKILINK_RE = re.compile(r"\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]")

# Obsidian inline tags: #tag or #nested/tag — must not match a markdown
# heading ("# Heading") or a URL fragment, so require a non-space char
# immediately after '#' and no leading '#' run (heading marker).
_TAG_RE = re.compile(r"(?<![#\w])#([A-Za-z0-9_/-]+)")

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+)$")
_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def parse_frontmatter(text: str) -> tuple[dict, str]:
    """Returns (frontmatter_dict, body_text_with_frontmatter_stripped).
    Empty dict + original text if there's no frontmatter block or it
    doesn't parse — never raises on malformed YAML, just treats it as
    absent rather than crashing indexing over one bad file."""
    m = _FRONTMATTER_RE.match(text)
    if not m:
        return {}, text
    try:
        fm = yaml.safe_load(m.group(1))
        if not isinstance(fm, dict):
            return {}, text
        return fm, text[m.end():]
    except yaml.YAMLError:
        return {}, text


def extract_wikilinks(text: str) -> list[str]:
    seen = []
    for m in _WIKILINK_RE.finditer(text):
        name = m.group(1).strip()
        if name and name not in seen:
            seen.append(name)
    return seen


def extract_inline_tags(text: str) -> list[str]:
    seen = []
    for m in _TAG_RE.finditer(text):
        tag = m.group(1)
        if tag not in seen:
            seen.append(tag)
    return seen


def _frontmatter_list(fm: dict, key: str) -> list[str]:
    """Frontmatter tags/aliases can be a YAML list or a comma-separated
    string — Obsidian accepts both conventions."""
    val = fm.get(key)
    if val is None:
        return []
    if isinstance(val, list):
        return [str(v).strip() for v in val if str(v).strip()]
    if isinstance(val, str):
        return [v.strip() for v in val.split(",") if v.strip()]
    return []


def stable_chunk_id(file_identity: str, heading_path: str, text: str) -> str:
    """Deterministic — same file + same section + same content always
    produces the same ID, so re-indexing an unchanged chunk is a no-op
    and only genuinely changed sections get new IDs."""
    raw = f"{file_identity}::{heading_path}::{text[:80]}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def chunk_by_headings(body: str, file_identity: str) -> list[dict]:
    """Splits on headings, tracking the heading hierarchy path for each
    chunk (e.g. 'Setup > Requirements'). A file with no headings at all
    produces one chunk under an empty heading path — plain notes still
    work, this never requires Obsidian-style structure."""
    lines = body.splitlines()
    stack: list[tuple[int, str]] = []   # (level, title)
    chunks = []
    current_lines: list[str] = []

    def flush():
        text = "\n".join(current_lines).strip()
        if not text:
            return
        heading_path = " > ".join(title for _, title in stack)
        chunks.append({
            "id": stable_chunk_id(file_identity, heading_path, text),
            "heading_path": heading_path,
            "text": text,
            "wikilinks": extract_wikilinks(text),
            "tags": extract_inline_tags(text),
        })

    for line in lines:
        m = _HEADING_RE.match(line)
        if m:
            flush()
            current_lines = []
            level = len(m.group(1))
            title = m.group(2).strip()
            while stack and stack[-1][0] >= level:
                stack.pop()
            stack.append((level, title))
        else:
            current_lines.append(line)
    flush()
    return chunks


def parse_markdown_file(path: Path) -> dict:
    """Full parse of one file — frontmatter, aliases, tags (frontmatter +
    inline), wikilinks, and heading-aware chunks with stable IDs. Read-only:
    this never writes back to `path`."""
    text = path.read_text(encoding="utf-8-sig")
    frontmatter, body = parse_frontmatter(text)
    file_identity = path.name

    aliases = _frontmatter_list(frontmatter, "aliases")
    fm_tags = _frontmatter_list(frontmatter, "tags")
    chunks = chunk_by_headings(body, file_identity)

    all_tags = list(fm_tags)
    all_wikilinks = []
    for c in chunks:
        for t in c["tags"]:
            if t not in all_tags:
                all_tags.append(t)
        for w in c["wikilinks"]:
            if w not in all_wikilinks:
                all_wikilinks.append(w)

    return {
        "file_identity": file_identity,
        "frontmatter": frontmatter,
        "aliases": aliases,
        "tags": all_tags,
        "wikilinks": all_wikilinks,
        "chunks": chunks,
    }
