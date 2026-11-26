-- DetourLoop — initial schema
-- Tables, indexes, Row Level Security, storage policies and the public share RPC.
-- Every user-owned row is reachable only by its owner. Public replays are exposed
-- exclusively through get_shared_replay(), which returns only what the owner selected.

create extension if not exists "pgcrypto" with schema extensions;

-- ───────────────────────────── helpers ─────────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ───────────────────────────── profiles ─────────────────────────────
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  display_name        text check (char_length(display_name) <= 80),
  email               text,
  avatar_url          text,
  travel_preferences  jsonb not null default '{}'::jsonb,
  travel_style        text check (travel_style in ('relaxed','adventurous','spontaneous','family','romantic','photography')),
  travel_personality  text,
  subscription_status text not null default 'free' check (subscription_status in ('free','plus','annual')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

-- Create a profile row for every new auth user.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ───────────────────────────── trips ─────────────────────────────
create table public.trips (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 120),
  origin          jsonb not null,             -- {name, lat, lng}
  destination     jsonb,                      -- null = open-ended exploration
  start_date      date,
  end_date        date,
  status          text not null default 'planned' check (status in ('planned','active','completed','saved')),
  transport_mode  text not null default 'driving' check (transport_mode in ('driving','cycling','walking')),
  budget          text check (budget in ('shoestring','moderate','comfort','luxury')),
  interests       text[] not null default '{}',
  travel_style    text,
  max_detour_km   numeric(6,1) not null default 25 check (max_detour_km between 0 and 500),
  route_geometry  jsonb,                      -- GeoJSON LineString
  route_distance_m numeric,
  route_duration_s numeric,
  cover_image     text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint trip_dates check (end_date is null or start_date is null or end_date >= start_date)
);
create index trips_user_idx on public.trips(user_id, status, start_date desc);
create trigger trips_updated before update on public.trips for each row execute function public.set_updated_at();

-- ───────────────────────────── trip_stops ─────────────────────────────
create table public.trip_stops (
  id                        uuid primary key default gen_random_uuid(),
  trip_id                   uuid not null references public.trips(id) on delete cascade,
  place_id                  text,             -- e.g. "osm:node/123" or "mapbox:poi.456"
  name                      text not null,
  latitude                  double precision not null check (latitude between -90 and 90),
  longitude                 double precision not null check (longitude between -180 and 180),
  category                  text,
  description               text,
  image_url                 text,
  sequence                  int not null default 0,
  estimated_visit_duration  int,              -- minutes (estimate)
  status                    text not null default 'planned' check (status in ('planned','visited','skipped')),
  created_at                timestamptz not null default now()
);
create index trip_stops_trip_idx on public.trip_stops(trip_id, sequence);

-- ───────────────────────────── discoveries (shared place cache) ─────────────────────────────
create table public.discoveries (
  id          uuid primary key default gen_random_uuid(),
  place_id    text not null unique,
  name        text not null,
  description text,
  category    text,
  latitude    double precision not null,
  longitude   double precision not null,
  image_url   text,
  source      text not null,                  -- 'openstreetmap' | 'mapbox' | 'wikipedia'
  rating      numeric(2,1),                   -- only when a provider supplied it
  raw         jsonb,
  created_at  timestamptz not null default now()
);
create index discoveries_geo_idx on public.discoveries(latitude, longitude);

-- ───────────────────────────── trip_media ─────────────────────────────
create table public.trip_media (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips(id) on delete cascade,
  stop_id       uuid references public.trip_stops(id) on delete set null,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  media_type    text not null check (media_type in ('photo','video')),
  media_url     text not null,                -- storage path: <user_id>/<trip_id>/<file>
  thumbnail_url text,
  captured_at   timestamptz,
  latitude      double precision,
  longitude     double precision,
  caption       text check (char_length(caption) <= 500),
  is_favorite   boolean not null default false,
  created_at    timestamptz not null default now()
);
create index trip_media_trip_idx on public.trip_media(trip_id, captured_at);

-- ───────────────────────────── memories ─────────────────────────────
create table public.memories (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  title       text not null,
  description text,
  location    text,
  event_date  date,
  media_ids   uuid[] not null default '{}',
  created_at  timestamptz not null default now()
);
create index memories_trip_idx on public.memories(trip_id);

-- ───────────────────────────── replays ─────────────────────────────
create table public.replays (
  id                 uuid primary key default gen_random_uuid(),
  trip_id            uuid not null references public.trips(id) on delete cascade,
  user_id            uuid not null references public.profiles(id) on delete cascade,
  title              text not null,
  narrative          text,
  narrative_source   text not null default 'template' check (narrative_source in ('ai','template','user')),
  cover_image        text,
  animated_map_url   text,
  video_url          text,
  selected_media_ids uuid[] not null default '{}',   -- the only media a public story may show
  stats              jsonb not null default '{}'::jsonb,
  status             text not null default 'draft' check (status in ('draft','ready','rendering','failed')),
  visibility         text not null default 'private' check (visibility in ('private','unlisted','public')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (trip_id)
);
create trigger replays_updated before update on public.replays for each row execute function public.set_updated_at();

-- ───────────────────────────── video render jobs ─────────────────────────────
create table public.render_jobs (
  id          uuid primary key default gen_random_uuid(),
  replay_id   uuid not null references public.replays(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  template    text not null check (template in ('cinematic','adventure','minimalist','documentary','social')),
  aspect      text not null check (aspect in ('16:9','9:16','1:1')),
  status      text not null default 'queued' check (status in ('queued','rendering','done','failed','unavailable')),
  progress    int not null default 0 check (progress between 0 and 100),
  output_url  text,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger render_jobs_updated before update on public.render_jobs for each row execute function public.set_updated_at();

-- ───────────────────────────── favorites ─────────────────────────────
create table public.favorites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  place_id   text not null,
  place      jsonb not null,                 -- snapshot: name, lat, lng, category, image
  created_at timestamptz not null default now(),
  unique (user_id, place_id)
);

-- Places the user dismissed ("Not interested"), used by personalization.
create table public.dismissed_places (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  place_id   text not null,
  category   text,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

-- ───────────────────────────── shared_trips ─────────────────────────────
create table public.shared_trips (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  share_token text not null unique default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/=', '-_'),  -- URL-safe
  visibility  text not null default 'unlisted' check (visibility in ('unlisted','public')),
  revoked     boolean not null default false,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index shared_trips_trip_idx on public.shared_trips(trip_id);

-- ───────────────────────────── subscriptions & config ─────────────────────────────
create table public.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references public.profiles(id) on delete cascade,
  plan          text not null default 'free' check (plan in ('free','plus','annual')),
  status        text not null default 'active' check (status in ('active','trialing','past_due','canceled','expired')),
  provider      text check (provider in ('revenuecat','stripe')),
  provider_ref  text,
  renewal_date  timestamptz,
  updated_at    timestamptz not null default now()
);

-- Remote config: prices, quotas, feature flags. Readable by everyone, writable only by service role.
create table public.app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.app_config (key, value) values
  ('plans', '{
     "free":   {"price": 0,     "currency": "USD", "period": null,    "ai_discoveries_per_day": 10, "active_trips": 3,  "media_mb": 500},
     "plus":   {"price": 2.25,  "currency": "USD", "period": "month", "ai_discoveries_per_day": 200,"active_trips": 50, "media_mb": 20000},
     "annual": {"price": 24.00, "currency": "USD", "period": "year",  "ai_discoveries_per_day": 200,"active_trips": 50, "media_mb": 20000}
   }'::jsonb);

-- Per-user AI usage, for rate limiting in the ai Edge Function.
create table public.ai_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day     date not null default current_date,
  calls   int not null default 0,
  primary key (user_id, day)
);

-- ───────────────────────────── Row Level Security ─────────────────────────────
alter table public.profiles         enable row level security;
alter table public.trips            enable row level security;
alter table public.trip_stops       enable row level security;
alter table public.discoveries      enable row level security;
alter table public.trip_media       enable row level security;
alter table public.memories         enable row level security;
alter table public.replays          enable row level security;
alter table public.render_jobs      enable row level security;
alter table public.favorites        enable row level security;
alter table public.dismissed_places enable row level security;
alter table public.shared_trips     enable row level security;
alter table public.subscriptions    enable row level security;
alter table public.app_config       enable row level security;
alter table public.ai_usage         enable row level security;

create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

create policy "own trips" on public.trips for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.owns_trip(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trips where id = t and user_id = auth.uid());
$$;

create policy "stops of own trips"    on public.trip_stops for all using (public.owns_trip(trip_id)) with check (public.owns_trip(trip_id));
create policy "memories of own trips" on public.memories   for all using (public.owns_trip(trip_id)) with check (public.owns_trip(trip_id));
create policy "own media"   on public.trip_media for all using (user_id = auth.uid()) with check (user_id = auth.uid() and public.owns_trip(trip_id));
create policy "own replays" on public.replays    for all using (user_id = auth.uid()) with check (user_id = auth.uid() and public.owns_trip(trip_id));
create policy "own render jobs read"   on public.render_jobs for select using (user_id = auth.uid());
create policy "own render jobs insert" on public.render_jobs for insert with check (user_id = auth.uid());
create policy "own favorites"  on public.favorites        for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own dismissed"  on public.dismissed_places for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own shares"     on public.shared_trips     for all using (owner_id = auth.uid()) with check (owner_id = auth.uid() and public.owns_trip(trip_id));
create policy "own subscription read" on public.subscriptions for select using (user_id = auth.uid());
-- subscriptions are written only by the service role (RevenueCat / Stripe webhooks)
create policy "discoveries readable" on public.discoveries for select using (auth.role() = 'authenticated');
create policy "config readable" on public.app_config for select using (true);
create policy "own ai usage read" on public.ai_usage for select using (user_id = auth.uid());

-- ───────────────────────────── public share RPC ─────────────────────────────
-- Returns ONLY: replay title/narrative/stats/cover, the stop names+coords, the route,
-- and the media the owner selected. No email, notes, budget, or unselected media.
create or replace function public.get_shared_replay(token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s public.shared_trips;
  r public.replays;
  t public.trips;
begin
  select * into s from public.shared_trips
   where share_token = token and not revoked and (expires_at is null or expires_at > now());
  if not found then return null; end if;

  select * into r from public.replays where trip_id = s.trip_id and visibility in ('unlisted','public');
  if not found then return null; end if;

  select * into t from public.trips where id = s.trip_id;

  return jsonb_build_object(
    'title',      r.title,
    'narrative',  r.narrative,
    'narrative_source', r.narrative_source,
    'cover_image', r.cover_image,
    'video_url',  r.video_url,
    'stats',      r.stats,
    'start_date', t.start_date,
    'end_date',   t.end_date,
    'origin',     jsonb_build_object('name', t.origin->>'name', 'lat', t.origin->'lat', 'lng', t.origin->'lng'),
    'destination', case when t.destination is null then null else
                   jsonb_build_object('name', t.destination->>'name', 'lat', t.destination->'lat', 'lng', t.destination->'lng') end,
    'route',      t.route_geometry,
    'stops', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'lat', latitude, 'lng', longitude, 'category', category, 'image', image_url) order by sequence)
                        from public.trip_stops where trip_id = t.id and status <> 'skipped'), '[]'::jsonb),
    'media', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'type', media_type, 'path', media_url, 'caption', caption, 'captured_at', captured_at) order by captured_at)
                        from public.trip_media where trip_id = t.id and id = any(r.selected_media_ids)), '[]'::jsonb)
  );
end $$;
revoke all on function public.get_shared_replay(text) from public;
grant execute on function public.get_shared_replay(text) to anon, authenticated;

-- Account deletion: removes the auth user, cascading every row above.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = auth.uid();
end $$;
grant execute on function public.delete_my_account() to authenticated;

-- ───────────────────────────── storage ─────────────────────────────
insert into storage.buckets (id, name, public) values ('trip-media', 'trip-media', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

-- Files live under <user_id>/... ; only the owner can read or write them.
create policy "own media files read"   on storage.objects for select using (bucket_id = 'trip-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own media files write"  on storage.objects for insert with check (bucket_id = 'trip-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own media files update" on storage.objects for update using (bucket_id = 'trip-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own media files delete" on storage.objects for delete using (bucket_id = 'trip-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar read"  on storage.objects for select using (bucket_id = 'avatars');
create policy "avatar write" on storage.objects for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar update" on storage.objects for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
