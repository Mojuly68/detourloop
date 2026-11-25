# DetourLoop — architecture

## Layers

| Layer | Where | Notes |
|---|---|---|
| UI (screens) | `apps/mobile/src/app/**` | Expo Router file routes. Five tabs + modal/stack screens |
| Component library | `apps/mobile/src/components/**` | `ui/primitives` (T, Button, Chip, Pill, Card, Field, Skeleton, EmptyState, ErrorState, SourceTag, Toast), `ui/media` (Photo, WikiCard, Placeholder), `ui/DiscoveryCard`, `ui/TripCard`, `ui/Sheet`, `ui/PlaceSearch`, `ui/ModeBanner`, `map/*`, `replay/ReplayPlayer` |
| App state | `src/state/store.tsx` | profile, trips, saved places; add/remove/move stops with re-routing; personalization signals |
| Data access | `src/data/repo.ts` | one `Repo` interface → `CloudRepo` (Supabase) or `LocalRepo` (device, demo) |
| Map services | `src/services/routing.ts`, `geocoding.ts`, `components/map/*` | Mapbox when a token exists, else OSRM / Photon / OpenFreeMap |
| Place data | `src/services/places.ts`, `photos.ts` | Overpass + Wikipedia GeoSearch, merged and ranked; Wikimedia images |
| AI services | `src/services/ai.ts` (client), `supabase/functions/ai` (server) | `DiscoveryService`, `ReplayStoryService`, `TravelAssistantService` |
| Personalization | `src/services/personalization.ts` | affinity learning (add / save / dismiss), travel personality |
| Media | `src/services/media.ts` | picker, EXIF date + GPS, nearest-stop matching, upload |
| Subscriptions | `src/services/subscriptions.ts`, `apps/web/src/app/api/*` | remote prices, entitlements, Stripe checkout + webhook |
| Auth | Supabase Auth via `CloudRepo` | email/password; profile row created by trigger |

### Why MapLibre in a WebView instead of `@rnmapbox/maps`

`@rnmapbox/maps` needs a custom development build and does not run on web. The map runtime (`components/map/runtime.ts`) is one JavaScript string that runs in the browser (web) and in a WebView (iOS/Android), so the same animated route, markers and progressive Replay reveal work in Expo Go, on web and in store builds. If native map performance becomes a priority, swap `MapView.tsx` for `@rnmapbox/maps`; the props (`route`, `markers`, `progress`, `fitKey`) stay the same.

### Grounding rules for AI

- Place facts (name, coordinates, distance, category, opening hours) come only from OpenStreetMap/Wikipedia. The model receives them as input and may only explain or narrate.
- Each AI task uses a strict JSON schema (`supabase/functions/ai/index.ts`).
- Every AI-touched string carries a source (`ai` / `map-data` / `template` / `user`) and the UI shows a `SourceTag`.
- Opening hours are shown only from the OSM `opening_hours` tag and labelled "unverified". Ratings: "not available" (no licensed source yet).

## Screen inventory

| Route | Screen | Key states |
|---|---|---|
| `/welcome` | Onboarding: cinematic intro, interests, style, account | demo vs cloud copy, validation errors, email-confirmation |
| `/(tabs)/index` | **Discover**: parallax hero, search, Continue, Experiences, Near You, Unexpected, Road Trips, Inspiration, place sheet | location denied → manual search, skeletons, error retry |
| `/plan` | Trip builder (modal) | geocoding prefill, live route preview, open-ended toggle, errors |
| `/trip/[id]` | Discovery engine: map, discoveries, itinerary | loading skeletons, empty (widen to 40 km), error retry, re-routing pill, straight-line warning |
| `/(tabs)/explore` | **Explore**: live trip, ETA, next stop, detour sheet, Guide, notes, captures, end trip | no active trip, location denied, live-location opt-in |
| `/(tabs)/replay` | **Replay** library | empty state |
| `/replay/[id]` | TravelReplay: intro, cover, animated map, stats, story, memory cards, timeline, film, share | no media, render unavailable, demo share notice |
| `/(tabs)/journeys` | **My Journeys**: Upcoming / Traveling / Completed / Saved, search | first-run empty state, per-tab empties |
| `/(tabs)/profile` | **Profile**: personality, plan, preferences, account, privacy, export, delete | permission states |
| `/paywall` | Plans from remote config | already subscribed, purchases not configured |
| web `/` | Landing | — |
| web `/r/[token]` | Public story | not configured, not found / revoked / expired (404) |

## Data model

See `supabase/migrations/20261125000000_init.sql`. Tables: `profiles`, `trips`, `trip_stops`, `discoveries`, `trip_media`, `memories`, `replays`, `render_jobs`, `favorites`, `dismissed_places`, `shared_trips`, `subscriptions`, `app_config`, `ai_usage`.

- Every user table has RLS: owner-only. Child tables (`trip_stops`, `memories`) check ownership of the parent trip.
- `get_shared_replay(token)` is the only path to public data. It checks the token is not revoked or expired and the replay is unlisted/public, and returns only: title, story, stats, cover, route, stop names/coords, and media the owner selected.
- Media are in the private `trip-media` bucket under `<user_id>/<trip_id>/…`; the web share page signs 1-hour URLs server-side for selected media only.
- `delete_my_account()` deletes the auth user; every table cascades.

## Gaps and decisions still open (missing technical requirements)

1. **Licensed photography at scale.** Wikimedia covers notable places; many OSM-only places have no photo. Options: Mapbox POI photos (not offered), Google Places Photos (licensing/caching limits), a curated CC library, or user photos. Today: designed placeholder.
2. **Ratings and reviews.** No source is wired. Google/Yelp/Tripadvisor APIs have display and caching rules; decide before showing any rating.
3. **Production routing/geocoding.** Public OSRM/Overpass/Photon are fair-use. Use Mapbox (token already supported) or self-host.
4. **Video rendering.** Needs a worker (FFmpeg + map frame rendering, e.g. headless MapLibre) and a licensed music library. Job table and intake function exist.
5. **Offline.** No offline map tiles or queued writes yet. Demo mode works offline only for data already saved.
6. **Push notifications.** The preference is stored; no push provider is wired.
7. **Elevation.** "Highest elevation" needs an elevation API (e.g. Open-Meteo elevation) on route points.
8. **RevenueCat SDK.** `react-native-purchases` is not installed yet (needs a dev build); the webhook → `subscriptions` path is designed in the schema.
9. **Background location.** Deliberately not implemented. Live updates run only in the foreground on Explore.
10. **Analytics.** Not wired. Recommend PostHog or Amplitude with no location data in events.
