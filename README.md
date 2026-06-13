# ōrātiō

Voice-first AI communication training app. Users take speaking challenges, get live transcription while they speak, and receive an AI evaluation that scores three independent stages — **Thought**, **Structure**, and **Delivery** — with a feedback report and retry loop.

See `prd.md` for the full product spec and `TODO.md` for build status.

## Repo layout

```
apps/mobile/    Expo (React Native + TypeScript) app
services/api/   FastAPI backend (Python 3.12, uv)
supabase/       Database migrations + seed (Supabase CLI)
docs/           Architecture notes
```

## Stack

- **Mobile**: Expo + expo-router, supabase-js (auth), zustand + react-query, `@siteed/expo-audio-studio` (16 kHz PCM streaming + WAV capture)
- **Backend**: FastAPI, SQLAlchemy 2.0 async + asyncpg, google-genai (Gemini Live proxy + Gemini 2.5 Pro evaluation)
- **Infra**: Supabase (Postgres, Auth, Storage), PostHog

## Running locally

### Backend

```bash
cd services/api
cp .env.example .env   # fill in keys
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

### Database

```bash
supabase link --project-ref <ref>
supabase db push
```

### Mobile

```bash
cd apps/mobile
cp .env.example .env   # fill in keys
npm install
npx expo run:ios   # dev build required (native audio module); Expo Go won't work for recording
```

## Architecture (one paragraph)

The phone records mic audio as 16 kHz PCM; chunks are streamed over a WebSocket to the FastAPI backend, which proxies them into a Gemini Live session configured as a silent transcriber and streams transcript deltas back for live captions. The same recorder writes a WAV locally, which is uploaded to Supabase Storage on stop. Completing an attempt triggers a Gemini 2.5 Pro structured-output evaluation of the transcript (Thought / Structure / Delivery, per-dimension subscores, feedback report), persisted to Postgres and polled by the app.
