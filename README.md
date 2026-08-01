# North — a collaborative travel planner

A real-time collaborative trip planner: a group joins a shared trip room, everyone submits
preferences and votes on destinations live, and an LLM synthesizes a day-by-day itinerary
from the group's combined input — grounded in real geography and real dates, not just the
model's guesses.

**Live:** https://54-198-7-224.sslip.io

## What it does

- **Auth & trips** — email/password auth (JWT), trip creation with shareable invite codes,
  membership management.
- **Real-time collaboration** (Socket.io) — live member presence, live field-focus indicators
  ("editing destinations"), live preference sync, and live vote tallies, all pushed to every
  member of a trip room with no polling.
- **AI itinerary synthesis** (Groq / Llama 3.3 70B) — generates a day-by-day itinerary from
  the group's preferences and votes, debounced and lock-protected so concurrent edits from
  multiple members trigger exactly one synthesis run, not one per keystroke.
- **Geography grounding** — destinations are geocoded (OpenStreetMap Nominatim) and ordered
  with a nearest-neighbor route algorithm (Haversine distance) computed in real code, then
  handed to the LLM as a fixed constraint — the model organizes and writes content, it doesn't
  get to invent the visiting order.
- **Guardrails on LLM output** — deterministic post-processing that catches unfulfilled
  must-see items (typo-tolerant fuzzy matching), budget blowouts, and enforces trip-length
  constraints, augmenting the model's own conflict detection rather than trusting it blindly.

## Architecture

| Layer | Choice | Why |
|---|---|---|
| Relational data (users, trips, membership) | PostgreSQL + Prisma | Structured, relational, changes rarely |
| Live/flexible data (preferences, votes, itinerary versions) | MongoDB + Mongoose | Shape evolves per-feature, versioned documents (each synthesis run is a new version, not an overwrite) |
| Real-time transport, presence, distributed locks | Redis + Socket.io | Debounce/lock coordination for synthesis, socket room state |
| LLM | Groq (Llama 3.3 70B) | Fast inference; output is treated as untrusted and validated/coerced, never passed straight through |
| Frontend | React 19 + TypeScript + Vite + React Query | Socket-driven live state, REST for initial page load |
| Deployment | Docker Compose on a single EC2 instance, nginx (TLS via Let's Encrypt, rate limiting, reverse proxy) | Self-hosted, free-tier-sized, no managed services required |

## Repo layout

```
api/        Express + Socket.io backend
frontend/   React + Vite frontend
nginx/      Production reverse proxy config (Dockerfile, templates, rate limiting)
deploy/     EC2 bootstrap + deploy scripts
```

## Local development

Requires Docker, or Node 20+ / npm if running services natively.

```bash
cp .env.example .env            # fill in real values
docker compose up               # postgres, mongodb, redis, api (dev mode, hot reload)

cd frontend
cp .env.example .env.local
npm install
npm run dev                     # http://localhost:5173
```

## Production deployment

```bash
# on a fresh EC2 instance (Amazon Linux 2023)
./deploy/setup-ec2.sh <repo-url>      # installs Docker, Compose, buildx, clones the repo
cp .env.production.example .env.production   # fill in real values
./deploy/init-letsencrypt.sh          # one-time TLS cert issuance
./deploy/deploy.sh                    # build, migrate, start — also the redeploy command
```

`docker-compose.prod.yml` runs everything (nginx, api, postgres, mongodb, redis) as a single
Compose project, self-hosted — no managed AWS data services required, so the whole stack fits
comfortably in EC2's free tier.

## Known limitations

- **Cost is not grounded in real pricing.** Each day's cost is currently a single number the
  LLM estimates, anchored only to the group's stated budget — there's no real pricing data
  source. A redesign to a collaborative, categorized item board (real user-entered costs,
  summed rather than guessed) is planned but not yet built.
- **No automated tests or CI yet.** Everything so far has been verified by hand against the
  live deployment.
- **Auth token is stored in `localStorage`**, not an httpOnly cookie — a known, planned fix.
- **Single EC2 instance, no redundancy** — no monitoring, backups, or horizontal scaling yet
  (though the Postgres/Mongo/Redis split and the Socket.io room model are designed to support
  it later).

## Roadmap

1. CI (typecheck + lint on push)
2. Move auth token to an httpOnly cookie
3. Redis-backed Socket.io adapter (horizontal scaling for the real-time layer)
4. Tests for the stable areas (auth, trip CRUD, voting)
5. RAG-grounded destination facts (retrieval from a real travel-data source, replacing the
   LLM's unreliable recall of specific places/costs)
6. Collaborative item board (real user-entered costs and picks, replacing LLM-invented ones)
7. Extract itinerary synthesis into a dedicated Go worker (bounded concurrency, retries) as
   the pipeline grows past a single LLM call
8. Tests for the synthesis pipeline, once its shape has settled
