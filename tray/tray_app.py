"""
tray/tray_app.py — NYX System Tray Application
Run with: pythonw tray/tray_app.py   (or: python tray/tray_app.py)

Controls the NYX backend (ui.server:app via uvicorn) from the Windows
system tray, and opens the dashboard in a real native window (via
pywebview/WebView2) — not a browser tab.

Detects NYX whether it was started by this tray app, in a terminal, or
any other way — Start won't double-launch a second instance on the same
port, and Stop can shut down an instance it didn't itself start.

Threading model: pywebview owns the main thread (webview.start() blocks
there). The tray icon (pystray) runs on a thread pywebview spawns for us.
Closing the NYX window (X) is a full shutdown — backend, tray icon, and
any Ollama this app started all stop, so close-and-reopen gives a fresh
backend. The tray menu also has Restart NYX for a one-click restart.
"""

import sys
import os
import shutil
import socket
import subprocess
import threading
import time
from urllib.parse import urlparse

import psutil
import pystray
import webview
from PIL import Image, ImageDraw

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT_DIR)

import config  # noqa: E402 — needs ROOT_DIR on sys.path first

HOST = "127.0.0.1"
PORT = 8000
BASE_URL = f"http://{HOST}:{PORT}"
START_POLL_ATTEMPTS = 30
START_POLL_INTERVAL = 1.0
LOCK_FILE = os.path.join(ROOT_DIR, "tray", ".tray.lock")
BACKEND_LOG_FILE = os.path.join(ROOT_DIR, "logs", "backend.log")

# Ollama host/port come from the same config the backend uses — no second
# hardcoded copy that can drift.
_ollama = urlparse(config.OLLAMA_BASE_URL)
OLLAMA_HOST = _ollama.hostname or "127.0.0.1"
OLLAMA_PORT = _ollama.port or 11434


def _is_tray_app_process(pid: int) -> bool:
    try:
        cmdline = " ".join(psutil.Process(pid).cmdline())
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return False
    return "tray_app.py" in cmdline


def _another_instance_running() -> bool:
    if not os.path.exists(LOCK_FILE):
        return False
    try:
        with open(LOCK_FILE) as f:
            pid = int(f.read().strip())
    except (ValueError, OSError):
        return False
    return pid != os.getpid() and psutil.pid_exists(pid) and _is_tray_app_process(pid)


def _write_lock():
    with open(LOCK_FILE, "w") as f:
        f.write(str(os.getpid()))


def _clear_lock():
    try:
        os.remove(LOCK_FILE)
    except OSError:
        pass


def _notify_already_running():
    message = (
        "NYX is already running.\n\n"
        "Look in your system tray near the clock - click the ^ arrow "
        "to see hidden icons if you don't see it right away."
    )
    if os.name == "nt":
        import ctypes
        ctypes.windll.user32.MessageBoxW(0, message, "NYX", 0x40)
    else:
        print(message)


def make_icon_image() -> Image.Image:
    """Generate a simple purple orb icon — no external asset required."""
    size = 64
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse((4, 4, size - 4, size - 4), fill=(124, 58, 237, 255))
    draw.ellipse((18, 16, size - 18, size - 28), fill=(230, 210, 255, 220))
    return img


def _port_is_open() -> bool:
    try:
        with socket.create_connection((HOST, PORT), timeout=0.5):
            return True
    except OSError:
        return False


def _ollama_is_running() -> bool:
    try:
        with socket.create_connection((OLLAMA_HOST, OLLAMA_PORT), timeout=0.5):
            return True
    except OSError:
        return False


def _find_ollama_binary() -> str | None:
    """Ollama on PATH, or its default per-user Windows install location."""
    found = shutil.which("ollama")
    if found:
        return found
    candidate = os.path.join(
        os.environ.get("LOCALAPPDATA", ""), "Programs", "Ollama", "ollama.exe"
    )
    return candidate if os.path.isfile(candidate) else None


def _find_uvicorn_pids() -> set[int]:
    """Find any process running NYX's uvicorn server, however it was started."""
    pids = set()
    for proc in psutil.process_iter(["pid", "cmdline"]):
        try:
            cmdline = " ".join(proc.info["cmdline"] or [])
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
        if "uvicorn" in cmdline and "ui.server:app" in cmdline:
            pids.add(proc.info["pid"])
    return pids


def _find_pid_on_port() -> int | None:
    try:
        for conn in psutil.net_connections(kind="inet"):
            if conn.laddr and conn.laddr.port == PORT and conn.status == psutil.CONN_LISTEN:
                return conn.pid
    except (psutil.AccessDenied, PermissionError):
        pass
    return None


def _terminate_tree(pid: int):
    try:
        proc = psutil.Process(pid)
    except psutil.NoSuchProcess:
        return

    procs = proc.children(recursive=True) + [proc]
    for p in procs:
        try:
            p.terminate()
        except psutil.NoSuchProcess:
            pass

    _, alive = psutil.wait_procs(procs, timeout=10)
    for p in alive:
        try:
            p.kill()
        except psutil.NoSuchProcess:
            pass


REFRESH_INTERVAL_SECS = 5


class NyxTrayApp:
    def __init__(self):
        self.process: subprocess.Popen | None = None
        self.ollama_process: subprocess.Popen | None = None
        self.window: "webview.Window | None" = None
        self._stop_refresh = threading.Event()
        self._quitting = False
        self._teardown_thread: threading.Thread | None = None
        self.icon = pystray.Icon(
            "nyx",
            make_icon_image(),
            "NYX — Stopped",
            menu=self._build_menu(),
        )

    # ── Backend process control ────────────────────────────

    def is_running(self) -> bool:
        if self.process is not None and self.process.poll() is None:
            return True
        return _port_is_open()

    def _start_ollama_if_needed(self):
        """NYX is useless without Ollama — bring it up alongside the backend
        when it's installed but not running. If the user (or Windows) already
        runs Ollama, we leave that instance alone and never own it."""
        if _ollama_is_running():
            return
        binary = _find_ollama_binary()
        if not binary:
            return  # not installed — Model Manager page walks the user through it
        try:
            self.ollama_process = subprocess.Popen(
                [binary, "serve"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                stdin=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
        except OSError:
            self.ollama_process = None

    def _stop_ollama_if_ours(self):
        """Only stop an Ollama this tray app started — never one the user runs."""
        if self.ollama_process is not None and self.ollama_process.poll() is None:
            _terminate_tree(self.ollama_process.pid)
        self.ollama_process = None

    def start_service(self, _icon=None, _item=None):
        self._start_ollama_if_needed()

        if self.is_running():
            self._refresh()  # already running (maybe started elsewhere) — just sync the title
            return

        # Launched detached (a real double-click has no console at all — not
        # just a hidden one), sys.executable's stdio handles aren't valid, so
        # the child inherits nothing usable. Without explicit redirection,
        # uvicorn's own startup logging (which writes straight to stdout)
        # throws and kills the subprocess before it ever binds the port —
        # silently, since there's no console to show the crash on. Route it
        # to a real log file instead, both to fix that and to make backend
        # crashes debuggable going forward.
        os.makedirs(os.path.dirname(BACKEND_LOG_FILE), exist_ok=True)
        backend_log = open(BACKEND_LOG_FILE, "a", encoding="utf-8")
        try:
            self.process = subprocess.Popen(
                [sys.executable, "-m", "uvicorn", "ui.server:app", "--host", HOST, "--port", str(PORT)],
                cwd=ROOT_DIR,
                stdin=subprocess.DEVNULL,
                stdout=backend_log,
                stderr=subprocess.STDOUT,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
        finally:
            backend_log.close()  # child already has its own inherited handle
        self._refresh()

    def stop_service(self, _icon=None, _item=None):
        if self.process is not None and self.process.poll() is None:
            _terminate_tree(self.process.pid)
            self.process = None
        else:
            # Not something we started ourselves — find and stop whatever is
            # bound to our port (e.g. a terminal-launched instance).
            pids = _find_uvicorn_pids()
            port_pid = _find_pid_on_port()
            if port_pid:
                pids.add(port_pid)
            for pid in pids:
                _terminate_tree(pid)

        self._stop_ollama_if_ours()
        self._refresh()

    def restart_service(self, _icon=None, _item=None):
        """One-click backend restart — what 'close and reopen' was being
        used for. Stops whatever is running (including a terminal-started
        instance, since a restart is explicitly requested) and starts fresh."""
        self.stop_service()
        self.start_service()
        self._wait_until_ready()
        self._refresh()

    def _wait_until_ready(self):
        """After starting, give the server a moment to actually bind the port
        before pointing a window at it."""
        for _ in range(START_POLL_ATTEMPTS):
            if _port_is_open():
                return
            time.sleep(START_POLL_INTERVAL)

    def _refresh(self):
        self.icon.title = f"NYX — {'Running' if self.is_running() else 'Stopped'}"
        self.icon.update_menu()

    def _refresh_loop(self):
        """Keeps the tray title/menu accurate even if NYX is started or
        stopped some other way (a terminal, Docker, etc.) while this tray
        app is just sitting there."""
        while not self._stop_refresh.wait(REFRESH_INTERVAL_SECS):
            self._refresh()

    # ── Native window actions ────────────────────────────────

    def _on_window_closing(self):
        """The window's X button is a full shutdown — same as tray Exit.
        (It used to just hide the window, which meant 'close and reopen'
        never actually restarted the backend and NYX kept running when the
        user thought it was closed.) A backend started outside the tray
        (terminal) is still left alone, matching Exit's rule."""
        if self._quitting:
            return True  # teardown already in flight — let it close
        self._quitting = True

        def _teardown():
            try:
                if self.process is not None and self.process.poll() is None:
                    self.stop_service()          # also stops an Ollama we started
                else:
                    self._stop_ollama_if_ours()  # backend wasn't ours — only take our Ollama
            finally:
                self._stop_refresh.set()
                try:
                    self.icon.stop()
                except Exception:
                    pass

        # Heavy teardown off this callback so the window closes instantly
        self._teardown_thread = threading.Thread(target=_teardown, daemon=True)
        self._teardown_thread.start()
        return True  # allow the close

    def _open_window(self, path=""):
        if not self.is_running():
            self.start_service()
            self._wait_until_ready()

        url = f"{BASE_URL}{path}"
        if self.window is None:
            self.window = webview.create_window("NYX", url, width=1200, height=800)
            self.window.events.closing += self._on_window_closing
        else:
            self.window.load_url(url)
            self.window.restore()
            self.window.show()

    def open_dashboard(self, _icon=None, _item=None):
        self._open_window()

    def open_settings(self, _icon=None, _item=None):
        self._open_window("/settings")

    def open_model_manager(self, _icon=None, _item=None):
        self._open_window("/models")

    # ── Menu ─────────────────────────────────────────────────

    def _status_text(self, _item):
        return f"Status: {'Running' if self.is_running() else 'Stopped'}"

    def _build_menu(self) -> pystray.Menu:
        return pystray.Menu(
            pystray.MenuItem(self._status_text, None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Start NYX", self.start_service),
            pystray.MenuItem("Stop NYX", self.stop_service),
            pystray.MenuItem("Restart NYX", self.restart_service),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Open NYX", self.open_dashboard),
            pystray.MenuItem("Open Settings", self.open_settings),
            pystray.MenuItem("Open Model Manager", self.open_model_manager),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Exit", self.exit_app),
        )

    def exit_app(self, _icon=None, _item=None):
        # Only stop the service if this tray instance was the one running it —
        # exiting the tray shouldn't kill a server you started yourself in a terminal.
        if self.process is not None and self.process.poll() is None:
            self.stop_service()
        self._stop_ollama_if_ours()
        self._stop_refresh.set()
        self._quitting = True
        if self.window is not None:
            self.window.destroy()
        self.icon.stop()

    def _run_tray(self):
        """Runs on the thread pywebview spawns for us via webview.start()."""
        threading.Thread(target=self._refresh_loop, daemon=True).start()
        # Give the window a moment to render then bring it to front.
        # On slower machines the window can open behind other apps.
        def _bring_to_front():
            time.sleep(1.5)
            if self.window is not None:
                self.window.restore()
                self.window.show()
        threading.Thread(target=_bring_to_front, daemon=True).start()
        self.icon.run()

    def run(self):
        self.start_service()
        self._wait_until_ready()

        # pywebview requires at least one window to exist before start() —
        # this also doubles as the main dashboard window shown on launch.
        self.window = webview.create_window("NYX", BASE_URL, width=1200, height=800)
        self.window.events.closing += self._on_window_closing

        webview.start(self._run_tray, debug=False)

        # webview.start() returns as soon as the window is destroyed, but the
        # X-button close path kills the backend on a background thread so the
        # window can disappear instantly. main() clears the lock file right
        # after this call returns — if that happens before the backend is
        # actually dead, a fast relaunch can see the lock gone, find port
        # 8000 still briefly held by the dying old process, assume something
        # is already serving it, and open a window onto a server that's
        # about to disappear. Wait for teardown to really finish first.
        if self._teardown_thread is not None:
            self._teardown_thread.join(timeout=15)


def main():
    if _another_instance_running():
        _notify_already_running()
        return

    _write_lock()
    try:
        NyxTrayApp().run()
    finally:
        _clear_lock()


if __name__ == "__main__":
    main()
