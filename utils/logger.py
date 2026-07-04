"""
utils/logger.py — Shared Logger
Import this in any module: from utils.logger import get_logger
"""

import logging
import logging.handlers
import os

LOG_FILE = os.path.join(os.path.dirname(__file__), "..", "logs", "nyx.log")
os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)

# Rotate at ~2 MB so the file never grows unbounded — the Settings → Logs
# page tails this file on a poll, and reading a multi-megabyte log every few
# seconds is wasted I/O.
_handler = logging.handlers.RotatingFileHandler(
    LOG_FILE, encoding="utf-8", maxBytes=2_000_000, backupCount=2,
)

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
    handlers=[_handler],
)


class _DropClientDisconnectNoise(logging.Filter):
    """Windows' proactor event loop logs a full ERROR traceback every time a
    browser tab or websocket drops mid-transfer (ConnectionResetError). It's
    harmless client-disconnect noise and it was flooding the log by the tens
    of thousands — drop just those records."""

    def filter(self, record: logging.LogRecord) -> bool:
        if record.exc_info and isinstance(
            record.exc_info[1], (ConnectionResetError, ConnectionAbortedError)
        ):
            return False
        return "_call_connection_lost" not in record.getMessage()


logging.getLogger("asyncio").addFilter(_DropClientDisconnectNoise())


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
