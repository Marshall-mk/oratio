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
- ✅ Email sign-in/sign-up screen via supabase-js (Google/Apple deferred to pre-release)
- ✅ Profile auto-create trigger on signup (verified: signup → profiles row)
- ✅ Onboarding screens: profile → goals → self-assessment (zustand store, chip multi-selects, confidence scale)
- ✅ `GET/PUT /me/profile` + `GET /challenges[/{id}]` with Supabase JWT verification (e2e tested: 200s with real JWT, 401 without)
- ✅ AuthGate routing: signed-out → sign-in; incomplete profile → onboarding; complete → home
- ✅ Home screen lists 32 seeded challenges by gym (Thought/Structure/Speaking); challenge detail screen w/ framework hints + prep/speak timers
- ✅ Typecheck + fresh bundle verified in simulator
- ⬜ Manual walkthrough on device: sign up → onboard → browse challenges (recommended user smoke test)

## M2 — Recording + Live Transcript (riskiest)
- ✅ Spike: 28.6s WAV streamed → Gemini Live → full real-time transcript, near-zero model chatter (silent-listener pattern VALIDATED)
- ✅ FastAPI WebSocket proxy `/ws/live-session` → Gemini Live (binary + base64 frames, adaptive transcript drain) — e2e tested
- ✅ Session screen: timer, live captions, stop, auto-stop at time limit, fallback banner
- ✅ Transcript persisted (segments + full text) — verified in DB
- ✅ Fallback path: `/attempts/{id}/transcribe-fallback` (storage download → Gemini batch transcription)
- ✅ WAV upload helper (Supabase Storage, owner-scoped path) + signed-URL playback helper
- ✅ Dev build with `@siteed/audio-studio` (iOS 26.3.1 runtime installed; built + installed on iPhone 17 Pro sim; app boots and bundles cleanly)
- 🙋 Manual smoke test: sign in → pick challenge → speak → live captions → results (mic interaction can't be automated; Metro + API + Supabase are running locally, ready to try)
- ⬜ Airplane-mode fallback test (manual, alongside smoke test)

## M3 — Evaluation Pipeline
- ✅ `evaluator.py`: transcript → Gemini structured output (Thought/Structure/Delivery, 19 dimension subscores, report, detections) — e2e verified in ~18s
- ✅ Rubric prompt + framework addenda (PREP/STAR/scientific/story/pyramid) + user-profile personalization
- ✅ Scores + feedback_reports persisted; attempt status polling (`evaluating → complete|failed`)
- ✅ Golden-transcript pytest fixtures (strong vs rambling); offline tests pass, live ranking test opt-in via `RUN_LIVE_EVAL=1`
- ⚠️ Eval model is `gemini-2.5-flash` for now — free-tier key has **zero `gemini-2.5-pro` quota**; flip `GEMINI_EVAL_MODEL` once billing is enabled (🙋)

## M4 — Feedback UI + Retry/Compare
- ✅ Results screen: overall score, diagnosis card, detection pills, expandable triple-score cards w/ dimension bars + rationales, strengths/weaknesses, best/worst sentence, rewrite, retry CTA
- ✅ Audio playback (signed URL + expo-audio)
- ✅ Retry → attempt #2 in same session — e2e verified
- ✅ Compare: per-stage deltas vs previous attempt (▲/▼ on score cards) — `previous_scores` e2e verified
- ⬜ On-device visual verification (needs dev build)

## M5 — Progress Dashboard + Polish
- ✅ `GET /me/progress`: per-stage score series, averages, deltas, Communication IQ (0-100), totals, recent attempts — verified with real data
- ✅ Progress screen: IQ/attempts/minutes stat cards, per-stage sparkline trendlines with deltas, recent-attempt list → results
- ✅ Challenge library seeded (32) + categorized home (done in M0/M1)
- ⬜ PostHog events (🙋 needs PostHog project + keys)

## M6 — Hardening
- ✅ Evaluation retry: `POST /attempts/{id}/reevaluate` + "Re-run evaluation" button on failed attempts
- ✅ EAS build profiles (`eas.json`: development/device/preview/production)
- ✅ WS reconnect mid-take: up to 3 backoff retries; resumes live captions on reconnect; any gap routes the finish to fallback batch transcription of the full WAV so the transcript is never partial
- ✅ Session screen pause/resume (recorder pause/resume + UI; timer freezes, audio stops streaming while paused)
- ⬜ Google + Apple sign-in (needs OAuth client setup — your call when to do this)

---

# Post-MVP roadmap: PRD Phases 3–9 consolidated into 4 milestones

> Rationale: phases are grouped by **shared infrastructure**, not PRD numbering.
> 3+6 share the training loop; 4+5 share a text-exercise engine; 7+8 are the
> data layer + its dashboard; 9 reuses 2's streaming + 9's metrics in real time.

## M7 — Scenario Gym (= PRD Phase 3 Communication Gym + Phase 6 Social Intelligence)
*Insight: Phase 3 is mostly new CONTENT for the existing loop; Phase 6 is the same loop with an AI interlocutor + social scoring.*
- ✅ Spike: Gemini Live as a responding PERSONA (manual turn control, dual transcription, 24kHz audio back) VALIDATED
- ✅ Migration 0002: challenge `mode` (monologue|roleplay) + `persona` jsonb; `scenario` category; `social` score stage; transcript `turn_count`
- ✅ 15 new challenges: 10 roleplay scenarios (VC pitch, salary negotiation, interview, sales, difficult friend, relationship/workplace conflict, supervisor, networking) + 5 monologue Phase-3 (debate, leadership, teaching, conflict, storytelling)
- ✅ Roleplay engine (`RoleplayConductor`): persistent Live session, persona instruction + voice, manual activity boundaries (no barge-in), opener delivery, multi-turn conversation
- ✅ WS `/ws/roleplay-session`: multi-turn protocol, persona audio (base64 WAV) streamed back, conversation transcript persisted with roles → evaluation
- ✅ 4th evaluation stage `social` (empathy, listening, validation, curiosity, conflict_management, persuasion) — roleplay-only, separate rubric/schema
- ✅ Mobile: roleplay session screen (conversation thread, persona audio playback, turn control), challenge detail persona intro, home Scenario Gym section, results 4th score card, progress social trendline
- ✅ E2E verified: backend roleplay loop (opener→turn→persona audio→save→4-stage eval incl. social); UI rendered in sim (Scenario Gym list + persona detail)
- 🙋 Manual on-device test: hold a spoken roleplay conversation end-to-end (mic can't be automated)

## M8 — Text Lab (= PRD Phase 4 Vocabulary Academy + Phase 5 Reading Comprehension) ✅
*Insight: both are text-in/text-out exercise engines — no voice pipeline involved.*
- ✅ `text_exercises` table (migration 0003) + structured-output Gemini pipeline
- ✅ Reading: paste text OR pick a PDF (via expo-file-system picker — no new native module) → study pack (summary, definitions, key ideas, argument map) + comprehension quiz (answer key hidden until submit) → graded comprehension score (1-10)
- ✅ Vocabulary: 6 drills (word/sentence upgrade, academic/professional/persuasive rewrite, simplify) → Gemini scores original + returns improved version with per-change reasons
- ✅ New score series `comprehension` + `vocabulary` folded into /me/progress and Communication IQ
- ✅ Mobile: Reading Lab + Vocabulary Lab screens, Text Lab home section; e2e verified (backend) + UI rendered in sim
- ⬜ Deeper vocabulary tracking (unique words / overused words across speech transcripts) → moved to M9 analytics
- 🙋 Manual on-device test: paste an article, take the quiz; run a vocab drill

## M9 — Personal Model + Analytics (= PRD Phase 7 Communication Twin + Phase 8 Analytics) ✅
*Insight: Phase 7 is the data layer, Phase 8 is its dashboard — one milestone, two surfaces.*
- ✅ migration 0004: `communication_metrics` + `memory_embeddings` (pgvector 768d)
- ✅ Per-attempt deterministic metrics (`metrics.py`): WPM, filler count/rate, unique vocab + type-token ratio, avg sentence length, Flesch reading ease, question count, long-pause count (from live segment gaps) — computed at evaluation time
- ✅ Detection flags surfaced (evaluator `detections`) → "Habits to watch" frequency on dashboard
- ✅ pgvector memory (`memory.py`): each evaluated attempt embedded (gemini-embedding-001) as a memory line; on each new evaluation, top-K relevant memories retrieved and injected into the prompt → personalized, history-aware feedback. Best-effort (never blocks evaluation)
- ✅ Communication IQ + iq_delta (early-vs-late thirds); advanced-metric averages; dimension strengths/weaknesses; detection counts — all in `/me/progress`
- ✅ Analytics dashboard: IQ w/ delta, speaking-metrics grid, strengths/work-on, habits-to-watch pills, stage trendlines (comprehension + vocabulary + social included)
- ✅ E2E verified: metrics persisted, memory stored+retrieved across two attempts, analytics populated; dashboard rendered in sim

## M10 — Live Coach (= PRD Phase 9)
*Builds directly on M2 streaming + M9 metrics, computed in real time.*
- ⬜ Real-time detectors over the live transcript stream: speaking too fast (WPM window), filler words, jargon, rambling (sentence-length drift)
- ⬜ Intervention nudges pushed over the existing WS (slow down / clarify / give an example / summarize)
- ⬜ Live meters UI: confidence, clarity, pacing
- ⬜ Modes: presentation, interview, meeting, research defense

## Deferred (deprioritized per user, June 12 2026)
- Phase 0A Research Communication Trainer · Phase 10 Replay · Phase 11 Audience Switching · Phase 12 Thesis Defense Simulator · Phase 13 Thought Mapper
- Gamification (XP, streaks UI, ranks) — schema stubs exist
- Payments (RevenueCat/Stripe)
- Video/body-language analysis (future roadmap)
