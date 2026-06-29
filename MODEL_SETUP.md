# Model Setup Guide

NYX uses [Ollama](https://ollama.com) to run AI models locally on your machine. This guide covers manual setup — if you'd rather use the built-in Model Manager in the NYX dashboard, it does all of this for you.

NYX never bundles or stores model files in this repository. All models are downloaded directly through Ollama.

## 1. Install Ollama manually

Download and run the installer for your OS from the official site:

**https://ollama.com/download**

Windows, macOS, and Linux are all supported.

## 2. Check if Ollama is installed

Open a terminal and run:

```
ollama --version
```

If you see a version number, it's installed. If you get "command not recognized" / "command not found", see [Troubleshooting](#9-ollama-is-not-recognized) below.

## 3. Check installed models

```
ollama list
```

This shows every model currently downloaded on your machine, along with their size.

## 4. Manually install recommended models

Pull a model with:

```
ollama pull <model-name>
```

### Recommended for laptops

```
ollama pull qwen2.5-coder:3b
ollama pull llama3.2:3b
ollama pull phi3
```

### Recommended for desktops / stronger PCs

```
ollama pull qwen2.5-coder:7b
ollama pull llama3.1:8b
```

You don't need every model — NYX works fine with just one (it'll use that single model for every role). More models let NYX route coding questions, general questions, and quick questions to different specialists.

## 5. How to remove models

```
ollama rm <model-name>
```

Example:

```
ollama rm llama3.1:8b
```

## 6. Best models for laptops

Smaller models (`3b` and under) run faster on limited RAM/CPU and don't need a dedicated GPU:

- `qwen2.5-coder:3b` — coding
- `llama3.2:3b` — general assistant
- `phi3` — fast, lightweight responses

## 7. Best models for stronger PCs

If you have 16GB+ RAM or a dedicated GPU, larger models give noticeably better answers:

- `qwen2.5-coder:7b` — coding
- `llama3.1:8b` — general assistant
- `mistral` or `gemma` — alternative general models, try both and see which you prefer

## 8. What to do if downloads are slow

- Model files are several gigabytes — this is normal on slower internet connections
- Pulling can be paused by closing the terminal and resumed later by running the same `ollama pull` command again (Ollama resumes partial downloads)
- Try downloading one model at a time rather than several at once
- If a download seems stuck, cancel it (Ctrl+C) and retry the same command

## 9. "ollama is not recognized"

This means Ollama isn't on your system PATH. Fixes:

- **Restart your terminal** after installing — this is the most common fix
- **Restart your computer** if restarting the terminal doesn't help
- Reinstall Ollama from https://ollama.com/download and make sure the installer completes fully
- On Windows, confirm Ollama appears in `C:\Users\<you>\AppData\Local\Programs\Ollama`

## 10. Restart NYX after installing models

After pulling new models, restart NYX so it picks up the change:

1. Stop NYX (close the terminal running `app.py` / `uvicorn`, or use the tray app's Stop button)
2. Start it again
3. Open the Model Manager in the dashboard and it will automatically detect the newly installed models

---

## Quick reference

```
ollama --version                    # check installation
ollama list                         # list installed models
ollama pull qwen2.5-coder:3b        # install a laptop-friendly coding model
ollama pull llama3.2:3b             # install a laptop-friendly general model
ollama pull qwen2.5-coder:7b        # install a desktop-friendly coding model
ollama pull llama3.1:8b             # install a desktop-friendly general model
ollama rm <model-name>              # remove a model
```
