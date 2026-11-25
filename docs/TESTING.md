# DetourLoop — testing

## Automated checks

```bash
cd apps/mobile && npx tsc --noEmit          # typecheck (passes)
cd apps/mobile && npx expo export --platform web   # bundles every route (passes)
cd apps/web && npx tsc --noEmit && npx next build  # passes
```

## MVP walkthrough — verified on 25 Nov 2026 (Expo web, 375×812, demo mode)

| # | Step | Result |
|---|---|---|
| 1 | Register | Onboarding → 4 interests → "Spontaneous" → name → home. Demo profile created, "Demo mode" badge visible. |
| 2 | Create a trip | Pacific Coast Highway prefill → "San Francisco" and "Santa Barbara" geocoded by Photon → live preview "524 km · 6 h 31 min via OSRM". |
| 3 | Destination | Set by search; open-ended toggle available. |
| 4 | Interactive map | Route drawn with draw-in animation; A/B pins; discovery markers placed correctly. |
| 5 | Discover places | 29 real places within 20 km of the route. Overpass was overloaded (502) during the test, so results came from Wikipedia GeoSearch; the app kept working. Each card: real photo (Wikimedia), category, km off route, "+N min est.", reason labelled "From map data · not AI". |
| 6 | Add stops | Added Avila Beach and Point San Luis Lighthouse; route recalculated through them (543 km); numbered pins; itinerary shows reorder/skip/remove. |
| 7 | Save photos | Picker not automatable in the test browser: two photo records were seeded in demo storage (captions "TEST DATA"). The picker path (`services/media.ts`) still needs a manual run on a device. |
| 8 | Complete trip | Explore: weather "15° · Clear · sunset 16:52" (Open-Meteo), ETA estimate, next stop with Apple/Google Maps links. Guide: "Where can I watch the sunset?" → Ocean Beach, San Francisco, with photo and the real sunset time. Location denied → manual location search shown. "End trip" → "Your adventure is ready to replay." |
| 9 | Basic TravelReplay | Created: animated map with progressive reveal and photo markers, stats, story labelled "Written from your trip data · not AI", memory cards, day-by-day timeline, film preview (crossfade, 9:16). |
| 10 | Share | Demo mode shows "share links need the cloud backend" and offers "Share as text". Web `/r/<token>` shows "Sharing is not connected yet" without Supabase. |

Also checked: web landing at desktop and 375 px (no horizontal overflow); paywall renders remote-config prices with "Purchases are not connected… Nothing will be charged."

## Not yet tested (needs services or devices)

- Supabase: sign-up/sign-in, RLS isolation between two users, media upload to storage, share link creation/revocation, `get_shared_replay` with real data, account deletion. **Test plan:** create users A and B; as B, `select * from trips` must return none of A's rows; fetch `/r/<A's token>` before and after revoke (expect 404 after).
- OpenAI Edge Function: structured outputs, rate-limit 429 after the daily quota.
- iOS / Android devices: WebView map performance, camera capture, EXIF GPS, live-location toggle, haptics.
- Stripe checkout + webhook (test mode), RevenueCat sandbox purchases.
- Video render worker (not built).

## Manual device checklist

- [ ] First launch → onboarding → plan a trip in under a minute
- [ ] Deny location → manual location search works everywhere it is asked
- [ ] Add 10+ photos with GPS → they land on the right stops and days
- [ ] Reduced Motion on → all content visible, map draws without animation
- [ ] VoiceOver / TalkBack: tabs, chips (checkbox/radio), switches announce state
- [ ] Airplane mode → errors say what failed and offer retry; saved trips still open
