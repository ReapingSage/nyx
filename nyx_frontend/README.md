# NYX — Frontend

Cinematic AI presence interface for the Nyx desktop assistant.

## Stack
- React 18 + Vite
- Framer Motion (transitions)
- TailwindCSS (utilities)
- Canvas 2D (orb animation)

## Setup

```bash
npm install
npm run dev
```

Open: http://localhost:5173

## Backend Required
The Nyx FastAPI server must be running:

```bash
# From your nyx/ folder
uvicorn ui.server:app --reload --port 8000
```

And Ollama must be running:
```bash
ollama serve
```

## Two Modes
- **Core Mode** — Dashboard with large animated orb
- **Chat Mode** — Click orb or press Enter; orb glides to bottom-right

## Env Variables
Copy `.env.example` to `.env` and adjust `VITE_API_URL` if needed.