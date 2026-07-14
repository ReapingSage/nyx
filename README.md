# NYX

NYX is a local-first AI desktop assistant. It runs entirely on your own machine using [Ollama](https://ollama.com) for AI models, with a FastAPI backend and a React dashboard frontend.

> Want a lighter setup for an older laptop? Check out the [`laptop-lite`](https://github.com/ReapingSage/nyx/tree/laptop-lite) branch — same features, smaller default models, reduced CPU usage.

## Required software

| Tool | Why |
|---|---|
| [Git](https://git-scm.com/downloads) | Clone and update the repo |
| [Python 3.12+](https://www.python.org/downloads/) | Runs the backend |
| [Node.js 18+](https://nodejs.org/) | Builds/runs the frontend dashboard |
| [Ollama](https://ollama.com/download) | Runs AI models locally — see [MODEL_SETUP.md](MODEL_SETUP.md) |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Optional — run NYX in containers instead of natively |
| [WSL2](https://learn.microsoft.com/windows/wsl/install) | Windows only, required by Docker Desktop |
| [Obsidian](https://obsidian.md) | **Not required.** See [Memory & Storage](#memory--storage) below — Obsidian is one of two storage options, not a dependency. |

## Installation

### Quick install on Windows (no Git experience needed)

Use GitHub's **Code → Download ZIP** button, then **right-click the downloaded `.zip` → "Extract All..."** to a real folder. Double-click `setup.bat` from inside that extracted folder.

> Don't just double-click the `.zip` itself and run `setup.bat` from the preview window it opens — that's a browse-only view backed by a temp cache, and files like `config.py` can end up missing on disk even though they appear in the listing, causing NYX to crash on launch. Always Extract All first.

### 1. Clone the repo

```
git clone https://github.com/ReapingSage/nyx.git
cd nyx
```

### 2. Install Ollama and pull a model

Install Ollama from https://ollama.com/download, then pull at least one model:

```
ollama pull llama3.2:3b
```

See [MODEL_SETUP.md](MODEL_SETUP.md) for the full list of recommended models, or use the built-in Model Manager once NYX is running.

### 3. Install Python dependencies

```
pip install -r requirements.txt
```

### 4. Install frontend dependencies

```
cd nyx_frontend
npm install
cd ..
```

### 5. Configure environment variables

Copy `.env.example` (if present) to `.env`, or create a `.env` file in the project root. At minimum:

```
OLLAMA_BASE_URL=http://localhost:11434
USER_NAME=YourName
```

### 6. Run NYX

**Backend:**

```
python -m uvicorn ui.server:app --reload --port 8000
```

**Frontend (separate terminal):**

```
cd nyx_frontend
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

### Alternative: Docker

```
docker-compose up --build
```

This builds and runs both the backend and frontend in containers.

### Alternative: System tray app

Once dependencies are installed, you can run NYX from the system tray instead of a terminal:

```
python tray/tray_app.py
```

This gives you Start/Stop controls and quick links to the dashboard, Settings, and Model Manager, right from your taskbar. It detects NYX whether it's running because the tray app started it, you ran it manually in a terminal, or it's running in Docker on the same port — Start won't launch a duplicate, and Stop can shut down whichever one is running.

#### Add it to your Start Menu / Desktop

To launch NYX like any other installed app (double-click, no terminal):

```
powershell -ExecutionPolicy Bypass -File tray\install_shortcut.ps1
```

This creates a "NYX" shortcut in your Start Menu and on your Desktop, using `pythonw.exe` so no console window appears. Right-click either shortcut afterward to pin it to Start or the taskbar if you want it there too. Windows only.

## Memory & Storage

NYX remembers things — facts about you, and a log of every conversation. Where those notes physically live is a "storage provider," switchable anytime from **Settings → Providers → Storage / Memory**, with no restart needed.

### NYX Local Storage (default)

NYX creates a folder called `NYX_VAULT/` inside the project the moment you send your first message — nothing to configure. Inside:

```
NYX_VAULT/
├── Memory/     # facts NYX has learned, one file per topic (preferences.md, identity.md, etc.)
└── Logs/       # one markdown file per day — the full transcript of every conversation
```

Pick this if you don't already use a note-taking app. It just works.

### Obsidian integration

If you already keep notes in [Obsidian](https://obsidian.md), point NYX at that vault instead. NYX creates the same `Memory/` and `Logs/` subfolders *inside it*, so your NYX notes sit alongside your other notes with full access to Obsidian's graph view, linking, and search.

NYX only ever touches `<your vault>/Memory` and `<your vault>/Logs` — nothing else in your vault is read, written, or deleted.

To connect one:
1. **Settings → Providers → Storage / Memory**
2. Paste the path to an existing vault folder
3. Click **Check & Connect** — NYX verifies the folder exists
4. Confirm the switch in the dialog that appears

Obsidian the app doesn't need to be installed for this to work — it's just what you'd use to *browse* the vault afterward. NYX talks to the folder directly on disk.

### Switching providers safely

Switching is a redirect for **future** notes — it is not a migration or a merge:

- Nothing already saved in your current provider is moved, copied, or deleted
- NYX stops reading from the old location and starts reading/writing the new one
- Switching back later picks up exactly where that provider's notes left off, untouched

NYX shows a confirmation dialog every time you switch, spelling out exactly what will happen before it happens — so you always know which provider is active and what switching will (and won't) do.

## Hardware recommendations

| | Minimum | Recommended |
|---|---|---|
| RAM | 8 GB | 16 GB+ |
| CPU | 4 cores | 6+ cores |
| Storage | 10 GB free (for models) | 30 GB+ free |
| GPU | None (CPU inference works, but slow) | Any dedicated GPU with 6GB+ VRAM speeds things up significantly |

If you're on a laptop or lower-spec machine, use the [`laptop-lite`](https://github.com/ReapingSage/nyx/tree/laptop-lite) branch and the laptop model recommendations in [MODEL_SETUP.md](MODEL_SETUP.md).

## Installing recommended models

See [MODEL_SETUP.md](MODEL_SETUP.md) for the full guide, or use the Model Manager built into NYX (Settings → Model Manager, or via the tray app) to detect, categorize, and download models with one click.

Quick reference:

```
ollama pull qwen2.5-coder:3b   # laptop coding model
ollama pull llama3.2:3b        # laptop general model
ollama pull qwen2.5-coder:7b   # desktop coding model
ollama pull llama3.1:8b        # desktop general model
```

## Updating NYX

```
git pull origin main
pip install -r requirements.txt
cd nyx_frontend && npm install && cd ..
```

Restart the backend and frontend (or the tray app) after updating.

## Contributing

1. Fork the repo and create a branch for your change
2. Keep changes scoped — one feature or fix per pull request
3. Don't commit secrets, API keys, or personal data — check `.gitignore` covers anything new you add that's machine- or person-specific
4. Before opening a pull request, walk through [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) for anything your change touches
5. Open a pull request against `main` with a clear description of what changed and why

## Project structure

```
nyx/
├── app.py              # CLI entry point
├── config.py           # configuration (models, env vars)
├── brain/              # AI provider integrations + routing
├── core/               # agent orchestration, memory, model manager, storage_provider.py, vault_bridge.py
├── ui/server.py         # FastAPI backend
├── nyx_frontend/        # React dashboard
├── tools/               # desktop/web automation tools
├── tray/                # Windows system tray app
├── voice/               # speech-to-text / text-to-speech
├── NYX_VAULT/            # default memory storage (created automatically, see Memory & Storage)
└── MODEL_SETUP.md       # manual Ollama model setup guide
```

Designed to stay modular — Voice, Memory, Plugins, Updater, and Networking can each grow independently without requiring a redesign of the rest.
