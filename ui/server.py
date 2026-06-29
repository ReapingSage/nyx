"""
ui/server.py — Nyx FastAPI Backend

Run from your nyx folder:
python -m uvicorn ui.server:app --reload --port 8000

Open:
http://127.0.0.1:8000
"""

import sys
import json
import uuid
import random
import platform
import time
from datetime import datetime
from pathlib import Path

import psutil
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Add nyx root folder to Python path
ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))

import config
from core.agent import NyxAgent
from core.constellation_manager import constellation
from core import model_manager
from brain import openclaw_provider
from utils.logger import get_logger

log = get_logger(__name__)

app = FastAPI(title="Nyx API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

agent = NyxAgent()

FRONTEND_ROOT = ROOT_DIR / "nyx_frontend"
FRONTEND_DIST = FRONTEND_ROOT / "dist"
FRONTEND_DIR  = FRONTEND_DIST if FRONTEND_DIST.exists() else FRONTEND_ROOT

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

# ── Voice audio output directory (served as static files) ──
VOICE_OUTPUTS = ROOT_DIR / "voice" / "outputs"
VOICE_OUTPUTS.mkdir(parents=True, exist_ok=True)
app.mount("/voice-audio", StaticFiles(directory=str(VOICE_OUTPUTS)), name="voice-audio")

# ── WebSocket manager — pushes events to connected browser tabs ──
class VoiceWSManager:
    def __init__(self):
        self.clients: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.clients.append(ws)

    def disconnect(self, ws: WebSocket):
        self.clients = [c for c in self.clients if c is not ws]

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.clients:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

voice_ws = VoiceWSManager()

ACK_PHRASES = [
    "Right away, sir.",
    "Yes sir.",
    "On it.",
    "Understood.",
    "As you wish.",
    "Consider it done.",
    "At once.",
    "Of course.",
    "Right away, Master.",
    "Leave it to me.",
    "Gladly.",
    "Your wish is my command.",
]


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    response: str
    model: str
    timestamp: str


class VoiceTranscriptRequest(BaseModel):
    transcript: str


# ── Voice: transcript → ack TTS → AI → response TTS ──────────────
@app.post("/api/voice/respond")
async def voice_respond(req: VoiceTranscriptRequest):
    transcript = req.transcript.strip()
    if not transcript:
        raise HTTPException(status_code=400, detail="Empty transcript.")

    log.info(f"Voice transcript: {transcript[:80]}")

    from voice.text_to_speech import speak_to_file

    # Generate acknowledgment audio (short phrase, plays while AI thinks)
    ack_phrase = random.choice(ACK_PHRASES)
    ack_url    = None
    try:
        ack_path = VOICE_OUTPUTS / f"nyx_ack_{uuid.uuid4().hex[:8]}.mp3"
        result   = speak_to_file(ack_phrase, ack_path)
        if result and result.exists():
            ack_url = f"/voice-audio/{result.name}"
    except Exception as exc:
        log.warning(f"ACK TTS failed: {exc}")

    # Route through AI agent
    response_text = agent.handle(transcript)

    # Generate response TTS
    audio_url = None
    try:
        resp_path = VOICE_OUTPUTS / f"nyx_{uuid.uuid4().hex[:10]}.mp3"
        result    = speak_to_file(response_text, resp_path)
        if result and result.exists():
            audio_url = f"/voice-audio/{result.name}"
    except Exception as exc:
        log.warning(f"TTS generation failed: {exc}")

    payload = {
        "transcript":    transcript,
        "response":      response_text,
        "audio_url":     audio_url,
        "ack_phrase":    ack_phrase,
        "ack_audio_url": ack_url,
        "timestamp":     datetime.now().isoformat(),
    }

    await voice_ws.broadcast({"type": "voice_response", **payload})
    return payload


# ── Voice: Python background listener notifies wake word ──────────
@app.post("/api/voice/wake")
async def voice_wake():
    """Called by voice/wake_word_listener.py when 'nyx' is heard."""
    await voice_ws.broadcast({"type": "wake_word_detected"})
    return {"status": "ok"}


# ── WebSocket: real-time voice events to/from browser ─────────────
@app.websocket("/ws/voice")
async def voice_websocket(ws: WebSocket):
    await voice_ws.connect(ws)
    try:
        while True:
            await ws.receive_text()   # keep connection alive; we only push from server
    except WebSocketDisconnect:
        voice_ws.disconnect(ws)


@app.get("/", response_class=HTMLResponse)
async def serve_dashboard():
    index = FRONTEND_DIR / "index.html"

    if index.exists():
        return FileResponse(index, headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
        })

    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Nyx</title>
        <style>
            body {
                margin: 0;
                height: 100vh;
                background: #050008;
                color: white;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-family: Arial, sans-serif;
            }

            .orb {
                width: 220px;
                height: 220px;
                border-radius: 50%;
                background: radial-gradient(circle, #e6c7ff, #8b35ff, #160021);
                box-shadow: 0 0 80px #9d4dff;
                animation: pulse 2s infinite alternate;
            }

            h1 {
                margin-top: 32px;
                letter-spacing: 8px;
            }

            p {
                color: #c9a8ff;
            }

            @keyframes pulse {
                from {
                    transform: scale(1);
                    opacity: 0.75;
                }
                to {
                    transform: scale(1.08);
                    opacity: 1;
                }
            }
        </style>
    </head>
    <body>
        <div class="orb"></div>
        <h1>NYX</h1>
        <p>Frontend fallback loaded. Create ui/frontend/index.html later.</p>
    </body>
    </html>
    """


@app.post("/api/chat")
async def chat(req: ChatRequest):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Empty message.")

    log.info(f"Chat request: {req.message[:60]}")

    from brain import model_router

    model, reason = model_router.route(req.message)

    try:
        response_text = agent.handle(req.message)
    except Exception as e:
        log.error(f"agent.handle error: {e}", exc_info=True)
        response_text = f"[Nyx] Something went wrong processing that request. Error: {e}"

    return ChatResponse(
        response=response_text,
        model=model,
        timestamp=datetime.now().isoformat(),
    )


@app.post("/api/reset")
async def reset_memory():
    result = agent.reset()
    return {"status": "ok", "message": result}


@app.get("/api/system")
async def system_stats():
    try:
        # laptop-lite: non-blocking sample (interval=None) instead of a 0.5s blocking sleep
        cpu = psutil.cpu_percent(interval=None)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        net = psutil.net_io_counters()

        gpu_info = {"available": False, "usage": None, "name": None,
                    "vram_used_mb": None, "vram_total_mb": None, "temp_c": None}
        try:
            import GPUtil
            gpus = GPUtil.getGPUs()
            if gpus:
                g = gpus[0]
                gpu_info = {
                    "available":     True,
                    "usage":         round(g.load * 100, 1),
                    "name":          g.name,
                    "vram_used_mb":  round(g.memoryUsed),
                    "vram_total_mb": round(g.memoryTotal),
                    "temp_c":        g.temperature,
                }
        except ImportError:
            pass

        freq = psutil.cpu_freq()

        return {
            "cpu": {
                "usage":     round(cpu, 1),
                "cores":     psutil.cpu_count(logical=False),
                "threads":   psutil.cpu_count(logical=True),
                "freq_mhz":  round(freq.current) if freq else None,
                "freq_max_mhz": round(freq.max) if freq else None,
            },
            "memory": {
                "usage":    round(memory.percent, 1),
                "used_gb":  round(memory.used  / 1e9, 1),
                "total_gb": round(memory.total / 1e9, 1),
            },
            "disk": {
                "usage":    round(disk.percent, 1),
                "used_gb":  round(disk.used  / 1e9, 1),
                "total_gb": round(disk.total / 1e9, 1),
            },
            "gpu": gpu_info,
            "network": {
                "bytes_sent_mb": round(net.bytes_sent / 1e6, 1),
                "bytes_recv_mb": round(net.bytes_recv / 1e6, 1),
            },
            "platform": platform.system(),
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as e:
        log.error(f"System stats error: {e}")
        return {"error": str(e)}


@app.get("/api/status")
async def status():
    return {
        "status": "online",
        "provider": config.AI_PROVIDER,
        "model": config.MODEL_MAIN,
        "user": config.USER_NAME,
        "title": config.NYX_TITLE,
        "voice_enabled": config.VOICE_ENABLED,
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/api/memory")
async def get_memory():
    from core.memory_manager import load_recent
    history = load_recent(n=20)
    return {"entries": history, "count": len(history)}


# ── Constellation ──────────────────────────────────────────────────────────────

class MemoryNode(BaseModel):
    label:       str
    category:    str
    description: str  = ""
    source:      str  = "manual"
    confidence:  float = 0.80
    importance:  int   = 3
    tags:        list  = []


class MemoryUpdate(BaseModel):
    label:       str | None = None
    description: str | None = None
    category:    str | None = None
    importance:  int | None = None
    tags:        list | None = None
    pinned:      bool | None = None
    archived:    bool | None = None


@app.get("/api/constellation")
async def get_constellation():
    return constellation.get_all()


@app.post("/api/constellation/memory")
async def add_memory(req: MemoryNode):
    node = constellation.add_memory(
        label=req.label,
        category=req.category,
        description=req.description,
        source=req.source,
        confidence=req.confidence,
        importance=req.importance,
        tags=req.tags,
    )
    # Mirror to Obsidian vault
    try:
        from core.vault_bridge import MEMORY_DIR
        from datetime import datetime
        mf = MEMORY_DIR / "manual.md"
        MEMORY_DIR.mkdir(parents=True, exist_ok=True)
        if not mf.exists():
            mf.write_text("# Manually Added Memories\n\n", encoding="utf-8")
        ts = datetime.now().strftime("%Y-%m-%d %H:%M")
        with mf.open("a", encoding="utf-8") as f:
            f.write(f"- **{ts}** [{req.category}] {req.label}"
                    + (f" — {req.description}" if req.description else "") + "\n")
    except Exception as e:
        log.warning(f"[constellation] Vault mirror failed: {e}")
    return node


@app.put("/api/constellation/memory/{node_id}")
async def update_memory(node_id: str, req: MemoryUpdate):
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    node = constellation.update_memory(node_id, updates)
    if not node:
        raise HTTPException(status_code=404, detail="Memory not found")
    return node


@app.delete("/api/constellation/memory/{node_id}")
async def delete_memory(node_id: str):
    ok = constellation.delete_memory(node_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"status": "deleted"}


@app.post("/api/constellation/sync")
async def sync_constellation():
    from core.memory_extractor import scan_conversation_logs
    new_nodes = scan_conversation_logs()
    return {
        "status":      "synced",
        "new_memories": len(new_nodes),
        "nodes":        new_nodes,
    }


@app.get("/api/constellation/export")
async def export_constellation():
    return constellation.get_export()


@app.post("/api/constellation/open-vault")
async def open_vault():
    import subprocess, platform
    from core.vault_bridge import VAULT_PATH
    try:
        path = str(VAULT_PATH)
        if platform.system() == "Windows":
            subprocess.Popen(["explorer", path])
        elif platform.system() == "Darwin":
            subprocess.Popen(["open", path])
        else:
            subprocess.Popen(["xdg-open", path])
        return {"status": "opened", "path": path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── OpenClaw ───────────────────────────────────────────────────────────────────

@app.get("/api/openclaw/status")
async def openclaw_status():
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, openclaw_provider.status)


@app.post("/api/openclaw/test")
async def openclaw_test():
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, openclaw_provider.test)


# ── Network Operations ─────────────────────────────────────────────────────────

_net_events:  list[dict] = []
_net_offline: bool = False


def _net_log(category: str, title: str, detail: str = "") -> None:
    _net_events.insert(0, {
        "id":        str(uuid.uuid4()),
        "timestamp": datetime.now().isoformat(),
        "category":  category,
        "title":     title,
        "detail":    detail,
    })
    del _net_events[50:]


async def _async_ping(host: str, port: int, timeout: float = 2.0) -> tuple[bool, int | None]:
    """Non-blocking TCP connect — does not block the event loop."""
    import asyncio
    try:
        t0 = time.monotonic()
        _, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), timeout=timeout
        )
        ms = round((time.monotonic() - t0) * 1000)
        writer.close()
        try:
            await asyncio.wait_for(writer.wait_closed(), timeout=0.3)
        except Exception:
            pass
        return True, ms
    except Exception:
        return False, None


async def _ollama_ping(timeout: float = 2.0) -> tuple[bool, int | None]:
    """HTTP check against Ollama — faster than raw TCP on Windows."""
    import asyncio, urllib.request
    loop = asyncio.get_event_loop()
    def _req():
        t0 = time.monotonic()
        try:
            urllib.request.urlopen(
                f"{config.OLLAMA_BASE_URL}/api/tags", timeout=timeout
            )
            return True, round((time.monotonic() - t0) * 1000)
        except Exception:
            return False, None
    try:
        return await asyncio.wait_for(
            loop.run_in_executor(None, _req), timeout=timeout + 0.5
        )
    except Exception:
        return False, None


# Keep a tiny cache: (timestamp, result) — refreshed at most every 8 seconds
_status_cache: tuple[float, dict] | None = None

_net_log("system", "System Startup", "Nyx Core initialized. All systems online.")


@app.get("/api/network/status")
async def net_status():
    import asyncio
    global _status_cache

    # Serve cached result if fresh
    if _status_cache and (time.monotonic() - _status_cache[0]) < 8:
        return _status_cache[1]

    # Run Ollama + Internet + OpenClaw checks concurrently
    (olla_ok, olla_ms), (inet_ok, inet_ms), (claw_ok, claw_ms) = await asyncio.gather(
        _ollama_ping(timeout=2.0),
        _async_ping("8.8.8.8", 53, timeout=3.0),
        _async_ping(config.OPENCLAW_HOST, config.OPENCLAW_PORT, timeout=2.0),
    )

    vault_path = ROOT_DIR / "NYX_VAULT"
    vault_ok   = vault_path.exists()
    vault_mds  = len(list(vault_path.rglob("*.md"))) if vault_ok else 0

    from core.constellation_manager import constellation as _cs
    cdata     = _cs.get_all()
    mem_count = len(cdata.get("nodes", []))

    conv_dir   = ROOT_DIR / "memory" / "conversations"
    conv_count = len(list(conv_dir.glob("*.json"))) if conv_dir.exists() else 0

    uptime_sec = int(time.time() - psutil.boot_time())

    result = {
        "offline_mode":    _net_offline,
        "active_provider": config.AI_PROVIDER,
        "active_model":    config.MODEL_MAIN,
        "internet":  {"online": inet_ok, "latency_ms": inet_ms},
        "backend":   {"online": True,    "latency_ms": 0},
        "providers": {
            "ollama": {
                "configured": True,
                "online":     olla_ok and not _net_offline,
                "latency_ms": olla_ms,
                "base_url":   config.OLLAMA_BASE_URL,
                "model":      config.MODEL_MAIN,
                "is_active":  config.AI_PROVIDER == "ollama" and not _net_offline,
            },
            "openai": {
                "configured": bool(config.OPENAI_API_KEY),
                "online":     None,
                "base_url":   "api.openai.com",
                "model":      "gpt-4o",
                "is_active":  config.AI_PROVIDER == "openai" and not _net_offline,
            },
            "claude": {
                "configured": bool(config.ANTHROPIC_API_KEY),
                "online":     None,
                "base_url":   "api.anthropic.com",
                "model":      "claude-sonnet-4-6",
                "is_active":  config.AI_PROVIDER == "claude" and not _net_offline,
            },
            "offline": {
                "configured": True,
                "online":     True,
                "is_active":  _net_offline,
            },
            "openclaw": {
                "configured": True,
                "online":     claw_ok and not _net_offline,
                "latency_ms": claw_ms,
                "gateway_url": f"ws://{config.OPENCLAW_HOST}:{config.OPENCLAW_PORT}",
                "model":      "llama3.2:3b",
                "is_active":  claw_ok and not _net_offline,
            },
        },
        "memory": {
            "vault_exists":   vault_ok,
            "vault_md_count": vault_mds,
            "memory_count":   mem_count,
            "conv_log_count": conv_count,
            "last_synced":    cdata.get("stats", {}).get("last_synced"),
        },
        "voice": {
            "enabled":      config.VOICE_ENABLED,
            "stt_provider": config.STT_PROVIDER,
            "tts_provider": config.TTS_PROVIDER,
        },
        "integrations": {
            "discord_launcher":  {"available": True,  "type": "desktop_app"},
            "browser_extension": {"available": False},
            "mobile_companion":  {"available": False},
        },
        "uptime_seconds": uptime_sec,
        "timestamp":      datetime.now().isoformat(),
    }
    _status_cache = (time.monotonic(), result)
    return result


@app.post("/api/network/test-connections")
async def net_test_connections():
    import asyncio

    # Build task list — run all checks concurrently
    keys   = ["ollama", "internet", "openclaw"]
    coros  = [
        _ollama_ping(timeout=2.0),
        _async_ping("8.8.8.8", 53, timeout=3.0),
        _async_ping(config.OPENCLAW_HOST, config.OPENCLAW_PORT, timeout=2.0),
    ]
    if config.OPENAI_API_KEY:
        keys.append("openai");  coros.append(_async_ping("api.openai.com", 443))
    if config.ANTHROPIC_API_KEY:
        keys.append("claude");  coros.append(_async_ping("api.anthropic.com", 443))

    pings = await asyncio.gather(*coros)

    results: dict = {"backend": {"ok": True, "latency_ms": 0}}
    for key, (ok, ms) in zip(keys, pings):
        results[key] = {"ok": ok, "latency_ms": ms}

    # Invalidate cache so next status call reflects fresh state
    global _status_cache
    _status_cache = None

    all_ok = all(v["ok"] for v in results.values())
    _net_log(
        "system", "Diagnostics Complete",
        f"Tested {len(results)} connections — {'all nominal' if all_ok else 'issues detected'}.",
    )
    return {"results": results, "all_ok": all_ok, "timestamp": datetime.now().isoformat()}


@app.get("/api/network/logs")
async def net_logs(limit: int = 30):
    return {"events": _net_events[:limit]}


@app.post("/api/network/emergency-disconnect")
async def net_emergency_disconnect():
    global _net_offline
    _net_offline = True
    _net_log("security", "Emergency Disconnect",
             "All external AI providers disabled. System isolated in offline mode.")
    return {"status": "disconnected", "offline_mode": True}


@app.post("/api/network/reconnect")
async def net_reconnect():
    global _net_offline
    _net_offline = False
    _net_log("system", "Systems Reconnected",
             "External connections restored. Normal operations resumed.")
    return {"status": "reconnected", "offline_mode": False}


# ── Model Manager ────────────────────────────────────────────────────────────

class ModelAssignRequest(BaseModel):
    role: str
    model: str


class ModelPullRequest(BaseModel):
    name: str


@app.get("/api/models/status")
async def models_status():
    return model_manager.get_ollama_status()


@app.get("/api/models/list")
async def models_list():
    return {
        "installed":   model_manager.list_installed_models(),
        "assignments": model_manager.get_role_assignments(),
    }


@app.get("/api/models/recommended")
async def models_recommended(profile: str = "desktop"):
    return {"profile": profile, "missing": model_manager.missing_recommended(profile)}


@app.post("/api/models/assign")
async def models_assign(req: ModelAssignRequest):
    try:
        return model_manager.set_role_assignment(req.role, req.model)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/models/pull")
async def models_pull(req: ModelPullRequest):
    def event_stream():
        try:
            for progress in model_manager.pull_model(req.name):
                yield json.dumps(progress) + "\n"
        except Exception as e:
            yield json.dumps({"status": "error", "error": str(e)}) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@app.delete("/api/models/{name}")
async def models_delete(name: str):
    ok = model_manager.delete_model(name)
    if not ok:
        raise HTTPException(status_code=400, detail=f"Failed to delete model '{name}'")
    return {"status": "deleted", "name": name}


# ── SPA fallback ─────────────────────────────────────────────────────────────
# Must be the LAST route registered — Starlette matches routes in registration
# order, so every specific route above (including mounted /assets, /voice-audio)
# is tried first. This only catches paths nothing else matched, e.g. a browser
# opening /settings or /models directly — the React app reads the URL itself
# and renders the right page (see App.jsx).

@app.get("/{full_path:path}", response_class=HTMLResponse)
async def spa_fallback(full_path: str):
    index = FRONTEND_DIR / "index.html"

    if index.exists():
        return FileResponse(index, headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
        })

    return await serve_dashboard()