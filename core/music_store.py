"""
core/music_store.py — Local Music Library

NYX's own music manager: uploaded audio files live in music/library/,
metadata (tags, duration) is extracted with mutagen and indexed in
memory/music_library.json along with playlists and favorites.

Everything is local. The index schema is versioned so future features
(lyrics, moods, smart playlists, streaming sources) can extend tracks
without a redesign.
"""

import json
import re
import uuid
from datetime import datetime
from pathlib import Path

from utils.logger import get_logger

log = get_logger(__name__)

ROOT_DIR = Path(__file__).parent.parent
MUSIC_DIR = ROOT_DIR / "music" / "library"
INDEX_PATH = ROOT_DIR / "memory" / "music_library.json"

ALLOWED_EXTS = {".mp3", ".flac", ".wav", ".ogg", ".m4a"}
MAX_FILE_MB = 200

MEDIA_TYPES = {
    ".mp3": "audio/mpeg", ".flac": "audio/flac", ".wav": "audio/wav",
    ".ogg": "audio/ogg", ".m4a": "audio/mp4",
}


def _load() -> dict:
    if INDEX_PATH.exists():
        try:
            data = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
            data.setdefault("version", 1)
            data.setdefault("tracks", [])
            data.setdefault("playlists", [])
            data.setdefault("watch_folders", [])
            data.setdefault("imported_paths", {})
            return data
        except (json.JSONDecodeError, OSError) as e:
            log.warning(f"[music_store] Could not read index: {e}")
    return {"version": 1, "tracks": [], "playlists": [], "watch_folders": [], "imported_paths": {}}


def _save(data: dict) -> None:
    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    INDEX_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _extract_metadata(path: Path, fallback_stem: str | None = None) -> dict:
    """Tags + duration via mutagen; falls back to 'Artist - Title' parsing of
    the ORIGINAL filename (the stored one carries a uuid prefix)."""
    stem = fallback_stem or path.stem
    title, artist, album, duration = stem, "", "", None
    try:
        import mutagen
        m = mutagen.File(str(path), easy=True)
        if m is not None:
            if m.info and getattr(m.info, "length", None):
                duration = round(m.info.length)
            tags = m.tags or {}
            def first(key):
                v = tags.get(key)
                return str(v[0]).strip() if v else ""
            title  = first("title")  or title
            artist = first("artist")
            album  = first("album")
    except Exception as e:
        log.warning(f"[music_store] Metadata extraction failed for {path.name}: {e}")

    if not artist and " - " in stem:
        maybe_artist, maybe_title = stem.split(" - ", 1)
        artist = maybe_artist.strip()
        if title == stem:
            title = maybe_title.strip()

    return {"title": title, "artist": artist, "album": album, "duration": duration}


# ── Tracks ────────────────────────────────────────────────────────────

def list_tracks() -> list[dict]:
    return _load()["tracks"]


def get_track(track_id: str) -> dict | None:
    return next((t for t in _load()["tracks"] if t["id"] == track_id), None)


def track_path(track: dict) -> Path:
    return MUSIC_DIR / track["filename"]


def add_track(original_name: str, content: bytes) -> dict:
    ext = Path(original_name).suffix.lower()
    if ext not in ALLOWED_EXTS:
        raise ValueError(f"Unsupported format '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTS))}")
    if len(content) > MAX_FILE_MB * 1024 * 1024:
        raise ValueError(f"File is over the {MAX_FILE_MB}MB limit.")

    MUSIC_DIR.mkdir(parents=True, exist_ok=True)
    track_id = uuid.uuid4().hex[:12]
    safe_stem = re.sub(r"[^\w\-. ]", "_", Path(original_name).stem)[:80]
    filename = f"{track_id}_{safe_stem}{ext}"
    dest = MUSIC_DIR / filename
    dest.write_bytes(content)

    meta = _extract_metadata(dest, fallback_stem=Path(original_name).stem)
    track = {
        "id": track_id,
        "filename": filename,
        "original_name": original_name,
        "title": meta["title"],
        "artist": meta["artist"],
        "album": meta["album"],
        "duration": meta["duration"],
        "media_type": MEDIA_TYPES[ext],
        "size_bytes": len(content),
        "added": datetime.now().isoformat(),
        "favorite": False,
        "plays": 0,
    }

    data = _load()
    data["tracks"].append(track)
    _save(data)
    log.info(f"[music_store] Added: {track['title']} ({filename})")
    return track


def delete_track(track_id: str) -> bool:
    data = _load()
    track = next((t for t in data["tracks"] if t["id"] == track_id), None)
    if not track:
        return False
    try:
        # SoundCloud entries have no local file — only local tracks do
        if track.get("filename"):
            p = MUSIC_DIR / track["filename"]
            if p.exists():
                p.unlink()
    except OSError as e:
        log.warning(f"[music_store] Could not remove file: {e}")
    data["tracks"] = [t for t in data["tracks"] if t["id"] != track_id]
    for pl in data["playlists"]:
        pl["track_ids"] = [i for i in pl["track_ids"] if i != track_id]
    _save(data)
    return True


def update_track(track_id: str, updates: dict) -> dict | None:
    allowed = {"favorite", "title", "artist", "album", "plays"}
    data = _load()
    for t in data["tracks"]:
        if t["id"] == track_id:
            for k, v in updates.items():
                if k in allowed:
                    t[k] = v
            _save(data)
            return t
    return None


def find_track(query: str) -> dict | None:
    """Best fuzzy match for voice commands: exact title → title contains →
    'title by artist' → artist contains."""
    q = query.lower().strip().strip('"')
    tracks = list_tracks()
    if not tracks or not q:
        return None

    by_match = re.match(r"(.+?)\s+by\s+(.+)", q)
    if by_match:
        t_part, a_part = by_match.group(1).strip(), by_match.group(2).strip()
        for t in tracks:
            if t_part in t["title"].lower() and a_part in t["artist"].lower():
                return t

    for t in tracks:
        if t["title"].lower() == q:
            return t
    for t in tracks:
        if q in t["title"].lower():
            return t
    for t in tracks:
        if q in t["artist"].lower():
            return t
    return None


# ── Playlists ─────────────────────────────────────────────────────────

def list_playlists() -> list[dict]:
    return _load()["playlists"]


def get_playlist(playlist_id: str) -> dict | None:
    return next((p for p in _load()["playlists"] if p["id"] == playlist_id), None)


def create_playlist(name: str, track_ids: list[str]) -> dict:
    data = _load()
    valid = {t["id"] for t in data["tracks"]}
    playlist = {
        "id": uuid.uuid4().hex[:12],
        "name": name.strip()[:60] or "Untitled",
        "track_ids": [i for i in track_ids if i in valid],
        "banner": None,          # custom banner filename; None → first track's art
        "created": datetime.now().isoformat(),
    }
    data["playlists"].append(playlist)
    _save(data)
    return playlist


def delete_playlist(playlist_id: str) -> bool:
    data = _load()
    pl = next((p for p in data["playlists"] if p["id"] == playlist_id), None)
    if not pl:
        return False
    _remove_banner_file(pl)
    data["playlists"] = [p for p in data["playlists"] if p["id"] != playlist_id]
    _save(data)
    return True


def rename_playlist(playlist_id: str, name: str) -> dict | None:
    data = _load()
    for p in data["playlists"]:
        if p["id"] == playlist_id:
            p["name"] = name.strip()[:60] or p["name"]
            _save(data)
            return p
    return None


def add_to_playlist(playlist_id: str, track_id: str) -> dict | None:
    data = _load()
    valid = {t["id"] for t in data["tracks"]}
    for p in data["playlists"]:
        if p["id"] == playlist_id:
            if track_id in valid and track_id not in p["track_ids"]:
                p["track_ids"].append(track_id)
                _save(data)
            return p
    return None


def remove_from_playlist(playlist_id: str, track_id: str) -> dict | None:
    data = _load()
    for p in data["playlists"]:
        if p["id"] == playlist_id:
            p["track_ids"] = [i for i in p["track_ids"] if i != track_id]
            _save(data)
            return p
    return None


def find_playlist(query: str) -> dict | None:
    q = query.lower().strip()
    return next((p for p in list_playlists() if q in p["name"].lower()), None)


# ── Playlist banners ──────────────────────────────────────────────────
# A playlist's cover defaults to its first track's artwork (SoundCloud-style,
# computed on the frontend). A custom banner overrides that: the user uploads
# any image, stored in music/banners/, and the playlist points at it.

BANNERS_DIR = ROOT_DIR / "music" / "banners"
_BANNER_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
                 ".gif": "image/gif", ".webp": "image/webp"}


def _remove_banner_file(playlist: dict) -> None:
    fn = playlist.get("banner")
    if fn:
        try:
            (BANNERS_DIR / fn).unlink(missing_ok=True)
        except OSError:
            pass


def playlist_banner_path(playlist_id: str) -> Path | None:
    pl = get_playlist(playlist_id)
    if pl and pl.get("banner"):
        p = BANNERS_DIR / pl["banner"]
        return p if p.exists() else None
    return None


def set_playlist_banner(playlist_id: str, original_name: str, content: bytes) -> dict:
    ext = Path(original_name).suffix.lower()
    if ext not in _BANNER_TYPES:
        raise ValueError(f"Unsupported image type '{ext}'. Use JPG, PNG, GIF, or WEBP.")
    if len(content) > 15 * 1024 * 1024:
        raise ValueError("Banner image must be under 15MB.")
    data = _load()
    pl = next((p for p in data["playlists"] if p["id"] == playlist_id), None)
    if not pl:
        raise ValueError("Playlist not found.")
    _remove_banner_file(pl)
    BANNERS_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{playlist_id}{ext}"
    (BANNERS_DIR / filename).write_bytes(content)
    pl["banner"] = filename
    _save(data)
    return pl


def clear_playlist_banner(playlist_id: str) -> dict | None:
    data = _load()
    for p in data["playlists"]:
        if p["id"] == playlist_id:
            _remove_banner_file(p)
            p["banner"] = None
            _save(data)
            return p
    return None


def banner_media_type(playlist_id: str) -> str:
    pl = get_playlist(playlist_id)
    if pl and pl.get("banner"):
        return _BANNER_TYPES.get(Path(pl["banner"]).suffix.lower(), "image/jpeg")
    return "image/jpeg"


# ── Watch folders ─────────────────────────────────────────────────────
# Folders NYX scans for new audio files; found files are COPIED into the
# library (originals untouched) and remembered by (path, mtime) so nothing
# imports twice.

def list_watch_folders() -> list[str]:
    return _load()["watch_folders"]


def add_watch_folder(path_str: str) -> list[str]:
    p = Path(path_str).expanduser()
    if not p.exists() or not p.is_dir():
        raise ValueError(f"'{path_str}' doesn't exist or isn't a folder.")
    data = _load()
    resolved = str(p.resolve())
    if resolved not in data["watch_folders"]:
        data["watch_folders"].append(resolved)
        _save(data)
        log.info(f"[music_store] Watching: {resolved}")
    return data["watch_folders"]


def remove_watch_folder(path_str: str) -> list[str]:
    data = _load()
    data["watch_folders"] = [f for f in data["watch_folders"] if f.lower() != path_str.lower()]
    _save(data)
    return data["watch_folders"]


def scan_folder(path_str: str, remember: bool = True) -> list[dict]:
    """Import every not-yet-imported audio file in a folder (recursive).
    Returns the newly added tracks."""
    p = Path(path_str).expanduser()
    if not p.exists() or not p.is_dir():
        return []

    data = _load()
    imported = data["imported_paths"]
    added = []

    for f in sorted(p.rglob("*")):
        if not f.is_file() or f.suffix.lower() not in ALLOWED_EXTS:
            continue
        # Never re-import our own library folder
        try:
            if MUSIC_DIR.resolve() in f.resolve().parents:
                continue
        except OSError:
            continue
        try:
            key = str(f.resolve())
            mtime = f.stat().st_mtime
        except OSError:
            continue
        if imported.get(key) == mtime:
            continue
        try:
            if f.stat().st_size > MAX_FILE_MB * 1024 * 1024:
                continue
            track = add_track(f.name, f.read_bytes())
            added.append(track)
            if remember:
                # Re-read: add_track saved the index; keep our registry in sync
                data = _load()
                data["imported_paths"][key] = mtime
                _save(data)
        except (ValueError, OSError) as e:
            log.warning(f"[music_store] Skipped {f.name}: {e}")

    if added:
        log.info(f"[music_store] Watch scan imported {len(added)} file(s) from {p}")
    return added


def scan_all_watch_folders() -> list[dict]:
    added = []
    for folder in list_watch_folders():
        added.extend(scan_folder(folder))
    return added


# ── SoundCloud links ──────────────────────────────────────────────────
# Saved via SoundCloud's open oEmbed endpoint (no API key). The entry is a
# normal library track with source="soundcloud" — the browser player streams
# it through SoundCloud's embedded widget instead of a local file.

def add_soundcloud_track(url: str) -> dict:
    import requests

    url = url.strip().split("?")[0]
    if not re.match(r"^https?://(www\.|on\.|m\.)?soundcloud\.com/.+", url):
        raise ValueError("That doesn't look like a SoundCloud link.")

    data = _load()
    existing = next((t for t in data["tracks"] if t.get("url") == url), None)
    if existing:
        return existing

    try:
        r = requests.get(
            "https://soundcloud.com/oembed",
            params={"url": url, "format": "json"},
            timeout=10, headers={"User-Agent": "Nyx/1.0"},
        )
        r.raise_for_status()
        info = r.json()
    except Exception as e:
        raise ValueError(f"SoundCloud couldn't resolve that link ({e}). Is the track public?")

    title = re.sub(r"\s+by\s+[^)]*$", "", info.get("title", "")).strip() or url.rsplit("/", 1)[-1]
    is_playlist = "/sets/" in url or "playlist" in (info.get("html") or "")

    track = {
        "id": uuid.uuid4().hex[:12],
        "source": "soundcloud",
        "url": url,
        "sc_kind": "playlist" if is_playlist else "track",
        "title": title,
        "artist": info.get("author_name", ""),
        "album": "SoundCloud",
        "artwork_url": info.get("thumbnail_url"),
        "duration": None,
        "media_type": "soundcloud",
        "added": datetime.now().isoformat(),
        "favorite": False,
        "plays": 0,
    }
    data["tracks"].append(track)
    _save(data)
    log.info(f"[music_store] SoundCloud saved: {track['title']}")
    return track
