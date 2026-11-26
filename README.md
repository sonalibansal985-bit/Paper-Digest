# PaperDigest — Backend API

Flask backend for PaperDigest. It fetches **60 randomly sampled computational research papers from [arXiv](https://arxiv.org/)**, and provides Gemini-powered endpoints that summarise a paper, suggest questions, answer questions and generate study notes.

The static frontend lives in a **separate repository**: [`Paper-Digest-Frontend`](https://github.com/sonalibansal985-bit/Paper-Digest-Frontend). This service is API-only.

## Run locally

```bash
cp .env.example .env          # add your GEMINI_API_KEY
source .venv/bin/activate
flask --app backend.app.main run --port 8000
```

Endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` or `/api` | Service info |
| GET | `/health` | Health check |
| GET | `/api/test` | Connection check (shows whether AI is configured) |
| GET | `/api/papers?count=60&seed=...&refresh=1` | Random computational papers from arXiv |
| POST | `/api/summarize` | Structured paper summary |
| POST | `/api/questions` | Suggested questions |
| POST | `/api/ask` | Answer a question about a paper |
| POST | `/api/notes` | Generated study notes |

POST bodies accept `{ "paper": {...}, "question": "..." }` where `paper` is the paper metadata object (`title`, `authors`, `abstract`, `categories`, `published`, ...).

Without a Gemini key the feed still works; AI endpoints return HTTP 503.

## CORS

The API allows cross-origin requests from the separate frontend. By default `Access-Control-Allow-Origin: *` is returned. To restrict it, set a comma-separated `ALLOWED_ORIGINS` environment variable, e.g.:

```bash
ALLOWED_ORIGINS=https://paper-digest-frontend.vercel.app
```

## Deploy (Vercel)

The repo has a root `app.py` exporting `app` and a root `requirements.txt`, which Vercel recognises as a Flask app. Deploy this repo to the backend project and set these environment variables in **Project Settings → Environment Variables**:

- `GEMINI_API_KEY` — required for AI endpoints
- `GEMINI_MODEL` — optional (default `gemini-3.5-flash-lite`, with fallbacks)
- `ALLOWED_ORIGINS` — optional

The deployed root URL returns JSON service info, not HTML. Point the frontend's `API_BASE` at this URL.

For other hosts, serve the WSGI app `backend.app.main:app`, e.g. `gunicorn 'backend.app.main:app'`.

## Layout

| Part | Location | Responsibility |
| --- | --- | --- |
| arXiv proxy + cache | `backend/app/arxiv.py` | Pool of 300 recent computational papers, random sample of 60, 15-minute cache |
| AI prompts + Gemini | `backend/app/ai.py` | Pure prompt builders/parsers plus Gemini client |
| Flask API | `backend/app/main.py` | Routes, JSON errors, CORS |
| Vercel entrypoint | `app.py` | Exposes `app` for WSGI hosting |
| Tests | `backend/tests/` | Flask routes + arXiv parser/sampler |

## Tests

```bash
.venv/bin/python -m unittest discover -s backend/tests -v
```

## Snapshot

`scripts/generate_snapshot.py` writes `snapshot.js` at the repo root. Copy it to the frontend repo as `js/data/snapshot.js` to refresh the frontend's offline fallback:

```bash
python3 scripts/generate_snapshot.py --output ../Paper-Digest-Frontend/js/data/snapshot.js
```

## Data notes

Metadata, abstracts and PDF links come from the [arXiv API](https://info.arxiv.org/help/api/index.html) across computational categories (`cs.LG`, `cs.AI`, `cs.CV`, `cs.CL`, `cs.RO`, `cs.NE`, `stat.ML`, `q-fin.CP`). arXiv does not send CORS headers, so the browser never calls it directly — this API proxies it.
