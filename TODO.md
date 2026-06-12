# Veritas — Build Tracker

Legend: ✅ done · 🚧 in progress · ⬜ not started · 🙋 needs user action

## M0 — Scaffolding + Infra
- ✅ Repo layout (`apps/mobile`, `services/api`, `supabase/`)
- ✅ `.gitignore`, `README.md`
- ✅ FastAPI skeleton (`uv`, `/health` verified 200, config, JWT auth deps, async DB engine)
- ✅ Database migration `0001_init.sql` (profiles + signup trigger, challenges, sessions, attempts, audio_files, transcripts, scores, feedback_reports, future stubs, storage policies)
- ✅ Challenge seed (32 challenges: 12 thought / 11 structure / 9 speaking)
- ✅ Expo SDK 56 app scaffold (expo-router, TS strict) — typecheck + iOS bundle pass; supabase/api client libs wired
- ✅ Migration + seed validated against local Supabase stack (12 tables, 32 challenges, `recordings` bucket, signup trigger)
- ✅ App boots in iOS simulator (screenshot verified via Expo Go)
- ✅ Local dev env wired: backend `.env` → local stack (HS256 JWT verify for local), mobile `.env` → local Supabase + API
- ✅ M2 spike script ready (`services/api/scripts/live_spike.py`) — needs Gemini key to run
- 🙋 Supabase **cloud** project created (URL + anon key + service-role key + DB pooler URI) — local stack works meanwhile
- 🙋 Gemini API key (Google AI Studio → `services/api/.env`)
- ⬜ `supabase link` + `db push` (blocked on cloud project)

## M1 — Auth + Onboarding
- ⬜ Email sign-in via supabase-js (Google/Apple deferred to pre-release)
- ⬜ Profile auto-create trigger on signup
- ⬜ Onboarding screens (profile → goals → self-assessment)
- ⬜ `GET/PUT /me/profile` with Supabase JWT verification

## M2 — Recording + Live Transcript (riskiest)
- ⬜ Spike: Python script streams WAV → Gemini Live → prints input transcriptions (validates model + silent-listener behavior)
- ⬜ Dev build with `@siteed/expo-audio-studio`
- ⬜ FastAPI WebSocket proxy `/ws/live-session` → Gemini Live
- ⬜ Session screen: mic level, timer, live captions, pause/stop
- ⬜ WAV saved locally + uploaded to Supabase Storage
- ⬜ Transcript persisted (segments + full text)
- ⬜ Fallback path: record-then-upload batch transcription

## M3 — Evaluation Pipeline
- ⬜ `evaluator.py`: transcript → Gemini 2.5 Pro structured output (Thought/Structure/Delivery + report)
- ⬜ Rubric prompts + per-challenge-type addenda
- ⬜ Scores + feedback_reports persisted; attempt status polling
- ⬜ Golden-transcript pytest fixtures (strong vs rambling)

## M4 — Feedback UI + Retry/Compare
- ⬜ Results screen (triple-score cards, dimension breakdown, diagnosis, best/worst sentence, rewrite)
- ⬜ Audio playback (signed URL)
- ⬜ Retry → attempt #2 in same session
- ⬜ Compare view (per-stage deltas)

## M5 — Progress Dashboard + Polish
- ⬜ `GET /me/progress` aggregates
- ⬜ Charts: stage trendlines, dimension radar, attempt history
- ⬜ Full challenge library seeded + categorized home screen
- ⬜ PostHog events (🙋 PostHog project + keys)

## M6 — Hardening
- ⬜ Error states, WS reconnect, evaluation retry button
- ⬜ EAS build profiles (TestFlight / internal track)
- ⬜ Google + Apple sign-in (needs OAuth client setup)

## Deferred (post-MVP, from PRD)
- Phase 0A Research Communication Trainer · Phase 3 Communication Gym modes · Phase 4 Vocabulary Academy · Phase 5 Reading Comprehension Lab · Phase 6 Social Intelligence Trainer · Phase 7 Personal Communication Model (pgvector memory) · Phase 9 Live Coach · Phase 10 Replay · Phase 11 Audience Switching · Phase 12 Thesis Defense Simulator · Phase 13 Thought Mapper
- Gamification (XP, streaks UI, ranks) — schema stubs exist
- Payments (RevenueCat/Stripe)
- Video/body-language analysis (future roadmap)
