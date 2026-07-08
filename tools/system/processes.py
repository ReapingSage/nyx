"""
tools/system/processes.py — Process Manager

"what's eating my CPU" → top processes by CPU/RAM (psutil, grouped by name).
"kill process chrome"  → terminates by name, behind the chat confirmation
flow, with Windows-critical processes and NYX itself protected.
"""

import os
import time

import psutil

from utils.logger import get_logger

log = get_logger(__name__)

# Never kill these, no matter what the user says — taking them down
# crashes or locks up Windows.
PROTECTED = {
    "system", "system idle process", "registry", "smss.exe", "csrss.exe",
    "wininit.exe", "winlogon.exe", "services.exe", "lsass.exe",
    "svchost.exe", "dwm.exe", "fontdrvhost.exe", "memcompression",
}


def top_processes(n: int = 8) -> str:
    """Top processes by CPU (sampled over ~0.4s), grouped by name, with RAM."""
    procs = list(psutil.process_iter(["name", "memory_info"]))
    for p in procs:
        try:
            p.cpu_percent(interval=None)  # prime the counters
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    time.sleep(0.4)

    grouped: dict[str, dict] = {}
    for p in procs:
        try:
            name = (p.info["name"] or "?").lower()
            if name == "system idle process":
                continue  # that's just unused CPU, not a consumer
            cpu = p.cpu_percent(interval=None)
            mem = p.info["memory_info"].rss if p.info["memory_info"] else 0
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
        g = grouped.setdefault(name, {"cpu": 0.0, "mem": 0, "count": 0})
        g["cpu"] += cpu
        g["mem"] += mem
        g["count"] += 1

    cores = psutil.cpu_count(logical=True) or 1
    rows = sorted(grouped.items(), key=lambda kv: (kv[1]["cpu"], kv[1]["mem"]), reverse=True)[:n]

    lines = []
    for name, g in rows:
        cpu_pct = g["cpu"] / cores  # normalize so 100% = whole machine
        mem_mb = g["mem"] / 1e6
        count = f" ×{g['count']}" if g["count"] > 1 else ""
        lines.append(f"  • {name}{count} — CPU {cpu_pct:.1f}%, RAM {mem_mb:,.0f} MB")

    total_cpu = psutil.cpu_percent(interval=None)
    vm = psutil.virtual_memory()
    return (
        f"Top processes (system: CPU {total_cpu:.0f}%, RAM {vm.percent:.0f}%):\n"
        + "\n".join(lines)
    )


def kill_process(name: str) -> str:
    """Terminate every process matching `name` (case-insensitive, .exe optional)."""
    target = name.lower().strip().strip('"')
    if not target:
        return "[Nyx] Which process?"
    candidates = {target, target + ".exe"} if not target.endswith(".exe") else {target}

    if candidates & PROTECTED or target in PROTECTED:
        return f"[Nyx] '{name}' is a Windows system process — killing it would crash the machine. Refusing."

    me = os.getpid()
    parents = set()
    try:
        proc = psutil.Process(me)
        while proc:
            parents.add(proc.pid)
            proc = proc.parent()
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass

    killed, denied = 0, 0
    for p in psutil.process_iter(["pid", "name"]):
        try:
            if (p.info["name"] or "").lower() not in candidates:
                continue
            if p.info["pid"] in parents or p.info["pid"] == me:
                return f"[Nyx] '{name}' is NYX's own process chain — stop NYX from the tray instead."
            p.terminate()
            killed += 1
        except psutil.AccessDenied:
            denied += 1
        except psutil.NoSuchProcess:
            continue

    if killed == 0 and denied == 0:
        return f"[Nyx] No running process matches '{name}'."
    result = f"Terminated {killed} '{name}' process{'es' if killed != 1 else ''}."
    if denied:
        result += f" ({denied} needed admin rights and couldn't be touched.)"
    log.info(f"[processes] {result}")
    return result
