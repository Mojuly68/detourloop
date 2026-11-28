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

- Auth → Sign In / Providers: turn on **Allow anonymous sign-ins** and **Allow manual linking**. The mobile app has no email or password: it starts as a guest (anonymous user) and offers **Sign in with Apple** in Profile, which links Apple to the same user, so trips and the RevenueCat customer stay.
- Auth → Providers → **Apple**: enabled, Client IDs `com.detourloop.app` (native iOS sign-in needs no secret key). In Apple Developer, the App ID has the "Sign In with Apple" capability; changing capabilities invalidates the App Store profile, so regenerate it and re-fetch it in Codemagic (Code signing identities → iOS provisioning profiles).
- Auth → URL configuration: add the web app URL and `detourloop://` as redirect URLs.
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

**Stripe (web)**: create two recurring prices ($2.29/month, $24/year), set `STRIPE_PRICE_PLUS_MONTHLY` / `STRIPE_PRICE_PLUS_ANNUAL`, and add a webhook to `https://<web>/api/stripe-webhook` for `customer.subscription.created|updated|deleted`; put its signing secret in `STRIPE_WEBHOOK_SECRET`.

**RevenueCat (iOS/Android)**: the SDK (`react-native-purchases`) is installed and wired in `src/services/revenuecat.native.ts` (the web uses Stripe instead). It needs a native build (Codemagic / EAS); in Expo Go it runs in RevenueCat's preview mode.

1. **App Store Connect** → DetourLoop → Monetization → Subscriptions: create a subscription group "DetourLoop Plus" with two auto-renewable products, `detourloop_monthly` (1 month, $2.29) and `detourloop_annual` (1 year, $24.00). Fill in price, display name and a review screenshot. Accept the Paid Apps agreement (Business section) or the store returns no products.
2. **RevenueCat** → add the iOS app (bundle ID `com.detourloop.app`) with an **In-App Purchase Key** (App Store Connect → Users and Access → Integrations → In-App Purchase). Import both products.
3. **Entitlement** `plus` with both products attached. **Offering** `default` (current) with the packages **Monthly** (`$rc_monthly` → monthly product) and **Annual** (`$rc_annual` → annual product). The paywall reads these two packages and shows the store's localised prices.
4. **Custom URL scheme** (app settings): `detourloop`.
5. **Public SDK key** (`appl_…`, Project → API keys) → `EXPO_PUBLIC_REVENUECAT_IOS_KEY` in the Codemagic build environment (`vars:` of `ios-testflight`, or a variable group). It is a public key, safe in the app. Android: same with `goog_…` → `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` and a Google Play service account in RevenueCat.
6. **Webhook** (cloud mode only): `supabase functions deploy revenuecat-webhook --no-verify-jwt`, `supabase secrets set REVENUECAT_WEBHOOK_AUTH="Bearer <long random string>"`, then RevenueCat → Integrations → Webhooks with the function URL and the same Authorization value. It updates `subscriptions` and `profiles.subscription_status`. Migration `20261126000000_protect_subscription_status.sql` makes that column writable only by the webhooks.

**Google Play (Android)**, set up 27–28 Nov 2026:

- Play Console app `com.detourloop.app` (account DynoMark). Internal testing track live; first bundle uploaded by hand.
- Subscriptions: `detourloop_monthly` (base plan `monthly`, $2.29) and `detourloop_annual` (base plan `annual`, $24.00 US), both active. RevenueCat product IDs are `detourloop_monthly:monthly` and `detourloop_annual:annual`, attached to `plus` and to the default offering's Monthly / Yearly packages.
- RevenueCat Play app `app76284dbfb2` uses the TorkVRA service account `revenuecat@torkvra-play.iam.gserviceaccount.com` (granted View app info, View financial data, Manage orders and subscriptions on DetourLoop). Its JSON key is uploaded in RevenueCat by hand; new apps can take up to 36 h before Google accepts it.
- Public SDK key `goog_…` is in both Android workflows in `codemagic.yaml`.
- Release builds: `android-play` workflow → signed `.aab` (upload key stored in Codemagic as `detourloop_upload`; the keystore and its password live in `_private/detourloop-android/` outside the repo). `plugins/withPlayRelease.js` wires the signing and the versionCode.
- Purchases only work in builds installed from Play (internal testing link), not in the sideloaded APK. Add tester accounts under Play Console → Settings → License testing so test purchases are free.

Testing: TestFlight purchases use Apple's sandbox and are never charged. Sandbox subscriptions renew every few minutes (a month ≈ 5 min) and stop after a few renewals. The paywall's **Restore purchases** button and the auto-renewal text are required by App Review. Before release, publish a privacy policy at `EXPO_PUBLIC_WEB_URL/privacy` (the paywall links to it when the web URL is set).

## 5. Video render worker

A small container that: polls `render_jobs` where `status='queued'` (service role), loads the replay, trip and selected media, renders frames (MapLibre headless for map moves + photos with the chosen template), encodes with FFmpeg at the chosen aspect, uploads to `trip-media/<user>/<trip>/replay.mp4`, then sets `status='done'`, `progress=100`, `output_url`, and `replays.video_url`. Set `RENDER_WORKER_URL` and `RENDER_WORKER_SECRET` as function secrets. Music must come from a licensed library or the user's own file.

## 6. Before launch

- Replace public OSRM / Overpass / Photon with Mapbox (set `EXPO_PUBLIC_MAPBOX_TOKEN`) or self-hosted instances.
- Add a privacy policy and terms (location, photos, AI processing by OpenAI).
- App Store: location "when in use" only; photo library "limited" access supported.
- Rate limits: AI per plan per day in `app_config.plans.*.ai_discoveries_per_day`.
