# DetourLoop

**Explore beyond the obvious.**

DetourLoop finds the places worth stopping for along a route, keeps you company while you travel, and turns the finished trip into **TravelReplay**: an animated journey map, a photo timeline, memory cards, a factual story, a film preview and a share page.

```
detour/
├─ apps/mobile/        Expo (SDK 58) · React Native 0.88 · TypeScript · Expo Router · Reanimated 4 · Gesture Handler
├─ apps/web/           Next.js 16 · landing page · public TravelReplay pages (/r/<token>) · Stripe routes
├─ supabase/
│  ├─ migrations/      schema, indexes, Row Level Security, storage policies, share RPC
│  └─ functions/       ai (OpenAI, structured outputs, rate limits) · render-video (job intake)
├─ docs/               ARCHITECTURE · DEPLOYMENT · TESTING
└─ .env.example
```

## What works today (MVP, verified in the browser)

| Flow | Status |
|---|---|
| Onboarding → interests → travel style → account | ✅ (demo profile on device; Supabase email/password when configured) |
| Create a trip: from/to search, dates, days, transport, detour distance, budget, interests, style | ✅ real geocoding (Photon) and real routing (OSRM) |
| Interactive map with route, numbered stops, discovery markers | ✅ MapLibre GL, OpenFreeMap tiles (Mapbox tiles with a token) |
| Discoveries along the route | ✅ real places from **OpenStreetMap (Overpass)** and **Wikipedia GeoSearch**, with Wikimedia photos and summaries |
| Add / save / dismiss; route recalculates with stops; reorder, skip, remove | ✅ |
| Explore: weather, ETA (estimate), next stop, Apple/Google Maps hand-off, nearby detours, notes, live-location opt-in | ✅ |
| Your DetourLoop Guide (questions about nearby places) | ✅ answers grounded in real nearby places; labelled "From map data · not AI" until AI is configured |
| Photos & videos into a trip, EXIF date/GPS, matched to the nearest stop | ✅ native; on web, photos only in demo mode |
| End trip → "Your adventure is ready to replay" → Replay | ✅ animated route map, stats, story, memory cards, timeline, media editor |
| Film preview (5 templates, 16:9 / 9:16 / 1:1) | ✅ on-device preview; **file export needs the render worker** |
| Share link (private / unlisted / public, revoke) | ⚙️ needs Supabase + deployed web app (code complete, not run against a live project) |
| Paywall, plans from remote config, entitlement checks | ✅ UI and gating; **purchases need RevenueCat / Stripe keys** |
| Export data (JSON), delete account | ✅ |

Nothing pretends: estimates say "est.", data sources are named, AI output is labelled "AI-generated", non-AI text says "not AI", and a video is never shown as rendered unless the render service finished it.

## Run it

Prerequisites: Node 20+ (tested on Node 26), npm.

```bash
cd apps/mobile
npm install
npx expo start            # press w for web, or scan the QR code with Expo Go
```

```bash
cd apps/web
npm install
npm run dev               # http://localhost:3000
```

With no `.env`, the mobile app starts in **demo mode**: everything is saved on the device, AI and share links are off, and a "Demo mode" badge says so. Maps, routing, place discovery, photos and weather all use free public services and work without any key.

### Connect the backend (real accounts, sync, AI, sharing)

1. Create a Supabase project. Run the migration: `supabase link --project-ref <ref>` then `supabase db push` (or paste `supabase/migrations/20261125000000_init.sql` into the SQL editor).
2. Deploy the functions and set secrets:
   ```bash
   supabase functions deploy ai
   supabase functions deploy render-video
   supabase secrets set OPENAI_API_KEY=sk-... OPENAI_MODEL=gpt-4.1-mini
   ```
3. Copy the relevant lines of `.env.example` into `apps/mobile/.env` and `apps/web/.env.local`.
4. Restart both apps. The demo badge disappears; sign-up now creates a real account.

See **docs/DEPLOYMENT.md** for store builds, Vercel, Stripe, RevenueCat and the video worker.

## External services

| Service | Used for | Key needed | Without it |
|---|---|---|---|
| Supabase | auth, Postgres, storage, edge functions | URL + anon key (public), service role (server) | demo mode on device |
| OpenAI | discovery reasons, Replay story, Guide answers | `OPENAI_API_KEY` (edge function secret only) | data-built text, labelled "not AI" |
| Mapbox | tiles, directions, geocoding | public `pk.` token | OpenFreeMap + OSRM + Photon |
| OpenStreetMap Overpass | places along a route | none (fair use) | Wikipedia results only |
| Wikipedia / Wikimedia | place photos and summaries | none | designed placeholder, never stock |
| Open-Meteo | weather, sunset time | none | weather pill hidden |
| RevenueCat / Stripe | subscriptions | SDK key / secret key | paywall says purchases are not set up; no charge |
| Render worker (FFmpeg) | exporting video files | `RENDER_WORKER_URL` | on-device preview only |

Public servers (OSRM demo, Overpass, Photon) are fair-use services meant for development. Before launch, switch to Mapbox or self-hosted instances (see DEPLOYMENT).

## Design system

Ocean `#183C50` · Teal `#285B65` · Sand `#D7C5A7` · Cream `#E9E4D9` · Charcoal `#38352F` · Soft white `#F8F7F3` · Gray `#92979A`.
Roboto throughout (bold for headlines). Tokens: `apps/mobile/src/theme/tokens.ts` and `apps/web/src/app/globals.css`.
