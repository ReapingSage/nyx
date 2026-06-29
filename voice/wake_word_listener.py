"""
voice/wake_word_listener.py — NYX Background Wake Word Listener

Runs as a SEPARATE PROCESS. Listens to your microphone continuously.
When it hears "nyx" (or "nix" / "nicks"), it POSTs to the NYX backend,
which sends a WebSocket event to the browser — even if the tab is backgrounded.

Requirements:
    pip install SpeechRecognition PyAudio requests
    # If PyAudio fails on Python 3.14, try:
    pip install SpeechRecognition sounddevice requests

Usage (keep running in a separate terminal):
    cd C:\\Users\\saget\\OneDrive\\Documents\\nyx
    python voice/wake_word_listener.py

Stop with Ctrl+C.
"""

import sys
import time
import requests
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

WAKE_WORDS  = ['hey nyx', 'hey nix', 'hey nicks']
BACKEND_URL = 'http://localhost:8000/api/voice/wake'

VIRTUAL_KEYWORDS = [
    'virtual', 'voicemod', 'voicemeeter', 'vb-audio', 'vb audio',
    'cable input', 'cable output', 'morphvox', 'clownfish',
    'obs', 'streamlabs', 'nvidia broadcast', 'rtx voice', 'krisp',
    'sound mapper',       # Windows pass-through — routes to system default (could be Voicemod)
    'primary sound',      # same issue
    'usb 2.0 camera',     # webcam mic, low quality
    'usb audio device',   # generic, usually low quality
]


def find_real_mic_index():
    """Return PyAudio device index of the first real (non-virtual) microphone."""
    try:
        import pyaudio
        p = pyaudio.PyAudio()
        found = None
        print('[NYX Wake] Available microphones:')
        for i in range(p.get_device_count()):
            info = p.get_device_info_by_index(i)
            if info['maxInputChannels'] < 1:
                continue
            name  = info['name']
            is_virt = any(kw in name.lower() for kw in VIRTUAL_KEYWORDS)
            tag   = '  [VIRTUAL — skipped]' if is_virt else ''
            print(f'  [{i}] {name}{tag}')
            if found is None and not is_virt:
                found = i
        p.terminate()
        if found is not None:
            print(f'[NYX Wake] Selected mic index: {found}')
        return found
    except Exception:
        return None


def notify_backend():
    """Tell the NYX backend a wake word was detected."""
    try:
        requests.post(BACKEND_URL, timeout=2)
        print('[NYX Wake] Notified backend.')
    except requests.exceptions.ConnectionError:
        print('[NYX Wake] Backend not reachable — is the server running on port 8000?')
    except Exception as e:
        print(f'[NYX Wake] Notify error: {e}')


def run_with_pyaudio():
    """Standard approach using SpeechRecognition + PyAudio."""
    import speech_recognition as sr

    recognizer = sr.Recognizer()
    recognizer.energy_threshold         = 50     # minimum threshold
    recognizer.dynamic_energy_threshold = False  # never auto-adjust up
    recognizer.pause_threshold          = 0.3
    recognizer.non_speaking_duration    = 0.2

    mic_index = find_real_mic_index()
    mic = sr.Microphone(device_index=mic_index, sample_rate=16000)

    print('[NYX Wake] Calibrating microphone (0.5 s)...')
    with mic as source:
        recognizer.adjust_for_ambient_noise(source, duration=0.5)
    # Force it back down after calibration — calibration tends to raise it
    recognizer.energy_threshold = 50

    print(f'[NYX Wake] Listening for: {WAKE_WORDS}')
    print('[NYX Wake] Press Ctrl+C to stop.\n')

    while True:
        try:
            with mic as source:
                audio = recognizer.listen(source, timeout=12, phrase_time_limit=5)
            try:
                text = recognizer.recognize_google(audio, language='en-US').lower()
                print(f'[NYX Wake] Heard: "{text}"')
                if any(w in text for w in WAKE_WORDS):
                    print('[NYX Wake] Wake word detected!')
                    notify_backend()
            except sr.UnknownValueError:
                pass   # silence or unclear
            except sr.RequestError as e:
                print(f'[NYX Wake] Google STT unavailable: {e}')
                time.sleep(3)
        except sr.WaitTimeoutError:
            pass   # no speech in window
        except KeyboardInterrupt:
            raise
        except Exception as e:
            print(f'[NYX Wake] Error: {e}')
            time.sleep(1)


def run_with_sounddevice():
    """Alternative: use sounddevice for audio capture + SpeechRecognition for STT."""
    import speech_recognition as sr
    import sounddevice as sd
    import numpy as np

    SAMPLE_RATE  = 16000
    CHUNK_SEC    = 3
    CHUNK_FRAMES = SAMPLE_RATE * CHUNK_SEC

    recognizer = sr.Recognizer()

    # Find real mic — sounddevice uses different indexing, match by name
    real_device = None
    try:
        import pyaudio
        p = pyaudio.PyAudio()
        for i in range(p.get_device_count()):
            info = p.get_device_info_by_index(i)
            if info['maxInputChannels'] > 0:
                name = info['name'].lower()
                if not any(kw in name for kw in VIRTUAL_KEYWORDS):
                    real_device = info['name']
                    break
        p.terminate()
    except Exception:
        pass

    print(f'[NYX Wake] Using sounddevice backend. Listening for: {WAKE_WORDS}')
    print('[NYX Wake] Press Ctrl+C to stop.\n')

    while True:
        try:
            # Record a short chunk
            recording = sd.rec(CHUNK_FRAMES, samplerate=SAMPLE_RATE,
                               channels=1, dtype='int16',
                               device=real_device)
            sd.wait()

            # Amplify signal 4x so quiet speech reaches Google STT clearly
            amplified = np.clip(recording.astype(np.float32) * 4.0, -32768, 32767).astype(np.int16)
            raw = amplified.tobytes()
            audio = sr.AudioData(raw, SAMPLE_RATE, 2)

            try:
                text = recognizer.recognize_google(audio, language='en-US').lower()
                print(f'[NYX Wake] Heard: "{text}"')
                if any(w in text for w in WAKE_WORDS):
                    print('[NYX Wake] Wake word detected!')
                    notify_backend()
            except sr.UnknownValueError:
                pass
            except sr.RequestError as e:
                print(f'[NYX Wake] STT unavailable: {e}')
                time.sleep(3)
        except KeyboardInterrupt:
            raise
        except Exception as e:
            print(f'[NYX Wake] Error: {e}')
            time.sleep(1)


def main():
    try:
        import speech_recognition  # noqa
    except ImportError:
        print('[NYX Wake] SpeechRecognition not installed.')
        print('  Run: pip install SpeechRecognition PyAudio')
        print('  Or:  pip install SpeechRecognition sounddevice')
        sys.exit(1)

    # Try PyAudio first; fall back to sounddevice
    try:
        import pyaudio  # noqa
        print('[NYX Wake] Using PyAudio backend.')
        run_with_pyaudio()
    except ImportError:
        pass

    try:
        import sounddevice  # noqa
        print('[NYX Wake] PyAudio unavailable — using sounddevice backend.')
        run_with_sounddevice()
    except ImportError:
        print('[NYX Wake] No audio backend found.')
        print('  Run: pip install PyAudio')
        print('  Or:  pip install sounddevice')
        sys.exit(1)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\n[NYX Wake] Stopped.')
