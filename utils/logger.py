"""
utils/logger.py — Shared Logger
Import this in any module: from utils.logger import get_logger
"""

import logging
import os

LOG_FILE = os.path.join(os.path.dirname(__file__), "..", "logs", "nyx.log")
os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
    ],
)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)