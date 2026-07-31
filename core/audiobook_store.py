"""
core/audiobook_store.py — Local Audiobook Library

NYX's audiobook manager: uploaded/generated chapter audio lives in
audiobooks/library/, book covers in audiobooks/covers/, uploaded source
documents (epub/pdf) in audiobooks/sources/, and the index (books,
collections, voice blends, generation jobs) is memory/audiobook_library.json.

Mirrors core/music_store.py's shape (flat JSON-index CRUD, no classes) but
adds the concepts audiobooks need that tracks never did: ordered chapters
with per-chapter status, a resume position, and TTS voice/blend selection.

Built-in Kokoro voice names are NOT stored here — they come live from
core/tts_engine.list_builtin_voices(). Only user-created voice blends persist.
"""

import json
import re
import uuid
from datetime import datetime
from pathlib import Path

from utils.logger import get_logger

log = get_logger(__name__)

ROOT_DIR = Path(__file__).parent.parent
LIBRARY_DIR = ROOT_DIR / "audiobooks" / "library"
COVERS_DIR = ROOT_DIR / "audiobooks" / "covers"
SOURCES_DIR = ROOT_DIR / "audiobooks" / "sources"
INDEX_PATH = ROOT_DIR / "memory" / "audiobook_library.json"

ALLOWED_AUDIO_EXTS = {".mp3", ".flac", ".wav", ".ogg", ".m4a", ".m4b"}
MAX_FILE_MB = 1024

AUDIO_MEDIA_TYPES = {
    ".mp3": "audio/mpeg", ".flac": "audio/flac", ".wav": "audio/wav",
    ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".m4b": "audio/mp4",
}

_IMAGE_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
                ".gif": "image/gif", ".webp": "image/webp"}

VALID_JOB_STATUSES = {"PENDING", "IN_PROGRESS", "COMPLETE", "FAILED", "CANCELLED"}
VALID_CHAPTER_STATUSES = {"pending", "generating", "done", "failed"}
MAX_KEPT_JOBS = 20


def _load() -> dict:
    if INDEX_PATH.exists():
        try:
            data = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
            data.setdefault("version", 1)
            data.setdefault("books", [])
            data.setdefault("collections", [])
            data.setdefault("voices", {"blends": []})
            data.setdefault("jobs", [])
            return data
        except (json.JSONDecodeError, OSError) as e:
            log.warning(f"[audiobook_store] Could not read index: {e}")
    return {"version": 1, "books": [], "collections": [], "voices": {"blends": []}, "jobs": []}


def _save(data: dict) -> None:
    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    INDEX_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _extract_audio_metadata(path: Path, fallback_stem: str | None = None) -> dict:
    """Tags + duration via mutagen, same approach as music_store."""
    stem = fallback_stem or path.stem
    title, duration = stem, None
    try:
        import mutagen
        m = mutagen.File(str(path), easy=True)
        if m is not None:
            if m.info and getattr(m.info, "length", None):
                duration = round(m.info.length)
            tags = m.tags or {}
            v = tags.get("title")
            if v:
                title = str(v[0]).strip()
    except Exception as e:
        log.warning(f"[audiobook_store] Metadata extraction failed for {path.name}: {e}")
    return {"title": title, "duration": duration}


# ── Books ─────────────────────────────────────────────────────────────

def list_books() -> list[dict]:
    return _load()["books"]


def get_book(book_id: str) -> dict | None:
    return next((b for b in _load()["books"] if b["id"] == book_id), None)


def chapter_path(book: dict, chapter_index: int) -> Path:
    return LIBRARY_DIR / book["chapters"][chapter_index]["filename"]


def create_book_shell(title: str, author: str = "", source_type: str = "uploaded_audio",
                       source_format: str = "audio", source_filename: str | None = None,
                       voice_id: str | None = None, voice_blend_id: str | None = None) -> dict:
    """Creates a book with no chapters yet — caller appends chapters via
    add_uploaded_chapter (audio) or add_text_chapter (extracted text, pending generation)."""
    book = {
        "id": uuid.uuid4().hex[:12],
        "title": title.strip()[:200] or "Untitled",
        "author": author.strip()[:200],
        "cover": None,
        "source_type": source_type,
        "source_format": source_format,
        "source_filename": source_filename,
        "chapters": [],
        "position_seconds": 0.0,
        "position_chapter": 0,
        "voice_id": voice_id,
        "voice_blend_id": voice_blend_id,
        "media_type": None,
        "added": datetime.now().isoformat(),
        "favorite": False,
        "collection_ids": [],
    }
    data = _load()
    data["books"].append(book)
    _save(data)
    log.info(f"[audiobook_store] Created book shell: {book['title']} ({book['id']})")
    return book


def add_uploaded_chapter(book_id: str, original_name: str, content: bytes) -> dict | None:
    """Uploaded-audio path: one file = one chapter, mutagen-tagged like Music."""
    ext = Path(original_name).suffix.lower()
    if ext not in ALLOWED_AUDIO_EXTS:
        raise ValueError(f"Unsupported format '{ext}'. Allowed: {', '.join(sorted(ALLOWED_AUDIO_EXTS))}")
    if len(content) > MAX_FILE_MB * 1024 * 1024:
        raise ValueError(f"File is over the {MAX_FILE_MB}MB limit.")

    data = _load()
    book = next((b for b in data["books"] if b["id"] == book_id), None)
    if not book:
        return None

    LIBRARY_DIR.mkdir(parents=True, exist_ok=True)
    chapter_index = len(book["chapters"])
    safe_stem = re.sub(r"[^\w\-. ]", "_", Path(original_name).stem)[:80]
    filename = f"{book_id}_ch{chapter_index:03d}_{safe_stem}{ext}"
    dest = LIBRARY_DIR / filename
    dest.write_bytes(content)

    meta = _extract_audio_metadata(dest, fallback_stem=Path(original_name).stem)
    chapter = {
        "index": chapter_index,
        "title": meta["title"],
        "filename": filename,
        "duration": meta["duration"],
        "text": None,
        "status": "done",
    }
    book["chapters"].append(chapter)
    book["media_type"] = AUDIO_MEDIA_TYPES[ext]
    _save(data)
    log.info(f"[audiobook_store] Added chapter {chapter_index} to {book['title']}: {filename}")
    return book


def add_text_chapter(book_id: str, title: str, text: str) -> dict | None:
    """Text-generation path: chapter has text but no audio yet (status=pending)."""
    data = _load()
    book = next((b for b in data["books"] if b["id"] == book_id), None)
    if not book:
        return None
    chapter_index = len(book["chapters"])
    book["chapters"].append({
        "index": chapter_index,
        "title": title.strip()[:200] or f"Chapter {chapter_index + 1}",
        "filename": None,
        "duration": None,
        "text": text,
        "status": "pending",
    })
    _save(data)
    return book


def set_chapter_status(book_id: str, chapter_index: int, status: str, error: str | None = None) -> dict | None:
    if status not in VALID_CHAPTER_STATUSES:
        raise ValueError(f"Invalid chapter status '{status}'")
    data = _load()
    book = next((b for b in data["books"] if b["id"] == book_id), None)
    if not book or chapter_index >= len(book["chapters"]):
        return None
    book["chapters"][chapter_index]["status"] = status
    if error is not None:
        book["chapters"][chapter_index]["error"] = error
    _save(data)
    return book


def set_chapter_result(book_id: str, chapter_index: int, filename: str, duration: float) -> dict | None:
    """Called by the generation job after a chapter finishes synthesizing."""
    data = _load()
    book = next((b for b in data["books"] if b["id"] == book_id), None)
    if not book or chapter_index >= len(book["chapters"]):
        return None
    ch = book["chapters"][chapter_index]
    ch["filename"] = filename
    ch["duration"] = duration
    ch["status"] = "done"
    ch.pop("error", None)
    if not book.get("media_type"):
        book["media_type"] = AUDIO_MEDIA_TYPES.get(Path(filename).suffix.lower(), "audio/wav")
    _save(data)
    return book


def update_book(book_id: str, updates: dict) -> dict | None:
    allowed = {"title", "author", "favorite", "voice_id", "voice_blend_id"}
    data = _load()
    for b in data["books"]:
        if b["id"] == book_id:
            for k, v in updates.items():
                if k in allowed:
                    b[k] = v
            _save(data)
            return b
    return None


def delete_book(book_id: str) -> bool:
    data = _load()
    book = next((b for b in data["books"] if b["id"] == book_id), None)
    if not book:
        return False
    for ch in book["chapters"]:
        if ch.get("filename"):
            try:
                (LIBRARY_DIR / ch["filename"]).unlink(missing_ok=True)
            except OSError as e:
                log.warning(f"[audiobook_store] Could not remove chapter file: {e}")
    _clear_image_file(book.get("cover"), COVERS_DIR)
    if book.get("source_filename"):
        try:
            (SOURCES_DIR / book["source_filename"]).unlink(missing_ok=True)
        except OSError:
            pass
    data["books"] = [b for b in data["books"] if b["id"] != book_id]
    for c in data["collections"]:
        c["book_ids"] = [i for i in c["book_ids"] if i != book_id]
    _save(data)
    return True


def update_position(book_id: str, position_seconds: float, chapter_index: int) -> dict | None:
    data = _load()
    for b in data["books"]:
        if b["id"] == book_id:
            b["position_seconds"] = float(position_seconds)
            b["position_chapter"] = int(chapter_index)
            _save(data)
            return b
    return None


def find_book(query: str) -> dict | None:
    """Fuzzy match for voice commands, same shape as music_store.find_track."""
    q = query.lower().strip().strip('"')
    books = list_books()
    if not books or not q:
        return None
    for b in books:
        if b["title"].lower() == q:
            return b
    for b in books:
        if q in b["title"].lower():
            return b
    for b in books:
        if q in b.get("author", "").lower():
            return b
    return None


# ── Book covers ───────────────────────────────────────────────────────

def _set_image(item: dict, images_dir: Path, id_prefix: str, original_name: str, content: bytes) -> str:
    """Generic image set: validates type/size, writes file, returns the stored filename.
    Shared by book covers and collection banners so neither duplicates the other."""
    ext = Path(original_name).suffix.lower()
    if ext not in _IMAGE_TYPES:
        raise ValueError(f"Unsupported image type '{ext}'. Use JPG, PNG, GIF, or WEBP.")
    if len(content) > 15 * 1024 * 1024:
        raise ValueError("Image must be under 15MB.")
    _clear_image_file(item.get("cover") or item.get("banner"), images_dir)
    images_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{id_prefix}{ext}"
    (images_dir / filename).write_bytes(content)
    return filename


def _clear_image_file(filename: str | None, images_dir: Path) -> None:
    if filename:
        try:
            (images_dir / filename).unlink(missing_ok=True)
        except OSError:
            pass


def _image_media_type(filename: str | None) -> str:
    if filename:
        return _IMAGE_TYPES.get(Path(filename).suffix.lower(), "image/jpeg")
    return "image/jpeg"


def set_book_cover(book_id: str, original_name: str, content: bytes) -> dict:
    data = _load()
    book = next((b for b in data["books"] if b["id"] == book_id), None)
    if not book:
        raise ValueError("Book not found.")
    book["cover"] = _set_image(book, COVERS_DIR, book_id, original_name, content)
    _save(data)
    return book


def clear_book_cover(book_id: str) -> dict | None:
    data = _load()
    for b in data["books"]:
        if b["id"] == book_id:
            _clear_image_file(b.get("cover"), COVERS_DIR)
            b["cover"] = None
            _save(data)
            return b
    return None


def book_cover_path(book_id: str) -> Path | None:
    book = get_book(book_id)
    if book and book.get("cover"):
        p = COVERS_DIR / book["cover"]
        return p if p.exists() else None
    return None


def book_cover_media_type(book_id: str) -> str:
    book = get_book(book_id)
    return _image_media_type(book.get("cover") if book else None)


# ── Collections ───────────────────────────────────────────────────────

def list_collections() -> list[dict]:
    return _load()["collections"]


def get_collection(collection_id: str) -> dict | None:
    return next((c for c in _load()["collections"] if c["id"] == collection_id), None)


def create_collection(name: str, book_ids: list[str]) -> dict:
    data = _load()
    valid = {b["id"] for b in data["books"]}
    collection = {
        "id": uuid.uuid4().hex[:12],
        "name": name.strip()[:60] or "Untitled",
        "book_ids": [i for i in book_ids if i in valid],
        "banner": None,
        "created": datetime.now().isoformat(),
    }
    data["collections"].append(collection)
    for bid in collection["book_ids"]:
        book = next((b for b in data["books"] if b["id"] == bid), None)
        if book and collection["id"] not in book["collection_ids"]:
            book["collection_ids"].append(collection["id"])
    _save(data)
    return collection


def delete_collection(collection_id: str) -> bool:
    data = _load()
    c = next((c for c in data["collections"] if c["id"] == collection_id), None)
    if not c:
        return False
    _clear_image_file(c.get("banner"), COVERS_DIR)
    data["collections"] = [c for c in data["collections"] if c["id"] != collection_id]
    for b in data["books"]:
        b["collection_ids"] = [i for i in b["collection_ids"] if i != collection_id]
    _save(data)
    return True


def rename_collection(collection_id: str, name: str) -> dict | None:
    data = _load()
    for c in data["collections"]:
        if c["id"] == collection_id:
            c["name"] = name.strip()[:60] or c["name"]
            _save(data)
            return c
    return None


def add_to_collection(collection_id: str, book_id: str) -> dict | None:
    data = _load()
    valid = {b["id"] for b in data["books"]}
    for c in data["collections"]:
        if c["id"] == collection_id:
            if book_id in valid and book_id not in c["book_ids"]:
                c["book_ids"].append(book_id)
                book = next((b for b in data["books"] if b["id"] == book_id), None)
                if book and collection_id not in book["collection_ids"]:
                    book["collection_ids"].append(collection_id)
                _save(data)
            return c
    return None


def remove_from_collection(collection_id: str, book_id: str) -> dict | None:
    data = _load()
    for c in data["collections"]:
        if c["id"] == collection_id:
            c["book_ids"] = [i for i in c["book_ids"] if i != book_id]
            book = next((b for b in data["books"] if b["id"] == book_id), None)
            if book:
                book["collection_ids"] = [i for i in book["collection_ids"] if i != collection_id]
            _save(data)
            return c
    return None


def set_collection_banner(collection_id: str, original_name: str, content: bytes) -> dict:
    data = _load()
    c = next((c for c in data["collections"] if c["id"] == collection_id), None)
    if not c:
        raise ValueError("Collection not found.")
    c["banner"] = _set_image(c, COVERS_DIR, f"col_{collection_id}", original_name, content)
    _save(data)
    return c


def clear_collection_banner(collection_id: str) -> dict | None:
    data = _load()
    for c in data["collections"]:
        if c["id"] == collection_id:
            _clear_image_file(c.get("banner"), COVERS_DIR)
            c["banner"] = None
            _save(data)
            return c
    return None


def collection_banner_path(collection_id: str) -> Path | None:
    c = get_collection(collection_id)
    if c and c.get("banner"):
        p = COVERS_DIR / c["banner"]
        return p if p.exists() else None
    return None


def collection_banner_media_type(collection_id: str) -> str:
    c = get_collection(collection_id)
    return _image_media_type(c.get("banner") if c else None)


# ── Voice blends (built-in voice list lives in core/tts_engine.py) ─────

def list_voice_blends() -> list[dict]:
    return _load()["voices"]["blends"]


def get_voice_blend(blend_id: str) -> dict | None:
    return next((v for v in _load()["voices"]["blends"] if v["id"] == blend_id), None)


def create_voice_blend(name: str, components: list[dict]) -> dict:
    if len(components) < 2:
        raise ValueError("A blend needs at least 2 component voices.")
    total = sum(float(c["weight"]) for c in components)
    if total <= 0:
        raise ValueError("Component weights must sum to more than 0.")
    normalized = [{"voice": c["voice"], "weight": float(c["weight"]) / total} for c in components]
    blend = {
        "id": uuid.uuid4().hex[:12],
        "name": name.strip()[:60] or "Untitled Blend",
        "components": normalized,
        "created": datetime.now().isoformat(),
    }
    data = _load()
    data["voices"]["blends"].append(blend)
    _save(data)
    return blend


def delete_voice_blend(blend_id: str) -> bool:
    data = _load()
    blends = data["voices"]["blends"]
    if not any(v["id"] == blend_id for v in blends):
        return False
    data["voices"]["blends"] = [v for v in blends if v["id"] != blend_id]
    _save(data)
    return True


# ── Generation jobs ──────────────────────────────────────────────────

def create_job(book_id: str, total_chapters: int) -> dict:
    job = {
        "id": f"j-{uuid.uuid4().hex[:10]}",
        "book_id": book_id,
        "status": "PENDING",
        "pct": 0,
        "current_chapter": None,
        "total_chapters": total_chapters,
        "error": None,
        "created": datetime.now().isoformat(),
        "updated": datetime.now().isoformat(),
    }
    data = _load()
    data["jobs"].append(job)
    _prune_jobs(data)
    _save(data)
    return job


def update_job(job_id: str, updates: dict) -> dict | None:
    allowed = {"status", "pct", "current_chapter", "error"}
    data = _load()
    for j in data["jobs"]:
        if j["id"] == job_id:
            for k, v in updates.items():
                if k in allowed:
                    j[k] = v
            j["updated"] = datetime.now().isoformat()
            _save(data)
            return j
    return None


def get_job(job_id: str) -> dict | None:
    return next((j for j in _load()["jobs"] if j["id"] == job_id), None)


def list_jobs(book_id: str | None = None) -> list[dict]:
    jobs = _load()["jobs"]
    return [j for j in jobs if j["book_id"] == book_id] if book_id else jobs


def _prune_jobs(data: dict) -> None:
    """Keep the job list bounded — completed/failed/cancelled jobs beyond
    MAX_KEPT_JOBS (oldest first) are dropped. Music has no equivalent
    unbounded-growth list; jobs are the one thing here that accumulates
    over time without an explicit delete action from the user."""
    jobs = data["jobs"]
    if len(jobs) <= MAX_KEPT_JOBS:
        return
    active = [j for j in jobs if j["status"] in ("PENDING", "IN_PROGRESS")]
    finished = [j for j in jobs if j["status"] not in ("PENDING", "IN_PROGRESS")]
    finished.sort(key=lambda j: j["updated"], reverse=True)
    data["jobs"] = active + finished[: max(0, MAX_KEPT_JOBS - len(active))]
