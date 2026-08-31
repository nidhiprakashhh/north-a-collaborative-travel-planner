# North

A real-time collaborative trip planner. A group joins a shared trip room, everyone submits
preferences and votes on destinations live, and an LLM synthesizes a day-by-day itinerary from
the group's combined input, grounded in real geography and real dates instead of just the
model's guesses.

**Live:** https://54-198-7-224.sslip.io

## What it does

- **Auth and trips.** Email/password login with a JWT stored in an httpOnly cookie, trip
  creation with shareable invite codes, and membership management.
- **Real-time collaboration.** Built on Socket.io with a Redis adapter, so member presence,
  field-focus indicators ("editing destinations"), preference syncing, and vote tallies all get
  pushed to every member of a trip room with no polling and no single-process bottleneck.
  Manual itinerary edits get the same treatment, with a live "X is editing this day..." signal
  so two members don't quietly overwrite each other.
- **AI itinerary synthesis.** Groq generates a day-by-day itinerary from the group's
  preferences, votes, and a shared "worth considering" idea board. It's debounced and
  lock-protected, so a burst of edits from several members still triggers exactly one synthesis
  run instead of one per keystroke. Regenerating revises the group's existing plan in place
  rather than throwing it out and starting fresh.
- **Geography and fact grounding.** Destinations are geocoded through OpenStreetMap's Nominatim
  and ordered with a real nearest-neighbor routing algorithm (Haversine distance), and
  destination facts come from Wikivoyage instead of the model's own memory. Both get handed to
  the LLM as fixed context, so it's organizing and writing content, not inventing geography or
  facts.
- **Guardrails on LLM output.** The model's output is never trusted as-is. Deterministic
  post-processing validates and corrects it: confirming must-see items were actually included
  (with typo-tolerant fuzzy matching), checking for budget blowouts, and enforcing trip-length
  constraints, all running alongside the model's own conflict detection.
- **Manual itinerary editing.** Any member can hand-edit a day's activities, accommodation, or
  cost directly. Edits are versioned the same way a synthesis run is, so the next regenerate
  treats a manual edit as part of the current draft to revise, not something to overwrite.
- **Real trip costs, live.** The itinerary's per-day cost is still just the LLM's estimate, so
  members log actual costs (a booked flight, a paid deposit) as their own shared, categorized
  list, with a real summed total shown separately and clearly labeled as the actual number,
  not a guess.

## Architecture

| Layer | Choice | Why |
|---|---|---|
| Relational data (users, trips, membership) | PostgreSQL + Prisma | Structured, relational, changes rarely |
| Live/flexible data (preferences, votes, itinerary versions) | MongoDB + Mongoose | Shape evolves per feature, and versioned documents mean each synthesis run or manual edit is a new version, not an overwrite |
| Real-time transport, presence, distributed locks | Redis + Socket.io | Debounce/lock coordination for synthesis, socket room state, and horizontally-scalable broadcast via `@socket.io/redis-adapter` |
| LLM execution | Go worker (a goroutine pool over a Redis job queue) | The Groq call is isolated behind its own bounded-concurrency, retryable service that scales and deploys independently of the request-serving API, with its own timeout and backoff handling. The API builds the prompt and applies all the itinerary-domain guardrails; the worker's only job is running that prompt against Groq reliably. |
| LLM | Groq (`openai/gpt-oss-120b`) | Fast inference; its output is treated as untrusted and validated/coerced, never passed straight through |
| Frontend | React 19 + TypeScript + Vite + React Query | Socket-driven live state, REST for the initial page load |
| Testing | Vitest for the API, against real Postgres/Mongo/Redis rather than mocks, plus Go's own `testing` package for the worker | 81 API tests and 5 worker tests, run in CI on every push |
| Deployment | Docker Compose on a single EC2 instance, nginx in front (TLS via Let's Encrypt, rate limiting, reverse proxy) | Self-hosted and free-tier-sized, no managed services required |

## Repo layout

```
api/        Express + Socket.io backend
worker/     Go synthesis worker: pulls jobs from Redis, calls Groq with bounded
            concurrency, retries, and backoff, then publishes the result back
frontend/   React + Vite frontend
nginx/      Production reverse proxy config (Dockerfile, templates, rate limiting)
deploy/     EC2 bootstrap + deploy scripts
```

## Local development

Requires Docker, or Node 20+ / npm and Go 1.27+ if you'd rather run services natively.

```bash
cp .env.example .env            # fill in real values
docker compose up               # postgres, mongodb, redis, api, worker (api hot-reloads)

cd frontend
cp .env.example .env.local
npm install
npm run dev                     # http://localhost:5173
```

To run the worker natively instead of through Docker: `cd worker && go run .` It needs
`REDIS_URL` and `GROQ_API_KEY` in its environment, see `.env.example` for the full list.

## Production deployment

```bash
# on a fresh EC2 instance (Amazon Linux 2023)
./deploy/setup-ec2.sh <repo-url>      # installs Docker, Compose, buildx, clones the repo
cp .env.production.example .env.production   # fill in real values
./deploy/init-letsencrypt.sh          # one-time TLS cert issuance
./deploy/deploy.sh                    # build, migrate, start (also the redeploy command)
```

`docker-compose.prod.yml` runs everything (nginx, api, worker, postgres, mongodb, redis) as a
single Compose project, self-hosted, with no managed AWS data services required, so the whole
stack fits comfortably in EC2's free tier. The worker's compiled image is a `scratch`-based
static Go binary, about 18MB, rather than a full runtime image.

## What's been built

- CI, running typecheck, lint, and tests on every push, including the Go worker
- httpOnly JWT cookie for auth
- Redis-backed Socket.io adapter for horizontal scaling of the real-time layer
- Tests for auth, trip CRUD, and voting (22 tests)
- Wikivoyage-grounded destination facts
- A shared "worth considering" idea board with geocoding-verified place tagging
- Revise-in-place regeneration, so regenerating revises the existing plan instead of rerolling
  it from scratch
- Manual itinerary editing with live edit presence
- Itinerary synthesis extracted into a dedicated Go worker, with bounded concurrency, retries,
  and independent scaling (5 tests)
- Tests for the synthesis pipeline itself: prompt construction, guardrails, and revise-in-place
  (47 tests)
- A shared, live-synced trip-costs board, so the real logged total sits next to (never in
  place of) the itinerary's LLM-estimated one
