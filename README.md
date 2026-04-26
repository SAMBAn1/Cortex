# Cortex

A second-brain note-taking app for product managers (and anyone who lives in noise).

Capture markdown notes, parse natural-language dates ("review with Maya next Tuesday at 4pm"), see commitments on a scrollable timeline + calendar, link notes with `[[wikilinks]]`, view the graph, and ask an LLM to surface what to do next.

## Features

- **Markdown editor** (CodeMirror 6) with `[[wikilinks]]`, `#tags`, headings
- **Natural-language date extraction** — every date you mention shows up on the timeline & calendar
- **Per-line edit history** — every save is timestamped & diffed
- **Graph view** of backlinks
- **Folder tree** with drag-to-move
- **Dashboard** — scrollable timeline strip, 6-day activity chart (tasks due / notes written), quick capture, AI panel
- **LLM second-brain** — Anthropic Claude integration. Suggests next actions based on your notes, fetches linked URLs, answers questions across your vault
- **Local-first** — all data lives in your browser's IndexedDB. Export/import as JSON anytime
- **Light & dark** themes; AI panel can sit on either side
- **Icon-only navigation** — no labels, just intuitive product design

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS
- CodeMirror 6
- Cytoscape.js (graph)
- Recharts (activity chart)
- chrono-node (date parsing)
- Zustand (state)
- IndexedDB via `idb`
- Anthropic API (browser-direct calls)

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173` (Vite will print the URL).

## Build for web demo

```bash
npm run build
```

Output is `dist/` — deploy to GitHub Pages, Vercel, Netlify, or any static host.

For GitHub Pages, set the project's site to publish from `dist/`. The router is hash-based so deep links work without server config.

## Configure the LLM

Open **Settings** in the sidebar (gear icon). Paste your Anthropic API key. Calls go directly from your browser to `api.anthropic.com` — no server in between.

## Roadmap

- [ ] Tauri shell for installable desktop app (real `.md` files on disk)
- [ ] File System Access API adapter (Chrome/Edge — real folders today)
- [ ] Full-text search index
- [ ] Google Docs / Drive OAuth so the LLM can read protected linked docs
- [ ] Note templates
- [ ] Recurring tasks

## License

MIT
