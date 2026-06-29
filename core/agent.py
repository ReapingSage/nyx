"""
core/agent.py — Central Nyx Orchestrator
Maintains full conversation history for the session so Nyx
remembers everything said since startup.
"""

from brain import model_router, ollama_provider, openclaw_provider
from core import memory_manager, permissions, vault_bridge
import config
from utils.logger import get_logger

log = get_logger(__name__)


class NyxAgent:
    """
    The central brain of Nyx.
    Keeps a running message history so every reply has full context.
    Vault memory notes are injected as context and auto-refreshed when changed.
    """

    def __init__(self):
        self.history: list[dict] = [
            {"role": "system", "content": config.NYX_SYSTEM_PROMPT}
        ]
        self._vault_mtime: float = 0.0
        self._refresh_vault_context()
        log.info("NyxAgent initialized with system prompt loaded.")

    # ── Vault context helpers ─────────────────────────────

    def _vault_mtime_current(self) -> float:
        """Return the newest mtime across all Memory/*.md files."""
        d = vault_bridge.MEMORY_DIR
        if not d.exists():
            return 0.0
        mtimes = [f.stat().st_mtime for f in d.glob("*.md") if f.is_file()]
        return max(mtimes, default=0.0)

    def _refresh_vault_context(self) -> None:
        """Re-inject vault context into history if Memory/ files have changed."""
        current = self._vault_mtime_current()
        if current <= self._vault_mtime:
            return

        # Remove any previously injected vault context block
        self.history = [
            m for m in self.history
            if not (m["role"] == "system" and m["content"].startswith("[Vault Memory"))
        ]

        context = vault_bridge.read_context()
        if context:
            self.history.insert(1, {
                "role":    "system",
                "content": f"[Vault Memory — notes from your Obsidian knowledge base]\n\n{context}",
            })
            log.info("[vault] Context injected into session.")

        self._vault_mtime = current

    def handle(self, user_input: str) -> str:
        """
        Process a user message with full conversation context.

        Flow:
          1. Permission check
          2. Add user message to history
          3. Route to correct model
          4. Send full history to Ollama
          5. Add Nyx's reply to history
          6. Save exchange to disk
          7. Return response
        """
        stripped = user_input.strip()
        if not stripped:
            return ""

        # Refresh vault context if any Memory/*.md files changed
        self._refresh_vault_context()

        # ── Permission check ──────────────────────────────
        permissions.check(stripped)

        # ── Add user message to history ───────────────────
        self.history.append({"role": "user", "content": stripped})

        # ── Weather shortcut — real data, no LLM ─────────
        from tools.web.weather import is_weather_query, extract_location, get_weather
        if is_weather_query(stripped):
            location = extract_location(stripped)
            if location:
                response = get_weather(location)
                self.history.append({"role": "assistant", "content": response})
                memory_manager.save_exchange(user_input=stripped, response=response, model="weather-tool")
                return response

        # ── Web search — explicit commands + auto-detect live queries ──
        from tools.web.search import is_search_query, extract_search_query, search, build_context, needs_web
        explicit   = is_search_query(stripped)
        auto_web   = needs_web(stripped) and not explicit
        query      = extract_search_query(stripped) if explicit else stripped if auto_web else None

        if query:
            results = search(query, max_results=6)
            if results:
                context_block = build_context(query, results)
                augmented = self.history[:-1] + [
                    {"role": "system", "content": context_block},
                    {"role": "user",   "content": stripped},
                ]
                model, _ = model_router.route(stripped)
                response = ollama_provider.ask(model=model, messages=augmented)
            elif explicit:
                response = f"[Nyx] No results found for '{query}'. Try rephrasing."
            else:
                response = None  # fall through to normal LLM

            if response:
                self.history.append({"role": "assistant", "content": response})
                memory_manager.save_exchange(user_input=stripped, response=response, model="search+llm")
                return response

        # ── Route to correct model ────────────────────────
        model, reason = model_router.route(stripped)

        # Override: a pending OpenClaw action waits for "yes"/"no" —
        # those words won't hit DESKTOP_KEYWORDS, so force the route.
        if model != "openclaw" and (
            openclaw_provider.is_confirmation_of_pending(stripped)
            or openclaw_provider.is_cancellation_of_pending(stripped)
        ):
            model  = "openclaw"
            reason = "confirming/cancelling pending openclaw action"

        print(f"\n  [routing -> {model}]  ({reason})")

        # ── Dispatch to provider ──────────────────────────
        if model == "openclaw":
            if openclaw_provider.is_dangerous_command(stripped):
                response = "[Nyx] That action requires your confirmation before I can proceed."
            else:
                response, _ = openclaw_provider.dispatch(stripped)
                if not response:
                    response = "[Nyx] OpenClaw returned no response."
        else:
            response = ollama_provider.ask(model=model, messages=self.history)

        # ── Add Nyx's reply to history ────────────────────
        self.history.append({"role": "assistant", "content": response})

        # ── Save to disk ──────────────────────────────────
        memory_manager.save_exchange(user_input=stripped, response=response, model=model)

        # ── Extract memories from user input ──────────────
        try:
            from core.memory_extractor import extract_and_save
            extract_and_save(stripped, source="chat")
        except Exception as e:
            log.debug(f"[agent] Memory extraction non-fatal: {e}")

        return response

    def reset(self):
        """Clear conversation history but keep the system prompt."""
        self.history = [
            {"role": "system", "content": config.NYX_SYSTEM_PROMPT}
        ]
        log.info("Conversation history reset.")
        return "Memory cleared."