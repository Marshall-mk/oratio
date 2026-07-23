# ōrātiō

Voice-first AI communication training app. Users take speaking challenges, get live transcription while they speak, and receive an AI evaluation that scores three independent stages — **Thought**, **Structure**, and **Delivery** — with a feedback report and retry loop.

## Repo layout

```
apps/mobile/    Expo (React Native + TypeScript) app
services/api/   FastAPI backend (Python 3.12, uv)
supabase/       Database migrations + seed (Supabase CLI)
```

## Stack

- **Mobile**: Expo + expo-router, supabase-js (auth), zustand + react-query, `@siteed/expo-audio-studio` (16 kHz PCM streaming + WAV capture)
- **Backend**: FastAPI, SQLAlchemy 2.0 async + asyncpg, google-genai (Gemini Live proxy + Gemini 2.5 Pro evaluation)
- **Infra**: Supabase (Postgres, Auth, Storage), PostHog

## Running locally

Prereqs: [Docker Desktop](https://www.docker.com/), the [Supabase CLI](https://supabase.com/docs/guides/cli), [`uv`](https://github.com/astral-sh/uv), Node, and Xcode (for the iOS simulator).

### First-time setup

```bash
# 1. Local Supabase stack (Postgres + Auth + Storage in Docker)
supabase start                       # prints local URL + anon/service keys
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/seed.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/seed_0002_scenarios.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/seed_0005_coach.sql

# 2. Backend deps + env
cd services/api
cp .env.example .env                 # local stack keys are already the defaults; add your GEMINI_API_KEY
uv sync

# 3. Mobile deps + env, then build the dev client onto the simulator
cd ../../apps/mobile
cp .env.example .env                 # points at the local stack + http://127.0.0.1:8000 by default
npm install
npx expo run:ios --device "iPhone 17 Pro"   # builds + installs the dev client (first time only)
```

> A **dev build is required** (not Expo Go) because of the native audio module. The first
> `expo run:ios` compiles it; after that you only need Metro (below).

### Day-to-day

Three things run together — start them in separate terminals:

```bash
# 1. Database (Docker)
supabase start

# 2. Backend (from services/api)
uv run uvicorn app.main:app --reload --port 8000

# 3. Metro + open the app in the simulator (from apps/mobile)
npx expo start            # press i to open the iOS simulator, or:
xcrun simctl launch booted dev.oratio.app
```

If the simulator's app shows "No script URL", point it at Metro once:

```bash
xcrun simctl openurl booted "dev.oratio.app://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"
```

### Stopping

```bash
supabase stop             # stops the Docker stack (data is kept in a Docker volume)
# Ctrl-C the Metro and uvicorn terminals
```

`supabase start` again later restores all local data. To wipe and re-seed: `supabase db reset`.

## Architecture (one paragraph)

The phone records mic audio as 16 kHz PCM; chunks are streamed over a WebSocket to the FastAPI backend, which proxies them into a Gemini Live session configured as a silent transcriber and streams transcript deltas back for live captions. The same recorder writes a WAV locally, which is uploaded to Supabase Storage on stop. Completing an attempt triggers a Gemini 2.5 Pro structured-output evaluation of the transcript (Thought / Structure / Delivery, per-dimension subscores, feedback report), persisted to Postgres and polled by the app.
