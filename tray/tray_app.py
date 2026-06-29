"""
tray/tray_app.py — NYX System Tray Application
Run with: pythonw tray/tray_app.py   (or: python tray/tray_app.py)

Controls the NYX backend (ui.server:app via uvicorn) from the Windows
system tray — start/stop the service, open the dashboard, settings,
and Model Manager in your browser.

Detects NYX whether it was started by this tray app, in a terminal, or
any other way — Start won't double-launch a second instance on the same
port, and Stop can shut down an instance it didn't itself start.
"""

import sys
import os
import socket
import subprocess
import threading
import time
import webbrowser

import psutil
import pystray
from PIL import Image, ImageDraw

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST = "127.0.0.1"
PORT = 8000
BASE_URL = f"http://{HOST}:{PORT}"
START_POLL_ATTEMPTS = 10
START_POLL_INTERVAL = 0.5
LOCK_FILE = os.path.join(ROOT_DIR, "tray", ".tray.lock")


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
        self._stop_refresh = threading.Event()
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

    def start_service(self, _icon=None, _item=None):
        if self.is_running():
            self._refresh()  # already running (maybe started elsewhere) — just sync the title
            return

        self.process = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "ui.server:app", "--host", HOST, "--port", str(PORT)],
            cwd=ROOT_DIR,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
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

        self._refresh()

    def _wait_until_ready(self):
        """After starting, give the server a moment to actually bind the port
        before opening a browser tab to it."""
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

    # ── Browser actions ─────────────────────────────────────

    def open_dashboard(self, _icon=None, _item=None):
        if not self.is_running():
            self.start_service()
            self._wait_until_ready()
        webbrowser.open(BASE_URL)

    def open_settings(self, _icon=None, _item=None):
        if not self.is_running():
            self.start_service()
            self._wait_until_ready()
        webbrowser.open(f"{BASE_URL}/settings")

    def open_model_manager(self, _icon=None, _item=None):
        if not self.is_running():
            self.start_service()
            self._wait_until_ready()
        webbrowser.open(f"{BASE_URL}/models")

    # ── Menu ─────────────────────────────────────────────────

    def _status_text(self, _item):
        return f"Status: {'Running' if self.is_running() else 'Stopped'}"

    def _build_menu(self) -> pystray.Menu:
        return pystray.Menu(
            pystray.MenuItem(self._status_text, None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Start NYX", self.start_service),
            pystray.MenuItem("Stop NYX", self.stop_service),
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
        self._stop_refresh.set()
        self.icon.stop()

    def run(self):
        self.start_service()
        threading.Thread(target=self._refresh_loop, daemon=True).start()
        self.icon.run()


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
