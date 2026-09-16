# Full-stack template

A minimal starting point for prototypes: a React (Vite) frontend, a Node.js/Express backend with ES modules, and Sequelize for database access. It runs locally with zero setup and deploys free on Render as a Docker web service plus a free Postgres instance, wired together by `render.yaml`.

## Stack

- **Frontend:** React 18 + Vite 5 (JavaScript, no TypeScript)
- **Backend:** Node.js + Express, ES modules
- **Database:** Sequelize ORM — **SQLite locally**, **PostgreSQL on Render**. The backend picks the dialect at startup from `DATABASE_URL`: blank means SQLite, a `postgres://` URL means Postgres.
- **Deploy:** Render free tier, provisioned from `render.yaml` (Blueprint)
- **Docker:** used only by Render's build — you do not need Docker installed to develop locally

## Project structure

```
.
├── backend/
│   ├── package.json
│   ├── server.js
│   └── db.js
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       └── styles.css
├── Dockerfile
├── render.yaml
├── .env.example
├── .gitignore
├── .dockerignore
└── README.md
```

## Local development

There is no database to install — SQLite is built in. The backend creates `backend/data.sqlite` on first run.

Terminal 1 — backend:

```bash
cd backend
npm install
npm run dev
```

Terminal 2 — frontend:

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` to the backend on port 3001.

## Drawing an image for a word

Set `GEMINI_API_KEY` in the environment (locally in `.env`, on Render under
Environment) and the word card gets a "draw" button. Image models are not on the
free tier - without billing the request comes back as an exhausted quota, and the
card says so. `IMAGE_MODEL` overrides the model, default `gemini-2.5-flash-image`.

## AI tutor

The same `GEMINI_API_KEY` switches on the tutor inside the progress block: a weekly digest
(numbers come from the app, the model only phrases them; cached 7 days) and a breakdown of recent
misses, one at a time. Rules explain what they can without the model (lookalike or homophone
letters, transposition, missing article, preposition + pronoun, speaker gender); Gemini Flash
(`gemini-3.6-flash`, thinking off, JSON schema) covers the rest, and every model answer is
validated before it is shown. `TUTOR_DAILY_CALLS` caps model calls per day (default 20),
`TUTOR_MODEL` overrides the model. The tutor never writes to the deck.

Evals on real misses from the ulpan site: `node evals/tutor-misses.mjs` (needs the key;
`--rules-only` runs offline). Fixtures: `backend/fixtures/tutor-misses.json`.

## Card assembly after a lesson

`POST /api/lessons/:id/enrich` (header `x-enrich-token`, value of `ENRICH_TOKEN`) fills empty
fields only: Pealim forms for the lesson's verbs, the teacher's sentences linked to words, a Hebrew
definition from he.wiktionary. Without `ENRICH_TOKEN` the route answers 503.

## Tests

Pure functions only, on Node's built-in runner — no dependencies to install:

```bash
cd backend  && node --test academy.test.js
cd frontend && node --test src/recall.test.js
```

## MCP server

`mcp/` exposes the vocabulary API to an agent, so words can be captured and looked up
from a conversation instead of the web page. It runs locally and calls the deployed
API, so nothing has to be committed or redeployed to use it.

```bash
cd mcp && npm install
node smoke.js          # exercises all five tools over the real protocol
```

Claude Code picks it up from `.mcp.json` in the repository root; restart it after the
first install. Point it at a local backend with `VOCAB_API_URL=http://localhost:3001`.

## Deploy to Render

1. Push this repo to GitHub.
2. In Render, choose **New → Blueprint** and connect the repo.
3. Render reads `render.yaml`, creates the web service and the Postgres database, and injects `DATABASE_URL` into the service — nothing to copy or paste.

Two free-tier caveats: the web service sleeps after inactivity, so the first request after a pause takes ~30 seconds, and Render's free Postgres expires after 30 days.

## Endpoints

- `GET /api/health` — verifies the database connection, returns `{ "status": "ok", "db": "sqlite" | "postgres" }`
- `GET /api/hello` — returns `{ "message": "Hello from the backend 👋" }`
- `GET /` — in production, serves the built frontend from `backend/public`
