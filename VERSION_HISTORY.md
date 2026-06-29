# Version History

NYX uses Git tags for versioning — `main` gets a version every time something
ships, and `laptop-lite` gets a matching `-lite` tag whenever it catches up
to main (it doesn't tick its own independent number line, since it's meant
to track main exactly except for lighter defaults).

To check out any version: `git checkout v1.6` (or `git checkout v1.6-lite`).

| Main | laptop-lite | What shipped |
|---|---|---|
| v1.0 | | Initial commit |
| v1.1 | | Model Manager: Ollama detection, categorization, role assignment, streaming pull/delete |
| v1.2 | v1.2-lite | Windows system tray app (start/stop/open dashboard) — **laptop-lite branches off here** with smaller default models + reduced polling |
| v1.3 | | Full README (setup, hardware recs, model install guide) |
| v1.4 | v1.4-lite | Real Model Manager dashboard page; proper URL routing + SPA fallback |
| v1.5 | v1.5-lite | Clarified Obsidian is optional, not required |
| v1.6 | v1.6-lite | Extensible provider system: Storage/Memory selector, AI Models panel, Tools/Extensions |
| v1.7 | v1.7-lite | Provider Settings UI polish: active-provider banner, confirm-before-switch modal |
| v1.8 | v1.8-lite | Tray app detects/manages NYX regardless of how it was started; Start Menu/Desktop shortcuts |
| v1.9 | v1.9-lite | Tray app single-instance lock |
| v1.10 | v1.10-lite | Tray icon status display fix (accurate Running/Stopped) |
| v1.11 | | Tray app opens a real native window (pywebview/WebView2) instead of a browser tab |
| v1.12 | v1.12-lite | Replaced every remaining placeholder with real functionality (Voice, Notifications, Privacy, Backup, Logs, Tasks, Reminders, etc.) |
| v1.13 | v1.13-lite | Added RELEASE_CHECKLIST.md |
| v1.14 | v1.14-lite | Fixed ~2s delay on every Ollama call (`localhost` → `127.0.0.1`) — found via the release checklist pass |

Blank cells under "laptop-lite" mean that version landed on `main` and got folded into the *next* laptop-lite catch-up merge rather than getting its own tag (e.g. v1.11's native window work shipped to laptop-lite together with v1.12, both arriving in the same merge — so there's no separate "v1.11-lite").

## Tagging convention going forward

- Every meaningful push to `main` gets the next `vX.Y` tag.
- After merging `main` into `laptop-lite` (see [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) — always test before tagging), tag that merge commit `vX.Y-lite` matching whichever main version it just caught up to.
- Tags are annotated (`git tag -a`) with a one-line description of what shipped, so `git tag -l -n1` gives a readable changelog without opening GitHub.
