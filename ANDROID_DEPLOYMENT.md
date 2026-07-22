# Running ōrātiō on Android — the free, standalone path

This guide gets ōrātiō **installed on an Android device as a real app you own**, with **no
recurring cost** and **no store account**. Android lets you *sideload* a signed APK directly,
so — unlike iOS — you need **no $99 Apple Developer Program** and **no $25 Google Play
account**. You just build the APK locally and install it over USB (or copy the file to the
device).

There are two things to stand up:

1. **The app binary** — a release APK, built locally, sideloaded. Free.
2. **The services it talks to** — Supabase + the FastAPI backend + Gemini. These must live
   *somewhere the device can reach from anywhere* (not `localhost` on your Mac) for the app to
   be truly standalone. All three have usable **free tiers**.

> **Already working in dev mode?** If you ran `npx expo run:android`, the app is installed and
> talks to your **local** Supabase/backend over `adb reverse` tunnels — but only while your Mac
> runs Metro + the stack. This guide is the step up from that: cloud services + a self-contained
> APK that runs with the Mac turned off.

---

## The free stack

| Piece | Free option | The catch (all livable for personal use) |
|---|---|---|
| **App binary** | Local **release APK**, sideloaded via `adb install` | Signed with the debug key — fine for sideloading, not for the Play Store |
| **Supabase** | **Free tier** (cloud) | 500 MB DB; storage is a non-issue (recordings auto-delete after evaluation); project **pauses after ~1 week idle** (un-pause in dashboard) |
| **Backend** (FastAPI + WebSockets) | **Render** free web service, or **Hugging Face Space** (Docker) | **Sleeps when idle** → first request after a nap has a cold start (~30–60 s) |
| **Gemini** | **Free-tier** API key (Google AI Studio) | Use **flash** models — the free tier has **no `gemini-2.5-pro` quota**, plus per-minute/day rate limits |

**Bottom line: $0/month.** The trade-offs are cold starts and flash-quality evaluation instead
of pro. If you later want zero cold-starts and pro-grade scoring, see
[`DEPLOYMENT.md`](DEPLOYMENT.md) for the paid path.

---

## Part A — Supabase (cloud, free)

1. Create a project at [supabase.com](https://supabase.com) → **New project** (free plan). Pick a
   region near you and save the DB password.
2. From **Project Settings → API**, copy: `Project URL`, the **`anon`** key, the **`service_role`**
   key, and the **JWT Secret**.
3. From **Project Settings → Database → Connection string**, copy the **Session pooler** URI and
   rewrite it for the async driver the backend uses:
   ```
   postgresql+asyncpg://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```
4. Push the schema + seed data from the repo root (needs the [Supabase CLI](https://supabase.com/docs/guides/cli)):
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push                    # runs all 9 files in supabase/migrations/
   # seeds don't run automatically — load them against the DIRECT (non-pooler) db URL:
   psql "<direct db url>" -f supabase/seed.sql
   psql "<direct db url>" -f supabase/seed_0002_scenarios.sql
   psql "<direct db url>" -f supabase/seed_0005_coach.sql
   ```
   Migrations enable `pgvector`, create the private **`recordings`** storage bucket, the
   signup→profile trigger, and every table.
5. **Auth → Providers/Settings:** turn **"Confirm email" OFF** (unless you configure SMTP),
   otherwise a new sign-up can't get a session until it clicks a confirmation link.

---

## Part B — Backend on a free host

The backend holds **long-lived WebSocket** connections (live transcription, roleplay, coach,
debate), so **serverless won't work** (no Vercel/Netlify/Lambda). The repo ships
`services/api/Dockerfile`, so any container host works. Two genuinely-free options:

> Both hosts deploy from a Git repo. This repo has **no remote yet** — first push it to GitHub
> (for Render) or to a Hugging Face repo (for Spaces).

### Option 1 — Render (recommended: simplest)

1. Push the repo to GitHub.
2. [render.com](https://render.com) → **New → Web Service** → connect the repo.
3. **Root Directory:** `services/api`  •  **Runtime:** `Docker`  •  **Instance type:** `Free`.
4. **Health Check Path:** `/health`.
5. **Environment variables** (see the shared list below).
6. Deploy. Render gives you `https://<name>.onrender.com`. WebSockets work out of the box →
   the app auto-derives `wss://`.
7. Verify: open `https://<name>.onrender.com/health` → `{"status":"ok", ...}`.

### Option 2 — Hugging Face Space (no credit card, ever)

Good if you'd rather not put a card anywhere. You already have an HF account.

1. Create a **new Space** → **Docker** (blank template).
2. Put the backend's Docker context (`services/api/`) at the Space root, and in the Space
   **README** metadata set the port to match the Dockerfile:
   ```yaml
   ---
   title: oratio-api
   sdk: docker
   app_port: 8000
   ---
   ```
3. Add the env vars below as **Space secrets** (Settings → Variables and secrets).
4. The Space serves at `https://<user>-<space>.hf.space` with HTTPS + WSS. It **sleeps after
   ~48 h idle** and wakes on the next request.

### Shared backend environment variables

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
SUPABASE_JWT_SECRET=<jwt secret>            # leave empty if your project uses asymmetric signing keys
DATABASE_URL=postgresql+asyncpg://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres
GEMINI_API_KEY=<your free AI Studio key>
GEMINI_EVAL_MODEL=gemini-2.5-flash          # IMPORTANT: pro has ZERO free quota — override the default
ENVIRONMENT=production

# Optional tuning (defaults are sensible):
# GEMINI_TRANSCRIBER_MODEL=gemini-live-2.5-flash-preview  # half-cascade model for live captions
# TRANSCRIPTION_LANGUAGE=en-US                            # BCP-47 hint for live transcription
# GEMINI_VAD_SILENCE_MS=500                               # end-of-turn silence for caption flushes
```

---

## Part C — Gemini key (free tier)

1. [aistudio.google.com](https://aistudio.google.com) → **Get API key** → create one (no billing needed).
2. Put it in `GEMINI_API_KEY` on the backend host.
3. **Stay on flash models** to stay free — the free tier has **no `gemini-2.5-pro` quota**:
   - `GEMINI_EVAL_MODEL=gemini-2.5-flash` (the default `gemini-2.5-pro` would fail on the free tier).
   - The live/transcription model already defaults to a flash model.
4. Free tier is **rate-limited** (a handful of requests/min, a daily cap). Fine for personal
   practice; live transcription is the most likely thing to hit a limit. If a call fails with a
   quota error, that's the free tier — either slow down or enable billing later.

---

## Part D — Point the app at the cloud

`EXPO_PUBLIC_*` values are **baked into the APK at build time**, so set them *before* building.
Edit `apps/mobile/.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
EXPO_PUBLIC_API_URL=https://<your-backend-domain>      # Render or HF URL — https, so the app uses wss://
EXPO_PUBLIC_POSTHOG_API_KEY=
```

(The app derives the WebSocket URL from `EXPO_PUBLIC_API_URL` by swapping `http→ws`.)

---

## Part E — Android build toolchain (one-time, on the build Mac)

You only need this on the machine that *builds* the APK, not on the device.

```bash
brew install openjdk@17
brew install --cask android-commandlinetools

# add to ~/.zshrc (adjust if your SDK lives elsewhere):
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$JAVA_HOME/bin:$PATH"

# accept licenses + install the SDK pieces this project needs:
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006" "cmake;3.22.1"
```

> **Native modules (all handled by `npm install` + the committed config).** Besides
> `@siteed/audio-studio`, the app links `expo-speech-recognition` (Device caption engine —
> config plugin in `app.json`) and `whisper.rn` (Whisper caption engine — autolinked, with a
> Node-`buffer` polyfill wired in `metro.config.js`). No manual steps: install, prebuild, build.
>
> **Native-module patch (already in the repo).** `@siteed/audio-studio@3.2.0`'s Android code
> overrides an Expo `Promise.reject(...)` signature that changed in SDK 56, which breaks the
> Android compile. The repo carries a fix in **`apps/mobile/patches/`** applied automatically by
> the **`postinstall`** hook — so a plain `npm install` sets it up. If the Android build ever
> fails on `:siteed-audio-studio:compileDebugKotlin`, run `npx patch-package` to reapply it.

---

## Part F — Build the standalone release APK & install it

From `apps/mobile`, with a device connected (`adb devices` shows it):

```bash
# Builds a release APK (JS bundled in — no Metro needed), installs and launches on the device:
npx expo run:android --variant release
```

Or produce the APK **file** (to share or sideload later) without installing:

```bash
cd apps/mobile/android
./gradlew assembleRelease
# → app/build/outputs/apk/release/app-release.apk
adb install -r app/build/outputs/apk/release/app-release.apk    # -r upgrades in place
```

The release build is signed with the **debug keystore** (Expo's default `release` config) — that
is completely fine for sideloading. Every rebuild uses the same key, so `adb install -r` updates
the existing app without uninstalling.

Because everything is baked in, the installed app now runs **with your Mac off**, talking to the
cloud Supabase + backend.

### Installing without a cable / on someone else's phone

The APK is just a file — no build machine required to install it:

1. Copy `app-release.apk` to the device (email it, AirDrop→Files, USB transfer, Google Drive…).
2. On the device, tap the APK. Android will prompt to **allow installing unknown apps** for that
   source (Files/Chrome) → allow → **Install**.

---

## Updating the app later

- **JS/UI or config change:** re-run the release build (Part F) and `adb install -r` the new APK.
  Remember `EXPO_PUBLIC_*` and any backend URL change require a **rebuild** (they're baked in).
- **Backend change:** push to the connected repo → Render/HF redeploys automatically.
- **Schema change:** add a file in `supabase/migrations/` → `supabase db push`; re-run any new seed.

---

## Keeping it free — what to expect

- **Cold starts:** the free backend sleeps when idle. The first action after a nap waits
  ~30–60 s while it wakes; snappy afterward.
- **Supabase pause:** free projects pause after ~7 days of no activity. Un-pause from the
  dashboard (one click) — data is retained.
- **Flash, not pro:** evaluations use `gemini-2.5-flash`. Solid, just not top-tier scoring.
- **Rate limits:** heavy back-to-back live sessions can hit the Gemini free-tier cap. Two
  built-in mitigations: pick the **Device** or **Whisper** caption engine (Profile → AI
  settings) so live captions never touch Gemini, and note that each attempt then makes only
  two Gemini calls (one transcription of the recording, one evaluation).
- **Storage stays near zero:** recordings are **deleted automatically once evaluation
  completes** — only transcripts, scores and reports (a few KB per attempt) persist, so the
  1 GB free storage tier is effectively never a constraint.

None of these cost money; they're the shape of the free tier.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `adb devices` empty | Data cable (not charge-only); on device set USB mode to **File Transfer**; accept the **Allow USB debugging** prompt. |
| Build fails at `:siteed-audio-studio:compileDebugKotlin` | The native patch didn't apply — `cd apps/mobile && npx patch-package`, then rebuild. |
| App opens but can't sign in / network errors | Backend asleep (wait for cold start) or wrong `EXPO_PUBLIC_API_URL`/`SUPABASE_URL` baked in — fix `.env` and **rebuild**. |
| Evaluation never completes | `GEMINI_EVAL_MODEL` still `gemini-2.5-pro` (no free quota) → set it to `gemini-2.5-flash` on the host. |
| "App not installed" on sideload | Uninstall an older copy signed with a different key, or enable **install unknown apps** for the source app. |

---

## Checklist

- [ ] Supabase project created; `db push` done; seeds loaded; `recordings` bucket present; email confirmation OFF
- [ ] Backend deployed (Render or HF); `/health` returns ok; env vars set incl. `GEMINI_EVAL_MODEL=gemini-2.5-flash`
- [ ] Free Gemini key in the backend env
- [ ] `apps/mobile/.env` points at the **cloud** Supabase + backend URL
- [ ] `npx expo run:android --variant release` builds, installs, and the app runs with Metro **off**
- [ ] (Optional) `app-release.apk` copied off for cable-free reinstalls
