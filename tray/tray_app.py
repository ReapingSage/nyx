"""
tray/tray_app.py — NYX System Tray Application
Run with: python tray/tray_app.py

Controls the NYX backend (ui.server:app via uvicorn) from the Windows
system tray — start/stop the service, open the dashboard, settings,
and Model Manager in your browser.
"""

import sys
import os
import subprocess
import webbrowser

import pystray
from PIL import Image, ImageDraw

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST = "127.0.0.1"
PORT = 8000
BASE_URL = f"http://{HOST}:{PORT}"


def make_icon_image() -> Image.Image:
    """Generate a simple purple orb icon — no external asset required."""
    size = 64
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse((4, 4, size - 4, size - 4), fill=(124, 58, 237, 255))
    draw.ellipse((18, 16, size - 18, size - 28), fill=(230, 210, 255, 220))
    return img


class NyxTrayApp:
    def __init__(self):
        self.process: subprocess.Popen | None = None
        self.icon = pystray.Icon(
            "nyx",
            make_icon_image(),
            "NYX — Stopped",
            menu=self._build_menu(),
        )

    # ── Backend process control ────────────────────────────

    def is_running(self) -> bool:
        return self.process is not None and self.process.poll() is None

    def start_service(self, _icon=None, _item=None):
        if self.is_running():
            return

        self.process = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "ui.server:app", "--host", HOST, "--port", str(PORT)],
            cwd=ROOT_DIR,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        self._refresh()

    def stop_service(self, _icon=None, _item=None):
        if not self.is_running():
            return

        self.process.terminate()
        try:
            self.process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.process.kill()
        self.process = None
        self._refresh()

    def _refresh(self):
        self.icon.title = f"NYX — {'Running' if self.is_running() else 'Stopped'}"
        self.icon.update_menu()

    # ── Browser actions ─────────────────────────────────────

    def open_dashboard(self, _icon=None, _item=None):
        if not self.is_running():
            self.start_service()
        webbrowser.open(BASE_URL)

    def open_settings(self, _icon=None, _item=None):
        if not self.is_running():
            self.start_service()
        webbrowser.open(f"{BASE_URL}/?page=settings")

    def open_model_manager(self, _icon=None, _item=None):
        # No dedicated frontend page exists yet — opens the live API docs
        # for the /api/models/* routes in the meantime. Switch this to
        # f"{BASE_URL}/?page=models" once that page is built.
        if not self.is_running():
            self.start_service()
        webbrowser.open(f"{BASE_URL}/docs")

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
        self.stop_service()
        self.icon.stop()

    def run(self):
        self.start_service()
        self.icon.run()


def main():
    NyxTrayApp().run()


if __name__ == "__main__":
    main()
