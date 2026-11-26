-- Table privileges for the API roles.
-- Newer Supabase projects no longer grant the anon / authenticated / service_role roles access to
-- tables in public automatically. Row-level security (init migration) still decides WHICH rows a
-- user can see or change; these grants only let the roles reach the tables at all.

grant usage on schema public to anon, authenticated, service_role;

-- Signed-in users: their own data, filtered by the RLS policies.
grant select, insert, update, delete on
  public.profiles, public.trips, public.trip_stops, public.trip_media, public.memories,
  public.replays, public.favorites, public.dismissed_places, public.shared_trips
to authenticated;
grant select, insert on public.render_jobs to authenticated;          -- read own jobs, queue a job
grant select on public.subscriptions, public.ai_usage, public.discoveries to authenticated;  -- read-only; webhooks / functions write

-- Everyone (signed in or not): remote config such as plan prices.
grant select on public.app_config to anon, authenticated;

-- Server side (Edge Functions, webhooks) uses the service role, which bypasses RLS.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- RPCs: the public share page reads a shared replay by token; account deletion is for the signed-in user.
grant execute on function public.get_shared_replay(text) to anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;
