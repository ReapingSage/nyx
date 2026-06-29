"""
voice/test_voice.py - NYX Voice Generation Test

Run from the project root:
    python voice/test_voice.py

Optional args:
    python voice/test_voice.py --line 2          # test a different NYX line
    python voice/test_voice.py --text "Hello."   # test custom text
    python voice/test_voice.py --list            # list all test lines
    python voice/test_voice.py --voices          # list available edge-tts voices
    python voice/test_voice.py --play            # auto-play after generation
"""

import sys
import argparse
from pathlib import Path

# Allow running from project root or from voice/ directory
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))


def main():
    parser = argparse.ArgumentParser(description="NYX Voice Test")
    parser.add_argument("--text",   type=str, help="Custom text to speak")
    parser.add_argument("--line",   type=int, default=1, help="NYX test line number (1-5)")
    parser.add_argument("--list",   action="store_true", help="List all test lines and exit")
    parser.add_argument("--voices", action="store_true", help="List available edge-tts voices and exit")
    parser.add_argument("--play",   action="store_true", help="Auto-play the file after generation")
    args = parser.parse_args()

    has_edge    = _check_import("edge_tts")
    has_xtts    = _check_import("TTS")
    has_pyttsx3 = _check_import("pyttsx3")

    print("\n======================================")
    print("         NYX VOICE TEST v1")
    print("======================================\n")

    print("  Engine status:")
    _status("XTTS v2 (Coqui)  ", has_xtts,
            "not installed - needs Python 3.9-3.11 + pip install TTS")
    _status("edge-tts         ", has_edge,
            "not installed - run: pip install edge-tts")
    _status("pyttsx3 (fallback)", has_pyttsx3,
            "not installed - run: pip install pyttsx3")
    print()

    if not has_edge and not has_xtts and not has_pyttsx3:
        print("  [!] No TTS engine is installed.\n")
        print("  Install edge-tts (recommended for Python 3.14+):")
        print("      pip install edge-tts\n")
        print("  Or install Coqui TTS (requires Python 3.9-3.11):")
        print("      pip install TTS soundfile\n")
        sys.exit(1)

    # List mode
    if args.list:
        from voice.voice_config import NYX_TEST_LINES
        print("  Available NYX test lines:\n")
        for i, line in enumerate(NYX_TEST_LINES, 1):
            print(f"    {i}. {line}")
        print()
        return

    if args.voices:
        if not has_edge:
            print("  edge-tts is not installed. Run: pip install edge-tts\n")
            sys.exit(1)
        _list_edge_voices()
        return

    # Select text
    from voice.voice_config import NYX_TEST_LINES, OUTPUT_DIR, SAMPLE_VOICE_PATH

    if args.text:
        text = args.text
    else:
        idx  = max(1, min(args.line, len(NYX_TEST_LINES))) - 1
        text = NYX_TEST_LINES[idx]

    print(f"  Text   : \"{text}\"")

    # Check sample
    sample = Path(SAMPLE_VOICE_PATH) if SAMPLE_VOICE_PATH else None
    if sample and sample.exists():
        print(f"  Sample : {sample} [found]")
    elif has_xtts and not has_edge:
        print(f"\n  [!] XTTS v2 requires a reference sample at:\n      {sample}")
        print("  See voice/samples/README.md for instructions.\n")
        sys.exit(1)
    else:
        if sample:
            print("  Sample : not found - using edge-tts without voice cloning")

    print()
    print("  Generating audio...")

    from voice.text_to_speech import speak_to_file
    output = speak_to_file(text)

    if output and output.exists():
        size_kb = output.stat().st_size // 1024
        print(f"\n  [OK] Generated: {output}")
        print(f"       Size     : {size_kb} KB\n")
        print("  Next steps:")
        print(f"    1. Open and listen: {output}")
        print("    2. To try a different voice, edit EDGE_VOICE in voice/voice_config.py")
        print("    3. To test another line: python voice/test_voice.py --line 2")
        print("    4. To list all voices:   python voice/test_voice.py --voices")
        print("    5. To use XTTS cloning:  place WAV at voice/samples/nyx_reference.wav\n")

        if args.play:
            from voice.text_to_speech import _play_audio
            _play_audio(output)
            print("  Playing...\n")
    else:
        print("\n  [!] Generation failed.")
        print("  Check engine status above and install a TTS package.\n")
        sys.exit(1)


def _status(label: str, ok: bool, fail_hint: str) -> None:
    mark = "[OK]" if ok else "[--]"
    note = "[active]" if ok else f"[{fail_hint}]"
    print(f"    {mark} {label}  {note}")


def _check_import(name: str) -> bool:
    try:
        __import__(name)
        return True
    except ImportError:
        return False


def _list_edge_voices():
    import asyncio
    import edge_tts

    async def _fetch():
        voices    = await edge_tts.list_voices()
        en_voices = [v for v in voices if v["Locale"].startswith("en-")]
        print(f"\n  English edge-tts voices ({len(en_voices)} total):\n")
        for v in sorted(en_voices, key=lambda x: x["Locale"]):
            print(f"    {v['ShortName']:<34}  {v['Gender']}")
        print()

    asyncio.run(_fetch())


if __name__ == "__main__":
    main()
