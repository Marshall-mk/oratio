# Deploying ōrātiō

This walks you from the local dev setup to a live app: the **FastAPI backend** on a
container host, **Supabase** in the cloud, and the **Expo app** on the App Store.

## The three pieces

```
iOS app (Expo / EAS)  ──HTTPS + WSS──►  FastAPI backend (Railway/Render)  ──►  Supabase (Postgres, Auth, Storage)
                       └──────────────────────────────────────────────────►  Supabase Auth + Storage (direct)
                                                                          └──►  Google Gemini API
```

The backend uses **WebSockets** for every live feature (transcription, roleplay, coach,
debate). That rules out serverless hosts (Vercel/Netlify/Lambda) — you need a host that
keeps long-lived connections. **Railway** is the easiest; **Render** and **Fly.io** also work.

---

## 0. Accounts you'll need

| Service | Why | Cost |
|---|---|---|
| **Apple Developer Program** | Publish to the App Store | $99 / year |
| **Supabase** | Postgres + Auth + Storage | Free tier fine to start |
| **Google AI Studio** (Gemini) | The AI — use a **billing-enabled** key | Pay-as-you-go |
| **Expo (EAS)** | Cloud build + submit the iOS app | Free tier builds; paid for priority |
| **Railway** (or Render / Fly.io) | Host the FastAPI backend | ~$5/mo to start |

> The app supports per-user "bring your own key", but the server still needs a default
> Gemini key. Note (mid-2026): Google closed the 2.5 text-model family to newly created
> accounts — new keys must use 3.x models (`gemini-3.5-flash` etc.); a billing-enabled key
> lifts the free tier's rate limits and unlocks the pro tiers.

---

## 1. Supabase (cloud)

1. **Create a project** at [supabase.com](https://supabase.com). Pick a strong DB password and a region near your users.
2. From **Project Settings → API**, copy:
   - `Project URL` → `SUPABASE_URL`
   - `anon` public key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only secret)
   - `JWT Secret` → `SUPABASE_JWT_SECRET`
3. From **Project Settings → Database → Connection string**, copy the **Session pooler** URI (port 5432). Convert it to the async driver for the backend:
   ```
   DATABASE_URL=postgresql+asyncpg://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```
4. **Apply the schema and seed data** from the repo root (install the [Supabase CLI](https://supabase.com/docs/guides/cli) first):
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push                         # runs everything in supabase/migrations/
   # seed the challenge catalog (migrations don't run seeds automatically):
   psql "<your DIRECT db url>" -f supabase/seed.sql
   psql "<your DIRECT db url>" -f supabase/seed_0002_scenarios.sql
   psql "<your DIRECT db url>" -f supabase/seed_0005_coach.sql
   ```
   The migrations enable `pgvector`, create the private **`recordings`** storage bucket, the
   signup→profile trigger, and all tables.
5. **Auth settings** (**Authentication → Providers / Settings**):
   - For the simple email/password flow, turn **"Confirm email" OFF** (or configure SMTP) — otherwise new sign-ups won't get a session until they click a confirmation link.
   - Add **Google / Apple** providers later if you want social login (the app already has the UI hooks; you'd wire the OAuth clients).

---

## 2. FastAPI backend (Railway — easiest)

The repo includes `services/api/Dockerfile`, so any container host can build it.

### Railway
1. Create a project at [railway.app](https://railway.app) → **Deploy from GitHub repo** (or `railway up` from the CLI).
2. Set the **root directory** to `services/api` (Railway will detect the Dockerfile).
3. Add **environment variables** (Variables tab):
   ```
   SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   SUPABASE_JWT_SECRET=...        # see note below
   DATABASE_URL=postgresql+asyncpg://postgres.<ref>:<pw>@...pooler.supabase.com:5432/postgres
   GEMINI_API_KEY=...             # billing-enabled
   GEMINI_LIVE_MODEL=gemini-2.5-flash-native-audio-latest
   GEMINI_EVAL_MODEL=gemini-3.5-flash
   EVAL_WITH_AUDIO=false
   ENVIRONMENT=production
   POSTHOG_API_KEY=              # optional
   ```
   - **`SUPABASE_JWT_SECRET`**: set it to your project's JWT secret. (If your Supabase project uses the newer *asymmetric signing keys*, you can leave it empty — the backend verifies tokens via the JWKS endpoint automatically.)
4. Railway gives you a public domain like `https://oratio-api.up.railway.app`. WebSockets are supported out of the box — the app will use `wss://…` automatically.
5. Verify: open `https://<your-domain>/health` → should return `{"status":"ok", ...}`.

### Render (alternative)
New → **Web Service** → point at the repo, root `services/api`, runtime **Docker**. Add the same env vars. Render supports WebSockets on web services. Health check path: `/health`.

### Fly.io (alternative)
`fly launch` in `services/api` (it'll use the Dockerfile), `fly secrets set KEY=value …`, `fly deploy`. Good if you want multi-region.

> Whichever you pick: it must keep **long-lived WebSocket connections** open. Don't use a serverless/edge platform for this backend.

---

## 3. Point the app at production

`EXPO_PUBLIC_*` values are **baked into the binary at build time**, so set them before building. Edit `apps/mobile/.env` (gitignored) — or set them as EAS Environment Variables for the `production` profile:

```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
EXPO_PUBLIC_API_URL=https://<your-backend-domain>
EXPO_PUBLIC_POSTHOG_API_KEY=        # optional
```

(The app derives the WebSocket URL from `EXPO_PUBLIC_API_URL` by swapping `http→ws`, so HTTPS gives you secure `wss://`.)

---

## 4. Build & submit the iOS app (EAS)

```bash
cd apps/mobile
npm install -g eas-cli
eas login

# One-time: registers the app on Expo + helps create Apple credentials
eas build:configure
```

1. **Apple side**: enroll in the Apple Developer Program, then in **App Store Connect** create a new app with bundle id **`dev.oratio.app`** (matches `app.json`). EAS can create the App ID and signing certs for you during the build (it'll prompt for your Apple login).
2. **Build** the production binary in the cloud (this runs the native prebuild, so the `@siteed/audio-studio` native module is included):
   ```bash
   eas build --platform ios --profile production
   ```
3. **Submit** to App Store Connect:
   ```bash
   eas submit --platform ios --latest
   ```
4. In **App Store Connect**:
   - Add it to **TestFlight** first and test on a real device (record a drill, run a debate).
   - Fill the **App Privacy** labels: you collect **email** (account) and use the **microphone** (recording); audio + transcripts are processed for feedback. Declare data use honestly.
   - Export compliance: `app.json` already sets `ITSAppUsesNonExemptEncryption: false`, so you won't be asked each build.
   - Add **screenshots**, description, and **review notes** — give Apple a **demo account** (email + password) and one line explaining the mic is used to transcribe/score speaking practice. (Reviewers reject apps that gate content behind a login without a test account.)
   - Submit for review.

> Android (optional): the package id `dev.oratio.app` is set. `eas build --platform android --profile production` + `eas submit --platform android` publishes to Google Play (separate Play Console account, ~$25 one-time).

---

## 5. Ongoing

- **Schema changes**: add a new file in `supabase/migrations/` and `supabase db push`. Re-run any new seed file with `psql`.
- **Backend updates**: push to the connected branch → Railway/Render auto-redeploys.
- **App updates**: bump nothing manually (the `production` profile auto-increments the build number); `eas build` + `eas submit` again. For JS-only changes you can also use **EAS Update** (OTA) to skip review — set that up later if you want.
- **Secrets**: never commit `.env`. Keep the service-role key and Gemini key only in the host's env vars.
- **Costs to watch**: Gemini usage (live transcription + evaluation per attempt), Supabase storage (recordings) and DB egress, and your backend host's compute.

---

## Quick checklist

- [ ] Supabase project created; migrations pushed; seeds loaded; `recordings` bucket present; email confirmation configured
- [ ] Backend deployed; `/health` returns ok; env vars set (incl. billing-enabled Gemini key)
- [ ] `apps/mobile/.env` points at prod Supabase + backend URL
- [ ] Apple Developer enrolled; App Store Connect app created with `dev.oratio.app`
- [ ] `eas build --platform ios --profile production` succeeds
- [ ] `eas submit` → TestFlight tested on device → App Privacy + demo account filled → submitted for review
