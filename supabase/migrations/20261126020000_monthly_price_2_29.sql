-- Apple has no $2.25 price point; the App Store monthly price is $2.29 (26 Nov 2026).
-- Keep remote config (shown on the web paywall and as the fallback in the app) in line with the store.
update public.app_config
set value = jsonb_set(value, '{plus,price}', '2.29'::jsonb), updated_at = now()
where key = 'plans';
