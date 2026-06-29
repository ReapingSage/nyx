# NYX Release Checklist

Walk through every section below before calling a build ready. Check items off as you confirm them — don't skip ahead based on "it probably still works."

## Pre-flight

- [ ] `pip install -r requirements.txt` completes with no errors
- [ ] `cd nyx_frontend && npm install && npm run build` completes with no errors
- [ ] Ollama is installed and running (`ollama list` returns without error)
- [ ] At least one model is installed (`ollama list` shows ≥1 entry)
- [ ] Backend starts cleanly: `python -m uvicorn ui.server:app --port 8000` → "Application startup complete", no traceback
- [ ] `curl http://127.0.0.1:8000/api/status` returns 200 instantly (not a multi-second hang — a hang means something is blocking the event loop)

---

## 1. Tray App

**What it does:** System tray icon (pystray) that runs in the background, shows whether NYX is running, and starts/stops/opens it.

**How to test:**
- [ ] Launch via `pythonw tray/tray_app.py` (or the Desktop/Start Menu shortcut) — no console window should flash up
- [ ] Find the icon in the tray (check the `^` hidden-icons overflow if it's not immediately visible)
- [ ] Hover it — tooltip should say "NYX — Running" or "NYX — Stopped" matching reality
- [ ] Right-click → confirm menu shows: Status line, Start NYX, Stop NYX, Open NYX, Open Settings, Open Model Manager, Exit
- [ ] Click **Stop NYX** → status flips to Stopped within ~5s (background refresh loop), backend process actually exits
- [ ] Click **Start NYX** → status flips to Running, backend actually comes back up
- [ ] With NYX already running, launch `tray_app.py` a second time → should show a **"NYX is already running"** message box, not a second tray icon
- [ ] Start the backend manually in a terminal (`python -m uvicorn ui.server:app --port 8000`) without the tray app, *then* launch the tray app → status should say Running immediately (it must detect externally-started instances, not just ones it spawned itself)
- [ ] With an externally-started backend, click **Stop NYX** from the tray → it should actually find and stop that process (and its `--reload` child, if any), not silently no-op
- [ ] Click **Exit** → tray icon disappears; if the tray app itself started the backend, the backend stops too; if you started the backend yourself in a terminal, Exit should leave it running

**Passing:** Exactly one tray icon ever exists at a time. Status always matches reality. No duplicate backend processes are ever spawned. Start Menu/Desktop shortcuts launch with no console flash.

---

## 2. Native Window

**What it does:** Opens the dashboard in a real OS window (pywebview/WebView2) instead of a browser tab.

**How to test:**
- [ ] Launching the tray app opens a window titled "NYX" automatically
- [ ] From the tray menu, **Open Settings** navigates the *same* window to the Settings page (no new browser tab, no second window)
- [ ] **Open Model Manager** navigates the same window to `/models`
- [ ] Click the window's **X** (close) button → window disappears, but the tray icon is still there and still says "Running"
- [ ] Click **Open NYX** from the tray after closing the window → window reappears
- [ ] Confirm no `msedge.exe`/`chrome.exe`/default-browser process ever opens as a side effect of any of the above
- [ ] **Exit** from the tray fully closes the window and ends the process

**Passing:** Nothing ever opens in a regular browser tab. Closing the window ≠ quitting the app. Exit is the only thing that fully tears it down.

---

## 3. Chat

**What it does:** Core conversation loop — routes your message to a model (or OpenClaw for desktop actions), gets a reply, saves it to memory.

**How to test:**
- [ ] Send a simple message — reply arrives, and the app stays responsive to other clicks *while waiting* (this was a real bug: a slow Ollama reply used to freeze the entire server)
- [ ] Send a coding-flavored question ("fix this python function...") — check `logs/nyx.log` or console for `routing -> <coder model>`
- [ ] Send "remember that I prefer dark mode" — confirm a new line appears in `NYX_VAULT/Memory/auto.md` (or your connected Obsidian vault's equivalent path)
- [ ] With Settings → Privacy → "Block Dangerous Actions" **off**, send a message containing a flagged phrase (e.g. "sudo") — should get a normal response with a console warning, not a refusal
- [ ] Turn "Block Dangerous Actions" **on**, repeat the same message — should get an explicit refusal response, not routed to a model at all

**Passing:** Replies arrive without freezing the app. Routing matches the message type. Memory triggers actually write to disk. Privacy toggle changes real behavior, not just a stored preference.

---

## 4. Ollama

**What it does:** The local LLM runtime NYX talks to over HTTP at `OLLAMA_BASE_URL` (default `http://localhost:11434`).

**How to test:**
- [ ] `ollama list` in a terminal matches what Model Manager shows installed
- [ ] Settings → Providers → AI Models shows "ACTIVE" with green dot while Ollama is running
- [ ] Stop the Ollama service, refresh Model Manager / AI Models panel → status flips to OFFLINE within the page's poll interval, no hang
- [ ] Send a chat message while Ollama is stopped → get a clear "[Nyx] Cannot connect to Ollama..." error, not a hang or crash
- [ ] Restart Ollama → status flips back to online on next poll

**Passing:** Status always reflects reality. Going offline never hangs the app — it errors cleanly and recovers automatically once Ollama is back.

---

## 5. Model Manager

**What it does:** Detects Ollama, lists installed models, auto-categorizes them into roles (coding/main/fast), lets you reassign roles, pull new models with live progress, and delete models.

**How to test:**
- [ ] `/models` page shows the same model list as `ollama list`
- [ ] Each installed model shows a size and at least one role badge (or "Installed" if unassigned)
- [ ] Reassign a role via its dropdown → refresh the page → assignment persisted (stored in `memory/model_assignments.json`)
- [ ] Pick a small recommended model not yet installed, click Download → progress bar updates with real percentages (not stuck at 0% or jumping straight to 100%)
- [ ] After download completes, the model appears in the installed list without a manual page refresh
- [ ] Delete a model → confirm it disappears from the list *and* from `ollama list`
- [ ] With only one model installed, confirm it's shown as filling all three roles

**Passing:** Everything shown matches actual Ollama state. Pull progress is real and the list auto-refreshes on completion. Role assignments survive a page reload.

---

## 6. Providers

**What it does:** Settings → Providers groups three real subsystems: AI Models, Storage/Memory, and Tools/Extensions.

**How to test:**
- [ ] **AI Models** panel's Ollama row shows live status; "Manage" button jumps to Model Manager
- [ ] **Storage/Memory**: clicking the inactive provider card opens a confirmation modal before anything changes — Cancel must leave the active provider untouched
- [ ] Connect to a test folder as the Obsidian provider (path must exist) → confirm switch only succeeds after the modal is confirmed
- [ ] Send a chat message with "remember that..." → confirm the note lands in `<test folder>/Memory/auto.md`, **not** in `NYX_VAULT`
- [ ] Switch back to NYX Local Storage → confirm `NYX_VAULT` content is untouched and new notes resume going there
- [ ] Try connecting to a path that doesn't exist → should be rejected with a clear error, no crash
- [ ] **Tools/Extensions** lists Desktop Automation, Web Tools, System Tools, Coding Tools all marked ACTIVE

**Passing:** Switching providers always asks for confirmation first. Switching redirects future writes only — it never moves, merges, or deletes existing notes in either location.

---

## 7. Settings (general)

**What it does:** The full Settings page — 14 categories, each either a real working panel or honestly disclosed.

**How to test, per category:**
- [ ] **Appearance** — change a theme, change a background style, move a slider (e.g. Glow Intensity) → visible change happens immediately, persists on reload
- [ ] **AI Routing** — shows the *same* role assignments as Model Manager (changing one updates the other); toggling "Desktop Automation Routing" and "Flagship Model" actually changes chat routing behavior (see Chat and Automation sections)
- [ ] **Performance** — toggle Particle Systems off → background animation visibly stops (CPU usage for that canvas drops); toggle Backdrop Blur off → panels go opaque; toggle Glow Effects off → glows disappear; toggle Scan Line Overlay on → visible scanline texture appears; Target FPS slider changes background animation smoothness
- [ ] **Voice & Audio**, **Notifications**, **Privacy**, **Memory System**, **Automation**, **Experimental**, **Backup**, **Developer**, **Logs** — see their dedicated sections below
- [ ] **Global View** — Theme Sync toggle works; "Open Global View" button navigates there

**Passing:** No category shows a "Coming Soon" placeholder. Every toggle either changes real behavior or is removed.

---

## 8. Backup

**What it does:** Exports a zip of your vault + conversation logs + settings; restores from a previously exported zip.

**How to test:**
- [ ] Settings → Providers → Backup → **Download Backup (.zip)** → file downloads, non-trivial size (not a few bytes)
- [ ] Open the zip → confirm it contains `vault/`, `conversations/`, and `config/` top-level folders with real files inside
- [ ] **Restore from Backup** with that same zip → response reports a files-restored count > 0
- [ ] Spot-check: a known vault file (e.g. a `Logs/*.md`) matches its pre-export content after restore
- [ ] Try importing a non-zip file → clear error, no crash, no partial write

**Passing:** Export contains real current data. Import correctly restores files to their original locations without corrupting anything outside the intended folders (no zip-slip path escapes).

---

## 9. Notifications

**What it does:** Real OS-native desktop notifications (Windows toast via `win11toast`), gated by user preference.

**How to test:**
- [ ] Settings → Notifications → Enable Notifications **on** → click **Send Test Notification** → an actual Windows toast appears (not a console print)
- [ ] Turn Enable Notifications **off** → Send Test again → response says notifications are disabled, and no toast appears
- [ ] Turn it back on, turn **Task Complete** off specifically → mark a task COMPLETE via the API → no toast fires for that one category, but a manual test notification still does
- [ ] Turn **Task Complete** back on → mark another task COMPLETE → toast fires

**Passing:** Toasts are real OS notifications, not console text. The master switch and each category toggle independently gate whether a notification actually sends.

---

## 10. Logs

**What it does:** Shows the real tail of `logs/nyx.log` from inside Settings.

**How to test:**
- [ ] Settings → Logs shows non-empty content matching the actual end of `logs/nyx.log` (open the file directly and compare)
- [ ] Send a chat message or trigger any action that logs something → click **Refresh** → the new line appears
- [ ] Confirm the line count shown (`last N of TOTAL lines`) matches reality

**Passing:** What's displayed is always a real, current slice of the actual log file — never canned text.

---

## 11. Tasks

**What it does:** A real persisted task list (`memory/tasks.json`) shared by the dashboard's Active Tasks widget and the Systems page.

**How to test:**
- [ ] Create a task via `POST /api/tasks` (or however the UI exposes it) → appears in both the dashboard's **Active Tasks** panel *and* the Systems page's Active Tasks panel — same data, both places
- [ ] Update its status to `IN PROGRESS` → pulsing dot animation appears in Systems page
- [ ] Update its status to `COMPLETE` → disappears from the dashboard's active list (filtered out), triggers a notification if Task Complete notifications are on
- [ ] Delete a task → gone from both views
- [ ] With zero tasks, both panels show a real empty state ("No active tasks" / "No tasks tracked"), not fake placeholder rows

**Passing:** One source of truth, reflected consistently everywhere it's shown. Empty state is honest, not hardcoded sample data.

---

## 12. Reminders

**What it does:** A real persisted reminders list (`memory/reminders.json`) shown on the dashboard.

**How to test:**
- [ ] Create a reminder via `POST /api/reminders` with a future `due_at` → appears in the dashboard's Reminders panel with a correctly formatted date/time
- [ ] Restart the backend → reminder still there (confirms persistence, not just in-memory state)
- [ ] Delete it → gone from the panel
- [ ] With zero reminders, panel shows "No reminders set", not fake sample entries

**Passing:** Reminders survive a restart. Displayed dates are correctly parsed/formatted, not raw ISO strings.

---

## 13. Memory

**What it does:** NYX's note-taking system — `NYX_VAULT/Memory` and `NYX_VAULT/Logs` (or your connected Obsidian vault's equivalent), the Memory Constellation page, and the Memory System settings panel.

**How to test:**
- [ ] On a totally fresh install with no prior chat, send one message → `NYX_VAULT/Memory/` and `NYX_VAULT/Logs/` are created automatically, no manual setup
- [ ] Settings → Providers → Memory System shows stats (Memory Notes, Conversation Logs, Vault Markdown Files, Vault Connected) that match the real file counts on disk
- [ ] The Memory Constellation page (sidebar → Memory) shows real nodes, not placeholder graph data
- [ ] Trigger a "remember that..." phrase in chat → a new node appears in the constellation (may require Sync) and a new line in `Memory/auto.md`
- [ ] Delete a memory node from the Constellation page → confirms removal via the API, doesn't reappear on refresh

**Passing:** Everything shown is backed by real files on disk. Stats never drift from reality. Works with zero setup on a fresh install.

---

## 14. laptop-lite

**What it does:** A branch carrying lighter defaults for weaker hardware — smaller models, reduced polling, non-blocking CPU sampling — layered on top of `main`, not a forked codebase.

**How to test:**
- [ ] `git checkout laptop-lite` → `config.py` shows `3b`-class models for `MODEL_MAIN`, `MODEL_CODER`, `MODEL_REASON`
- [ ] `nyx_frontend/src/components/SystemsPage.jsx` polls `/api/system` at 8000ms/20000ms intervals, not main's faster intervals
- [ ] `ui/server.py`'s `/api/system` route uses `psutil.cpu_percent(interval=None)`, not a blocking `interval=0.5`
- [ ] Every other system in this checklist (Chat, Model Manager, Settings, Backup, etc.) works identically to `main` — laptop-lite should never be missing a feature `main` has
- [ ] `git log laptop-lite` shows it's a descendant of recent `main` commits (i.e. it's been merged forward, not drifted into its own history)

**Passing:** Lighter resource usage confirmed, zero feature gaps versus `main`, branch is current with `main`.

---

## Sign-off

- [ ] All sections above checked
- [ ] No console errors/tracebacks during the full pass
- [ ] `git status` is clean (nothing left uncommitted) on both `main` and `laptop-lite`
- [ ] Both branches pushed to `origin`

**Tested by:** ___________  **Date:** ___________  **Build/commit:** ___________
