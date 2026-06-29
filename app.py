"""
app.py — Nyx Entry Point
Run with: python app.py
"""

import sys
import os

# Make sure all local imports resolve from the nyx/ root
sys.path.insert(0, os.path.dirname(__file__))

import config
from core.agent import NyxAgent
from tools.desktop.open_apps import handle_app_command

# ── ANSI colors ───────────────────────────────────────────
CYAN   = "\033[96m"
GREEN  = "\033[92m"
DIM    = "\033[2m"
PURPLE = "\033[95m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

DIVIDER = f"{DIM}{'─' * 52}{RESET}"

EXIT_WORDS = {"exit", "quit", "bye", "q"}


def print_banner():
    print(f"\n{CYAN}{BOLD}")
    print("  ███╗   ██╗██╗   ██╗██╗  ██╗")
    print("  ████╗  ██║╚██╗ ██╔╝╚██╗██╔╝")
    print("  ██╔██╗ ██║ ╚████╔╝  ╚███╔╝ ")
    print("  ██║╚██╗██║  ╚██╔╝   ██╔██╗ ")
    print("  ██║ ╚████║   ██║   ██╔╝ ██╗")
    print("  ╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝")
    print(f"{RESET}")
    print(f"{DIM}  Local AI Desktop Assistant{RESET}")
    print(f"{DIM}  Models: llama3.1 · phi3 · deepseek-coder · qwen2.5{RESET}")
    print(f"{DIM}  Type 'help' for commands · 'exit' to quit{RESET}")
    print(f"\n{DIVIDER}\n")


def print_help():
    print(f"""
{CYAN}Commands:{RESET}
  open browser      → open your browser
  open notepad      → open text editor
  open calculator   → open calculator
  open discord      → open Discord
  help              → show this list
  exit / quit       → close Nyx

{CYAN}Routing:{RESET}
  Code questions    → deepseek-coder:6.7b
  Quick questions   → phi3
  Planning/analysis → qwen2.5:7b
  Everything else   → llama3.1:8b
""")


def main():
    print_banner()
    print(f"  {PURPLE}Systems online, {config.NYX_TITLE}.{RESET}\n")
    print(DIVIDER)

    agent = NyxAgent()

    while True:
        try:
            user_input = input(f"\n{GREEN}{BOLD}You:{RESET} ").strip()
        except (KeyboardInterrupt, EOFError):
            print(f"\n\n{CYAN}  Goodbye.{RESET}\n")
            break

        if not user_input:
            continue

        if user_input.lower() in EXIT_WORDS:
            print(f"\n{DIVIDER}\n{CYAN}  Goodbye, {config.NYX_TITLE}.{RESET}\n")
            break

        if user_input.lower() == "help":
            print_help()
            continue

        # Check app open commands first (no AI needed)
        app_result = handle_app_command(user_input)
        if app_result:
            print(f"\n{CYAN}{BOLD}Nyx:{RESET}  {app_result}")
            continue

        # Route to AI
        print(f"{DIM}  thinking...{RESET}", end="\r", flush=True)
        response = agent.handle(user_input)
        print(" " * 20, end="\r")  # clear "thinking..."

        print(f"\n{CYAN}{BOLD}Nyx:{RESET}")
        for line in response.splitlines():
            print(f"  {line}")


if __name__ == "__main__":
    main()