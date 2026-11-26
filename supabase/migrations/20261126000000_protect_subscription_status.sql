-- Only the service role (the RevenueCat and Stripe webhooks) may change a user's plan.
-- The "own profile" policy lets users update their own row, which without this trigger would
-- include profiles.subscription_status, i.e. a user could give themselves Plus for free.

create or replace function public.protect_subscription_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Runs as the caller (no security definer), so current_user is the real role:
  -- app users arrive as "authenticated", admins editing in SQL as "postgres".
  if coalesce(auth.role(), '') <> 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    if tg_op = 'INSERT' then
      new.subscription_status := 'free';
    elsif new.subscription_status is distinct from old.subscription_status then
      new.subscription_status := old.subscription_status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_subscription_status on public.profiles;
create trigger protect_subscription_status
  before insert or update on public.profiles
  for each row execute function public.protect_subscription_status();
