# Shipping ōrātiō to the App Store

This guide takes the app from the repo to **TestFlight and the App Store** via EAS. It assumes
the cloud services (Supabase + FastAPI backend + Gemini) are already deployed — that part is
platform-independent and covered in [`DEPLOYMENT.md`](DEPLOYMENT.md) §1–3 (paid tiers) or
[`ANDROID_DEPLOYMENT.md`](ANDROID_DEPLOYMENT.md) Parts A–D (free tiers). iOS has no free
distribution path: unlike Android sideloading, reaching real users requires the
**Apple Developer Program ($99/year)**.

## What you'll need

| Thing | Cost | Notes |
|---|---|---|
| Apple Developer Program | $99/year | [developer.apple.com](https://developer.apple.com) — takes up to 48 h to activate |
| Expo account + EAS | Free tier OK | Cloud builds queue longer on free; no Mac required for building |
| Deployed cloud services | free–$5/mo | Backend URL + Supabase URL/key get **baked into the binary** |
| App Store Connect app record | — | Bundle id **`dev.oratio.app`** (matches `app.json`) |

---

## 0. Before building: test the iOS-specific parts

The Android build is battle-tested; these three things are **iOS-side and still unverified**.
Run a dev build on a simulator/device first (`npx expo run:ios`) and check:

1. **Caption engine "Device"** (`expo-speech-recognition` → SFSpeechRecognizer):
   - The plugin in `app.json` injects the mic + speech-recognition permission strings; iOS will
     show **two** permission prompts on first drill.
   - iOS persists the recording as **32-bit float PCM at 44.1/48 kHz by default**; we request
     `outputSampleRate: 16000`, but verify the uploaded WAV transcribes correctly on the
     fallback path (do one Device-engine drill and check the transcript).
2. **Caption engine "Whisper"** (`whisper.rn`): tiny.en runs fine on modern iPhones (no
   Extended Virtual Addressing needed for tiny). Verify the model download + a drill.
3. **Audio session sharing**: roleplay both records and plays persona audio; confirm the
   existing audio-session handling still behaves with the new modules linked.

If a caption engine misbehaves on iOS, remember captions never affect scoring — worst case,
ship with **Gemini** as the only advertised engine and fix the rest in an update.

---

## 1. One-time setup

```bash
npm install -g eas-cli
eas login

cd apps/mobile
eas build:configure          # registers the project with EAS
```

Set the **production** env vars the binary bakes in — either in `apps/mobile/.env` at build
time, or (better) as EAS environment variables bound to the `production` profile:

```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
EXPO_PUBLIC_API_URL=https://<your-backend-domain>    # https → the app derives wss:// itself
EXPO_PUBLIC_POSTHOG_API_KEY=                          # optional
```

## 2. App Store Connect record

1. In [App Store Connect](https://appstoreconnect.apple.com) → **My Apps → +** → New App:
   bundle id `dev.oratio.app`, name **ōrātiō** (have fallbacks ready — plain "oratio" — in
   case the diacritics are rejected or taken).
2. EAS can create the App ID, certificates and provisioning profile for you during the first
   build — just sign in with your Apple account when prompted.

## 3. Build & submit

```bash
cd apps/mobile
eas build --platform ios --profile production    # cloud build, ~15-30 min
eas submit --platform ios --latest               # uploads to App Store Connect
```

The `production` profile auto-increments the build number (`appVersionSource: remote`).

## 4. TestFlight first

Add the build to TestFlight and run through, on a real iPhone:

- [ ] Sign up / sign in (email confirmation must be OFF or SMTP configured in Supabase)
- [ ] One drill per caption engine (Gemini / Device / Whisper incl. model download on Wi-Fi)
- [ ] Full result: transcript, scores, feedback — and confirm the recording is auto-deleted
      afterwards (results page shows no playback once evaluation completes)
- [ ] Coach, debate, roleplay (roleplay = persona voice audible)
- [ ] Clear attempt history; theme switch; sign out/in

## 5. App Store metadata & review

- **App Privacy (nutrition labels)** — declare honestly:
  - *Contact info*: email (account).
  - *User content*: **audio** (transient — recordings are deleted right after evaluation; say
    exactly that in the privacy notes), transcripts, performance scores.
  - *Identifiers/Usage data*: only if you enable PostHog in production.
- **Permission strings** (already in `app.json`): microphone + speech recognition, both worded
  for reviewers.
- **Export compliance**: `ITSAppUsesNonExemptEncryption: false` is already set — no per-build
  questionnaire.
- **Demo account for review**: the app gates everything behind login. Create a throwaway
  account (e.g. `review@…` + password) in your production Supabase and put it in the review
  notes, with one line: *"Mic is used to transcribe and score speaking practice; the Whisper
  option downloads a ~77 MB on-device model."*
- **Age rating**: the questionnaire yields 4+ (no user-to-user content; AI feedback only).
- **Screenshots**: 6.7" and 6.1" iPhone sets minimum; a drill with live captions, a results
  page, and the Progress tab tell the story in three shots.

Submit for review. First reviews typically take 1–3 days; login-gated apps are commonly
rejected once for missing/broken demo credentials, so test that account yourself first.

## 6. Updates

- **Native or config change** (new module, plugin, permissions): `eas build` + `eas submit` +
  review again.
- **JS-only change**: EAS Update (OTA) can skip review — set it up when release cadence starts
  to hurt; until then, full builds are simpler.
- Backend/schema updates deploy independently of the app (see `DEPLOYMENT.md` §5) — but
  remember old binaries in the wild talk to your current backend, so keep API changes
  backwards-compatible or version the endpoints.

## Known iOS-specific caveats

| Area | Caveat |
|---|---|
| Device captions | On-device recognition needs iOS 17+; older iOS falls back to Apple's server-based recognition (still fine — captions only). |
| Device captions | No pause during a take (recognizer owns the mic) — same as Android. |
| Whisper engine | tiny.en inference speed on older iPhones untested; the engine picker always allows falling back to Gemini/Device. |
| iOS Simulator | Mic input at low gain is normal; the backend AGC compensates. Test speech features on hardware. |
