"""
tools/system/music_control.py — Voice/Chat Control for the NYX Music Player

The actual player lives in the browser (the Music page's persistent audio
engine). This module parses natural-language commands and pushes them to
connected dashboards over the voice WebSocket:

    "play after dark"          → play that library track
    "pause the music" / "skip" → transport controls
    "shuffle my favorites"     → queue building
    "play my coding playlist"  → playlist by name
    "volume to 30 percent"     → volume

ui/server.py registers the broadcaster at startup. If no dashboard is
connected (or NYX runs headless), try_handle returns None so the message
falls through to the old system-wide media keys via the router.
"""

import re

from utils.logger import get_logger

log = get_logger(__name__)

_broadcast = None      # callable(dict) — set by ui/server.py at startup
_has_clients = None    # callable() -> bool


def register(broadcast, has_clients) -> None:
    global _broadcast, _has_clients
    _broadcast = broadcast
    _has_clients = has_clients


def _ready() -> bool:
    return _broadcast is not None and _has_clients is not None and _has_clients()


def _send(action: str, **kw) -> None:
    log.info(f"[music_control] → {action} {kw or ''}")
    _broadcast({"action": action, **kw})


_VOLUME_RE = re.compile(
    r"\b(?:set|turn)?\s*(?:the\s+)?volume\s+(?:to|at)\s+(\d{1,3})\s*(?:percent|%)?", re.I)
_PLAY_PLAYLIST_RE = re.compile(
    r"\bplay\s+(?:my\s+)?(.{1,50}?)\s+playlist\b", re.I)
_PLAY_RE = re.compile(
    r"^(?:can you |please |nyx )?play\s+(.+?)[.!?]?$", re.I)

_PAUSE_PATTERNS  = ["pause the music", "pause music", "pause the song", "pause playback", "pause it"]
_RESUME_PATTERNS = ["resume the music", "resume music", "resume playback", "unpause", "resume the song", "keep playing"]
_NEXT_PATTERNS   = ["skip this song", "skip song", "skip the song", "next song", "next track", "skip it", "play the next"]
_PREV_PATTERNS   = ["previous song", "previous track", "go back a song", "last song", "play that again"]
_STOP_PATTERNS   = ["stop the music", "stop playback", "shut down the music", "shut down after queue"]
_MUTE_PATTERNS   = ["mute the music", "mute music", "mute it"]
_FAVS_PATTERNS   = ["play my liked songs", "play my favorites", "play my favourites",
                    "shuffle my favorites", "shuffle my favourites", "play liked songs"]
_SHUFFLE_ALL     = ["shuffle everything", "shuffle all", "shuffle my music", "shuffle my library",
                    "play something", "play some music", "play anything"]


def try_handle(text: str) -> str | None:
    """Handle a music command; None if it isn't one (or no player is open)."""
    if not _ready():
        return None

    lower = text.lower().strip()

    m = _VOLUME_RE.search(lower)
    if m:
        vol = max(0, min(100, int(m.group(1))))
        _send("volume", value=vol)
        return f"Volume set to {vol}%."

    if any(p in lower for p in _MUTE_PATTERNS):
        _send("mute")
        return "Muted the music."

    if any(p in lower for p in _PAUSE_PATTERNS):
        _send("pause")
        return "Paused."

    if any(p in lower for p in _RESUME_PATTERNS):
        _send("resume")
        return "Resuming."

    if any(p in lower for p in _NEXT_PATTERNS):
        _send("next")
        return "Skipping."

    if any(p in lower for p in _PREV_PATTERNS):
        _send("previous")
        return "Going back a track."

    if any(p in lower for p in _STOP_PATTERNS):
        _send("stop")
        return "Stopping the music."

    if any(p in lower for p in _FAVS_PATTERNS):
        _send("play_favorites", shuffle=True)
        return "Playing your liked songs."

    if any(p in lower for p in _SHUFFLE_ALL) or re.search(
            r"\bplay something (relaxing|chill|calm|to focus|for focus|upbeat|energetic)\b", lower):
        _send("shuffle_all")
        return "Shuffling your library."

    m = _PLAY_PLAYLIST_RE.search(lower)
    if m:
        from core import music_store
        pl = music_store.find_playlist(m.group(1))
        if pl:
            if not pl["track_ids"]:
                return f"Your '{pl['name']}' playlist is empty."
            _send("play_playlist", playlist_id=pl["id"])
            return f"Playing your {pl['name']} playlist."
        return f"[Nyx] I couldn't find a playlist matching '{m.group(1)}'."

    m = _PLAY_RE.match(text.strip())
    if m:
        query = m.group(1).strip()
        # "play music" alone → resume if paused, else shuffle
        if query.lower() in ("music", "the music", "a song", "songs"):
            _send("play_music")
            return "Playing."
        from core import music_store
        track = music_store.find_track(query)
        if track:
            _send("play_track", track_id=track["id"])
            by = f" by {track['artist']}" if track["artist"] else ""
            return f"Playing {track['title']}{by}."
        # Not in the library — let the router/media keys/LLM have it
        return None

    return None
