"""
tests/test_provider_router.py — Focused test for provider routing,
per-agent priority, and health/cooldown/fallback behavior.

No pytest dependency in this project yet, so this is a plain script with
assertions — run directly: python tests/test_provider_router.py
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core import provider_router


def reset():
    provider_router._health.clear()


def test_fresh_provider_is_healthy():
    reset()
    assert provider_router.is_healthy("tavily") is True
    print("PASS: fresh provider is healthy by default")


def test_failure_marks_unhealthy():
    reset()
    provider_router.mark_failure("tavily")
    assert provider_router.is_healthy("tavily") is False
    snap = provider_router.health_snapshot("tavily")
    assert snap["healthy"] is False
    assert snap["consecutive_failures"] == 1
    assert snap["retry_at"] is not None
    print("PASS: mark_failure() marks the provider unhealthy with a retry_at timestamp")


def test_success_clears_unhealthy():
    reset()
    provider_router.mark_failure("tavily")
    assert provider_router.is_healthy("tavily") is False
    provider_router.mark_success("tavily")
    assert provider_router.is_healthy("tavily") is True
    snap = provider_router.health_snapshot("tavily")
    assert snap["consecutive_failures"] == 0
    assert snap["retry_at"] is None
    print("PASS: mark_success() clears unhealthy state")


def test_exponential_backoff_increases_cooldown():
    reset()
    provider_router.mark_failure("tavily")
    first_retry_at = provider_router.health_snapshot("tavily")["retry_at"]
    provider_router._health["tavily"]["unhealthy_until"] = time.time() - 1  # force expiry
    provider_router.mark_failure("tavily")
    second_snap = provider_router.health_snapshot("tavily")
    assert second_snap["consecutive_failures"] == 2
    first_cooldown = first_retry_at - time.time()
    second_cooldown = second_snap["retry_at"] - time.time()
    assert second_cooldown > first_cooldown, "second failure should cool down longer than the first"
    print("PASS: repeated failures increase cooldown duration (exponential backoff)")


def test_cooldown_caps_at_max():
    reset()
    for _ in range(10):
        provider_router.mark_failure("tavily")
        provider_router._health["tavily"]["unhealthy_until"] = time.time() - 1  # force expiry between attempts
    snap = provider_router.health_snapshot("tavily")
    remaining = snap["retry_at"] - time.time() if snap["retry_at"] else 0
    assert remaining <= provider_router.MAX_COOLDOWN_SECONDS + 1
    print("PASS: cooldown is capped at MAX_COOLDOWN_SECONDS even after many failures")


def test_per_agent_priority_is_independent():
    from core import app_settings
    app_settings.update_section("api_priority", {"momus": ["ddg", "tavily"], "hemera": ["tavily", "ddg"]})
    momus_order = provider_router.get_priority("momus", ["tavily", "ddg"])
    hemera_order = provider_router.get_priority("hemera", ["tavily", "ddg"])
    assert momus_order[0] == "ddg", f"expected momus primary=ddg, got {momus_order}"
    assert hemera_order[0] == "tavily", f"expected hemera primary=tavily, got {hemera_order}"
    print("PASS: Momus and Hemera have independent provider priority despite sharing search.py")
    # Restore default for cleanliness
    app_settings.update_section("api_priority", {"momus": ["tavily", "ddg"], "hemera": ["tavily", "ddg"]})


def test_get_priority_appends_missing_known_providers():
    from core import app_settings
    app_settings.update_section("api_priority", {"__test_agent__": ["ddg"]})
    order = provider_router.get_priority("__test_agent__", ["tavily", "ddg"])
    assert "tavily" in order, "a known provider missing from a custom order should still be reachable"
    print("PASS: get_priority() defensively appends known providers dropped from a custom order")


def test_search_falls_back_to_ddg_on_tavily_failure():
    """Full integration: tools.web.search.search() should mark tavily
    unhealthy on a hard failure and still return a usable (DDG) result,
    never raising and never returning nothing."""
    reset()
    from core import app_settings
    app_settings.update_section("api_priority", {"__test_search_agent__": ["tavily", "ddg"]})

    import config
    original_key = config.TAVILY_API_KEY
    config.TAVILY_API_KEY = "tvly-fake-test-key-for-failure-path"

    import tools.web.search as search_mod

    def _boom(query, max_results):
        raise RuntimeError("simulated network failure")

    original_tavily_fn = search_mod._search_tavily
    search_mod._search_tavily = _boom

    def _fake_ddg(query, max_results):
        return [{"title": "fallback result", "href": "https://example.com", "body": "..."}]

    original_ddg_fn = search_mod._search_ddg
    search_mod._search_ddg = _fake_ddg

    try:
        results = search_mod.search("test query", agent="__test_search_agent__")
        assert results == [{"title": "fallback result", "href": "https://example.com", "body": "..."}]
        assert provider_router.is_healthy("tavily") is False, "a hard Tavily failure should mark it unhealthy"
        print("PASS: search() survives a hard Tavily failure and falls back to DDG without losing the request")
    finally:
        config.TAVILY_API_KEY = original_key
        search_mod._search_tavily = original_tavily_fn
        search_mod._search_ddg = original_ddg_fn
        reset()


if __name__ == "__main__":
    tests = [
        test_fresh_provider_is_healthy,
        test_failure_marks_unhealthy,
        test_success_clears_unhealthy,
        test_exponential_backoff_increases_cooldown,
        test_cooldown_caps_at_max,
        test_per_agent_priority_is_independent,
        test_get_priority_appends_missing_known_providers,
        test_search_falls_back_to_ddg_on_tavily_failure,
    ]
    failed = 0
    for t in tests:
        try:
            t()
        except AssertionError as e:
            failed += 1
            print(f"FAIL: {t.__name__}: {e}")
        except Exception as e:
            failed += 1
            print(f"ERROR: {t.__name__}: {e}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    sys.exit(1 if failed else 0)
