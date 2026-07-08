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

    # Conversation messages kept (system/vault messages are always kept).
    # Unbounded history makes every Ollama call slower and slower and
    # eventually overflows the model's context window entirely.
    MAX_CONVO_MESSAGES = 40

    def __init__(self):
        self.history: list[dict] = [
            {"role": "system", "content": config.NYX_SYSTEM_PROMPT}
        ]
        log.info("NyxAgent initialized with system prompt loaded.")

    # ── Vault context helpers ─────────────────────────────

    def _inject_vault_context(self, query: str) -> None:
        """Inject vault memory relevant to this message (RAG via
        core/memory_rag; falls back to the full vault when embeddings are
        unavailable or the vault is small). Replaces any previous block so
        the context always matches the current message."""
        try:
            from core import memory_rag
            context = memory_rag.get_context(query)
        except Exception as e:
            log.warning(f"[vault] Retrieval failed, using full context: {e}")
            context = vault_bridge.read_context()

        self.history = [
            m for m in self.history
            if not (m["role"] == "system" and m["content"].startswith("[Vault Memory"))
        ]
        if context:
            self.history.insert(1, {
                "role":    "system",
                "content": f"[Vault Memory — notes from your knowledge base]\n\n{context}",
            })

    def _trim_history(self) -> None:
        """Cap the conversation at MAX_CONVO_MESSAGES, keeping all system
        (prompt + vault context) messages and the most recent exchanges."""
        system = [m for m in self.history if m["role"] == "system"]
        convo  = [m for m in self.history if m["role"] != "system"]
        if len(convo) > self.MAX_CONVO_MESSAGES:
            self.history = system + convo[-self.MAX_CONVO_MESSAGES:]

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

        # Inject vault memory relevant to this message
        self._inject_vault_context(stripped)

        # ── Permission check ──────────────────────────────
        if not permissions.check(stripped):
            response = (
                "[Nyx] This request was blocked by your Privacy setting "
                "(\"Block dangerous actions\" is enabled in Settings → Privacy)."
            )
            self.history.append({"role": "user", "content": stripped})
            self.history.append({"role": "assistant", "content": response})
            memory_manager.save_exchange(user_input=stripped, response=response, model="permissions-block")
            return response

        # ── Add user message to history ───────────────────
        self.history.append({"role": "user", "content": stripped})

        # ── Timer shortcut — real timers, no LLM ─────────
        from tools.system.timers import try_handle as try_handle_timer
        timer_response = try_handle_timer(stripped)
        if timer_response:
            self.history.append({"role": "assistant", "content": timer_response})
            self._trim_history()
            memory_manager.save_exchange(user_input=stripped, response=timer_response, model="timer-tool")
            return timer_response

        # ── Music player control — NYX's own player, no LLM ──
        # Gated behind the Music plugin; when it's not installed, music
        # phrases fall through to the system media keys instead.
        from core import plugin_registry
        music_response = None
        if plugin_registry.is_installed("music"):
            from tools.system.music_control import try_handle as try_handle_music
            music_response = try_handle_music(stripped)
        if music_response:
            self.history.append({"role": "assistant", "content": music_response})
            self._trim_history()
            memory_manager.save_exchange(user_input=stripped, response=music_response, model="music-tool")
            return music_response

        # ── Weather shortcut — real data, no LLM ─────────
        from tools.web.weather import is_weather_query, extract_location, get_weather
        if is_weather_query(stripped):
            location = extract_location(stripped)
            if location:
                response = get_weather(location)
                self.history.append({"role": "assistant", "content": response})
                self._trim_history()
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
                self._trim_history()
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
        self._trim_history()

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