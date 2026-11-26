# PaperDigest

An AI-powered research reading platform. The feed contains **60 randomly sampled computational research papers from [arXiv](https://arxiv.org/)** (ML, AI, computer vision, language, robotics, neural computing, statistics and computational finance); it ranks them by a visible, computed relevance score, and the reader pairs the **real arXiv PDF** with an AI companion that summarises the paper, suggests questions, answers your questions and generates study notes.

## Run it

One Flask server serves **both the frontend and the API**, so deployment needs a single site.

```bash
cp .env.example .env          # then put your real GEMINI_API_KEY in .env
source .venv/bin/activate
flask --app backend.app.main run --port 8000
```

Open **http://localhost:8000** — `/` is the feed, `/reader.html` is the AI reader, `/js/*` are the modules, and `/api/*` is the JSON API. Frontend files live in `public/`; ES modules require HTTP, so opening `index.html` via `file://` will not work.

For local frontend-only work you can still run `python3 -m http.server 5500 --directory public`; the browser client detects that port and calls the API at `127.0.0.1:8000`.

To deploy, set `GEMINI_API_KEY` in the host environment and serve the `backend.app.main:app` WSGI app, for example `gunicorn 'backend.app.main:app'`. No second static host is needed.

### Vercel

The repo includes a root `app.py` (exporting `app`) and root `requirements.txt` — Vercel's recognised Flask entrypoint and dependency manifest. Frontend files are in `public/`, which Vercel serves as static assets (`/`, `/reader.html`, `/js/*`); `/api/*` is routed to the Flask function. Set `GEMINI_API_KEY` in **Project Settings → Environment Variables**; without it the feed still works but the AI reader returns a configuration error. If an older deployment was created as a static-only project, redeploy after these files are pushed so Vercel re-detects the Flask framework.

Without a Gemini key the feed still works; only the AI reader returns a configuration error. If the API is not running, the feed automatically falls back to the committed arXiv snapshot (`public/js/data/snapshot.js`).

Refresh the snapshot with:

```bash
python3 scripts/generate_snapshot.py
```

## How it works

| Part | Location | Responsibility |
| --- | --- | --- |
| arXiv proxy + cache | `backend/app/arxiv.py` | Fetches a pool of 300 recent computational papers from the Atom API, randomly samples 60 (reproducible per day), caches 15 minutes |
| AI prompts + Gemini | `backend/app/ai.py` | Pure prompt builders/parsers plus the Gemini client |
| API endpoints | `backend/app/main.py` | `/api/papers?count=60&seed=...`, `/api/summarize`, `/api/questions`, `/api/ask`, `/api/notes` |
| Paper loading | `public/js/core/papers.js` | Live feed with offline snapshot fallback |
| Filter / score / sort | `public/js/core/filter.js`, `scoring.js`, `sort.js` | Pure, testable ranking logic |
| Roles | `public/js/core/roles.js` | Capability map enforced in UI and in mutations |
| Storage | `public/js/core/storage.js` | Defensive LocalStorage wrapper |
| API client | `public/js/core/api.js` | Browser-side calls to the backend |
| Feed page | `public/js/app.js`, `public/index.html` | Feed, filters, reading list, shared lists, digest |
| Reader page | `public/js/reader.js`, `public/reader.html` | Real PDF iframe, AI summary/questions/chat/notes |

## Roles

- **Student** — follows topics (arXiv categories) and keywords; these drive the relevance score and the "Why shown" reasons.
- **Faculty** — creates shared reading lists and adds/removes papers in them.
- **Club Editor** — selects papers and publishes the weekly digest.

All roles can save papers, track status/priority/notes, and use the AI reader. Role selection is a demo switch stored in LocalStorage.

## Tests

```bash
npm test                              # JS modules (Node built-in test runner, no dependencies)
python3 -m unittest discover -s backend/tests -v   # arXiv parser
```

## Data notes

Paper metadata, abstracts and PDF links come from the [arXiv API](https://info.arxiv.org/help/api/index.html) across computational categories (`cs.LG`, `cs.AI`, `cs.CV`, `cs.CL`, `cs.RO`, `cs.NE`, `stat.ML`, `q-fin.CP`). The backend fetches a pool of 300 recent papers and randomly selects 60; the selection is stable for a given day (or pass `?seed=` to reproduce one). arXiv does not send CORS headers, so the browser never calls arXiv directly — the Flask backend proxies it. Reading-list state, interests, shared lists, digests and research notes are stored in this browser's LocalStorage.
