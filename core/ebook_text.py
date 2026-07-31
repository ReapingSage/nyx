"""
core/ebook_text.py — EPUB/PDF/plain-text extraction into ordered chapters

Verified against the real installed ebooklib==0.20 and pymupdf==1.28.0
packages this session by building and reading back real test files (an
EPUB with a spine + TOC, a PDF with an outline, and a PDF without one) —
not inferred from docs.

EPUB: the spine (book.spine) is walked in reading order — that's real
structured data, not a guess. Each spine entry is skipped if it's the
EPUB3 nav document (isinstance check against epub.EpubNav — confirmed this
is how ebooklib itself marks the nav doc, its `get_type()` alone doesn't
distinguish it from a real chapter) or marked non-linear. Chapter titles
come from the book's own table of contents (book.toc, walked recursively
since it can nest via (Section, [children]) tuples — confirmed against a
real book), matched by href, falling back to an in-document <h1>/<h2>, then
"Chapter N". Text extraction uses lxml.html (already an ebooklib dependency,
confirmed present) rather than adding beautifulsoup4 for a job lxml already
does — block-level tags are joined so paragraphs don't run together the way
tree.text_content() alone does.

PDF: doc.get_toc() returns real embedded bookmarks when present — confirmed
against a bookmarked test PDF returning [[level, title, page], ...] and an
unbookmarked one returning []. When bookmarks exist, top-level (level 1)
entries become chapter boundaries and each chapter's text is the page range
between one bookmark and the next. When there is NO outline, this
deliberately does NOT guess via heading-detection heuristics (font-size
jumps, "Chapter N" regex scanning) — per the product requirement, an honest
single chapter containing the whole document is used instead, and the
caller is expected to surface that to the user rather than hide it.
"""

import re
from pathlib import Path

MIN_CHARS_PER_PAGE_WARNING = 20  # below this, likely a scanned/image-only PDF


def extract_chapters(path: Path, source_format: str, title_hint: str = "") -> list[dict]:
    """Returns [{"title": str, "text": str}, ...] in reading order."""
    if source_format == "epub":
        return extract_epub(path)
    if source_format == "pdf":
        return extract_pdf(path, title_hint=title_hint)
    raise ValueError(f"Unsupported source_format '{source_format}' for file extraction.")


def extract_plain_text(text: str, title_hint: str = "") -> list[dict]:
    """No chapter concept exists for raw pasted/typed text — the whole
    thing is chapter 0. Splitting it into fake chapters would be inventing
    structure that isn't there."""
    text = text.strip()
    if not text:
        return []
    return [{"title": title_hint or "Chapter 1", "text": text}]


# ── EPUB ──────────────────────────────────────────────────────────────

def _flatten_epub_toc(toc, epub_module) -> list:
    """book.toc entries are Link objects, or (Section, [children]) tuples,
    or plain lists — all can nest. Flatten to a list of Link objects."""
    out = []
    for entry in toc:
        if isinstance(entry, epub_module.Link):
            out.append(entry)
        elif isinstance(entry, tuple):
            section, children = entry
            if isinstance(section, epub_module.Link):
                out.append(section)
            out.extend(_flatten_epub_toc(children, epub_module))
        elif isinstance(entry, list):
            out.extend(_flatten_epub_toc(entry, epub_module))
    return out


_BLOCK_TAGS_XPATH = (
    ".//p | .//div | .//h1 | .//h2 | .//h3 | .//h4 | .//h5 | .//h6 | "
    ".//li | .//blockquote | .//pre"
)


def _html_to_text(html_bytes_or_str) -> str:
    import lxml.html as LH

    if not html_bytes_or_str or not html_bytes_or_str.strip():
        return ""
    tree = LH.fromstring(html_bytes_or_str)
    # Block-level text, one per line — text_content() on the whole tree runs
    # paragraphs together with no separator, which reads as one giant blob.
    blocks = tree.xpath(_BLOCK_TAGS_XPATH)
    if not blocks:
        return re.sub(r"\s+", " ", tree.text_content()).strip()
    lines = []
    seen_text_nodes = set()
    for b in blocks:
        # Skip a block whose entire text is already captured by a nested
        # block we'll also visit (e.g. a <div> wrapping <p> tags) — avoids
        # duplicating every paragraph twice.
        txt = b.text_content().strip()
        if not txt:
            continue
        has_block_child = any(child.tag in ("p", "div", "li", "blockquote", "pre",
                                             "h1", "h2", "h3", "h4", "h5", "h6")
                               for child in b.iterdescendants())
        if has_block_child:
            continue
        key = id(b)
        if key in seen_text_nodes:
            continue
        seen_text_nodes.add(key)
        lines.append(re.sub(r"\s+", " ", txt).strip())
    return "\n\n".join(l for l in lines if l)


def _first_heading(html_bytes_or_str) -> str | None:
    import lxml.html as LH

    if not html_bytes_or_str or not html_bytes_or_str.strip():
        return None
    tree = LH.fromstring(html_bytes_or_str)
    for tag in ("h1", "h2"):
        found = tree.xpath(f".//{tag}")
        if found:
            text = found[0].text_content().strip()
            if text:
                return text
    return None


def extract_epub(path: Path) -> list[dict]:
    import ebooklib
    from ebooklib import epub

    book = epub.read_epub(str(path))

    toc_map = {}
    for link in _flatten_epub_toc(book.toc, epub):
        href = (link.href or "").split("#")[0]
        if href and href not in toc_map:
            toc_map[href] = link.title

    chapters = []
    for idref, linear in book.spine:
        if linear == "no":
            continue
        item = book.get_item_with_id(idref)
        if item is None or isinstance(item, epub.EpubNav):
            continue
        if item.get_type() != ebooklib.ITEM_DOCUMENT:
            continue

        content = item.get_content()
        text = _html_to_text(content)
        if not text.strip():
            continue  # blank separator/cover page in the spine — nothing to narrate

        title = toc_map.get(item.get_name()) or _first_heading(content) or f"Chapter {len(chapters) + 1}"
        chapters.append({"title": title.strip(), "text": text})

    return chapters


# ── PDF ───────────────────────────────────────────────────────────────

def extract_pdf(path: Path, title_hint: str = "") -> list[dict]:
    import pymupdf

    doc = pymupdf.open(str(path))
    try:
        toc = [e for e in doc.get_toc() if e[0] == 1]  # top-level bookmarks only

        if not toc:
            # No embedded outline — honest single-chapter fallback, no
            # heading-detection guessing. Caller surfaces this to the user.
            full_text = "\n\n".join(page.get_text() for page in doc)
            if not full_text.strip():
                return []
            return [{"title": title_hint or path.stem, "text": full_text.strip()}]

        chapters = []
        for i, (_level, title, page1based) in enumerate(toc):
            start = page1based - 1
            end = (toc[i + 1][2] - 1) if i + 1 < len(toc) else doc.page_count
            pages_text = "\n\n".join(doc[p].get_text() for p in range(start, max(start, end)))
            if not pages_text.strip():
                continue
            chapters.append({"title": title.strip() or f"Chapter {i + 1}", "text": pages_text.strip()})
        return chapters
    finally:
        doc.close()


def pdf_page_count(path: Path) -> int:
    import pymupdf

    doc = pymupdf.open(str(path))
    try:
        return doc.page_count
    finally:
        doc.close()


def extraction_warning(chapters: list[dict], page_count: int | None = None) -> str | None:
    """A short warning string if extracted text looks suspiciously thin —
    the honest signal for a likely scanned/image-only PDF (no OCR in this
    build) rather than silently producing a near-empty audiobook."""
    total_chars = sum(len(c["text"]) for c in chapters)
    if page_count and page_count > 0 and total_chars < page_count * MIN_CHARS_PER_PAGE_WARNING:
        return (f"Extracted text looks unusually short for a {page_count}-page document "
                f"({total_chars} characters) — this may be a scanned or image-only PDF, "
                f"which this build can't OCR.")
    return None
