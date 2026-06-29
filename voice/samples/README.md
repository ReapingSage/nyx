# voice/samples — NYX Reference Voice Samples

Place voice reference files here for XTTS v2 voice cloning.

## How it works

XTTS v2 can clone a voice from a short audio sample.
Place your reference file here as `nyx_reference.wav` and the test
script will automatically use it for generation.

## File naming

| Filename              | Purpose                         |
|-----------------------|---------------------------------|
| `nyx_reference.wav`   | Primary NYX voice reference     |
| `nyx_alt1.wav`        | Alternative reference option    |
| `nyx_alt2.wav`        | Alternative reference option    |

Only `nyx_reference.wav` is used automatically.
To test alternatives, rename or update `SAMPLE_VOICE_PATH` in `voice_config.py`.

## Recording guidelines

- **Length**: 10–30 seconds minimum (longer = better)
- **Format**: WAV preferred (MP3 will also work with XTTS)
- **Quality**: Clean audio, no background noise, no music
- **Speaker**: Single speaker only
- **Content**: Any natural speech — reading aloud works well

## Voice identity goal

NYX should sound:
- Calm and measured
- Slightly lower register
- Intelligent, controlled
- No strong regional accent
- Deliberate pacing — not rushed

## Important

Do NOT use celebrity voices or copyrighted recordings.
This folder is for creating an original NYX voice identity.
Do NOT commit large WAV files to git (they are gitignored by default).
