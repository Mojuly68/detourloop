# DetourLoop — deployment

## 1. Supabase

```bash
npm i -g supabase            # or use npx supabase
supabase login
supabase link --project-ref <ref>
supabase db push             # applies supabase/migrations
supabase functions deploy ai
supabase functions deploy render-video
supabase secrets set OPENAI_API_KEY=sk-... OPENAI_MODEL=gpt-4.1-mini
```

- Auth → URL configuration: add the web app URL and `detourloop://` as redirect URLs.
- Auth → Email: decide whether to require email confirmation (the app handles both).
- Prices and quotas: edit the `plans` row in `app_config` (no app release needed).

## 2. Web app (Vercel or any Node host)

Set in the host's environment: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the Stripe variables.

```bash
cd apps/web && npm run build && npm start
```

Then set `EXPO_PUBLIC_WEB_URL` in the mobile app to this URL so share links point here.

## 3. Mobile app

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform ios       # or android
npx eas-cli@latest submit --platform ios
```

### Codemagic (alternative to EAS)

`codemagic.yaml` at the repo root has two workflows; both build `apps/mobile`.

| Workflow | Output | You need |
|---|---|---|
| `android-apk` | `app-release.apk`, installable on any Android phone (signed with the debug key) | nothing; runs on every push to `main`, or start it by hand |
| `ios-testflight` | IPA uploaded to TestFlight | Apple Developer account; App Store Connect app with bundle ID `com.detourloop.app`; an App Store Connect API key (App Manager) added in Codemagic → Team settings → Integrations, named `DetourLoop ASC key` |

Steps: push this folder to GitHub / GitLab / Bitbucket → Codemagic → Add application → pick the repo → it detects `codemagic.yaml` → Start new build → choose the workflow. For Android, download the APK from the build page on your phone and allow "install unknown apps". For iOS, install TestFlight and accept the invite.

Optional: create a variable group `detourloop_public` with the `EXPO_PUBLIC_*` values and uncomment `groups:` in both workflows. For Google Play, upload a keystore in Codemagic (Code signing identities) and add release signing to the build.

Set `EXPO_PUBLIC_*` variables as EAS environment variables. Bundle IDs are `com.detourloop.app` in `app.json`; change them to yours.

Web build of the mobile app (optional, e.g. for a browser beta): `npx expo export --platform web` → static files in `dist/`.

## 4. Payments

**Stripe (web)**: create two recurring prices ($7.99/month, $59.99/year), set `STRIPE_PRICE_PLUS_MONTHLY` / `STRIPE_PRICE_PLUS_ANNUAL`, and add a webhook to `https://<web>/api/stripe-webhook` for `customer.subscription.created|updated|deleted`; put its signing secret in `STRIPE_WEBHOOK_SECRET`.

**RevenueCat (iOS/Android)**: create products `detourloop_plus_monthly` and `detourloop_plus_annual`, entitlement `plus`. Install `react-native-purchases` (`npx expo install react-native-purchases`, needs a development build), call `Purchases.configure` with the public SDK key, and replace the RevenueCat branch in `src/services/subscriptions.ts`. Add a RevenueCat webhook (an Edge Function) that upserts `subscriptions` and `profiles.subscription_status`, like the Stripe one.

## 5. Video render worker

A small container that: polls `render_jobs` where `status='queued'` (service role), loads the replay, trip and selected media, renders frames (MapLibre headless for map moves + photos with the chosen template), encodes with FFmpeg at the chosen aspect, uploads to `trip-media/<user>/<trip>/replay.mp4`, then sets `status='done'`, `progress=100`, `output_url`, and `replays.video_url`. Set `RENDER_WORKER_URL` and `RENDER_WORKER_SECRET` as function secrets. Music must come from a licensed library or the user's own file.

## 6. Before launch

- Replace public OSRM / Overpass / Photon with Mapbox (set `EXPO_PUBLIC_MAPBOX_TOKEN`) or self-hosted instances.
- Add a privacy policy and terms (location, photos, AI processing by OpenAI).
- App Store: location "when in use" only; photo library "limited" access supported.
- Rate limits: AI per plan per day in `app_config.plans.*.ai_discoveries_per_day`.
