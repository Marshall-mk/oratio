# ōrātiō — Architecture Notes

## System overview

```
┌─────────────────────────── iPhone / Android ───────────────────────────┐
│  Expo app (expo-router, TS)                                            │
│   • supabase-js  → Supabase Auth (sign-in) + Storage (WAV upload)      │
│   • REST         → FastAPI (profiles, challenges, sessions, progress)  │
│   • WebSocket    → FastAPI /ws/live-session (PCM up, captions down)    │
│   • @siteed/expo-audio-studio: 16 kHz PCM chunks + parallel WAV file   │
└─────────────────────────────────────────────────────────────────────────┘
                │                          │
                ▼                          ▼
┌──────── Supabase ────────┐   ┌───────── FastAPI (services/api) ─────────┐
│ Auth (JWT, JWKS)         │   │ auth.py: verifies Supabase JWT via JWKS  │
│ Postgres (+pgvector)     │◄──│ SQLAlchemy 2.0 async + asyncpg (pooler)  │
│ Storage: recordings/     │   │ live_transcriber: Gemini Live proxy      │
│ RLS owner policies       │   │ evaluator: Gemini 2.5 Pro structured out │
└──────────────────────────┘   └──────────────┬───────────────────────────┘
                                              ▼
                                   Google Gemini API
                                   • Live (input transcription, silent listener)
                                   • 2.5 Pro (3-stage evaluation JSON)
```

## Key decisions & rationale

| Decision | Rationale |
|---|---|
| Proxy audio through FastAPI WS instead of mobile→Gemini direct | API key stays server-side; backend persists authoritative transcript; Python Live SDK is first-class (JS SDK is RN-hostile); known ephemeral-token transcription bug |
| `@siteed/expo-audio-studio` for capture | Only maintained Expo lib that streams raw 16 kHz PCM **and** writes a WAV simultaneously — solves stream+save with one recorder. Requires dev build (no Expo Go) |
| SQLAlchemy async + asyncpg direct to Postgres (not supabase-py/PostgREST) | Real transactions for multi-row evaluation writes; typed models; lower latency. RLS still guards direct client access |
| Single `scores` table with `stage` discriminator | Simpler queries than 3 tables; per-dimension subscores in `jsonb` |
| Evaluation = one Gemini 2.5 Pro call with Pydantic `response_schema` | Atomic, schema-valid result; rubric prompt judges Thought/Structure/Delivery independently |
| `asyncio.create_task` + status column for eval jobs | No queue infra needed at MVP scale; client polls `GET /attempts/{id}` |
| Fallback: record-then-upload batch transcription | WAV file is written independently of the WS, so live-path failure never loses a take |

## Attempt lifecycle

`recording → uploaded → transcribing (fallback only) → evaluating → complete | failed`

1. `POST /sessions` + `POST /sessions/{id}/attempts` (status `recording`)
2. WS `/ws/live-session?attempt_id=…&token=…` — PCM in, transcript deltas out; on stop the server persists `transcripts`
3. Client uploads WAV → `recordings/{user_id}/{attempt_id}.wav`, then `POST /attempts/{id}/complete`
4. Evaluator runs; writes 3 `scores` rows + `feedback_reports`; status `complete`
5. Retry → new attempt (#2) in the same session; compare view diffs stage scores

## Environments / secrets

- `services/api/.env` — all secrets (Gemini key, service-role key, DB URL)
- `apps/mobile/.env` — only `EXPO_PUBLIC_*` publishables (Supabase URL/anon key, API URL)
- Live/eval model names are env-pinned (`GEMINI_LIVE_MODEL`, `GEMINI_EVAL_MODEL`) — both preview models, expect renames
