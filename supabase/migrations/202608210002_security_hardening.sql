-- Security hardening for the invite-only hosted product.
-- Ownership alone is insufficient: every browser-accessible row also requires
-- a currently active membership, protecting against direct Data API access.

drop policy if exists "members read own profile" on public.profiles;
create policy "active members read own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id and (select public.is_active_member()));

drop policy if exists "members update own profile" on public.profiles;
create policy "active members update own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id and (select public.is_active_member()))
  with check ((select auth.uid()) = id and (select public.is_active_member()));

drop policy if exists "members read own applications" on public.applications;
create policy "active members read own applications"
  on public.applications for select to authenticated
  using ((select auth.uid()) = user_id and (select public.is_active_member()));

drop policy if exists "members create own applications" on public.applications;
create policy "active members create own applications"
  on public.applications for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.is_active_member()));

drop policy if exists "members update own applications" on public.applications;
create policy "active members update own applications"
  on public.applications for update to authenticated
  using ((select auth.uid()) = user_id and (select public.is_active_member()))
  with check ((select auth.uid()) = user_id and (select public.is_active_member()));

drop policy if exists "members delete own applications" on public.applications;
create policy "active members delete own applications"
  on public.applications for delete to authenticated
  using ((select auth.uid()) = user_id and (select public.is_active_member()));

drop policy if exists "members read own usage buckets" on public.usage_buckets;
create policy "active members read own usage buckets"
  on public.usage_buckets for select to authenticated
  using ((select auth.uid()) = user_id and (select public.is_active_member()));

drop policy if exists "members read own usage events" on public.usage_events;
create policy "active members read own usage events"
  on public.usage_events for select to authenticated
  using ((select auth.uid()) = user_id and (select public.is_active_member()));

-- A suspended administrator must not retain direct RPC access to aggregate
-- member usage through a still-valid Auth token.
create or replace function public.admin_usage_summary(p_days integer default 30)
returns table(member_count bigint, request_count bigint, total_tokens bigint, estimated_microusd numeric)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin'
     or not public.is_active_member() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  return query
  select
    (select count(*) from public.profiles),
    count(*) filter (where e.status = 'completed'),
    coalesce(sum(e.total_tokens) filter (where e.status = 'completed'), 0),
    coalesce(sum(e.estimated_microusd) filter (where e.status = 'completed'), 0)
  from public.usage_events e
  where e.created_at >= now() - make_interval(days => greatest(1, least(p_days, 365)));
end;
$$;

revoke all on function public.admin_usage_summary(integer) from public, anon;
grant execute on function public.admin_usage_summary(integer) to authenticated;

-- Service-only throttling for invitation sign-in requests. Only keyed HMACs
-- are retained; neither email addresses nor IP addresses are stored here.
create table if not exists public.auth_rate_limits (
  key_hash text primary key check (char_length(key_hash) = 64),
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  updated_at timestamptz not null default now()
);

alter table public.auth_rate_limits enable row level security;
revoke all on public.auth_rate_limits from public, anon, authenticated;
create index if not exists auth_rate_limits_updated_at_idx
  on public.auth_rate_limits(updated_at);

create or replace function public.consume_auth_attempt(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_started timestamptz;
  v_attempts integer;
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if char_length(p_key_hash) <> 64
     or p_limit not between 1 and 1000
     or p_window_seconds not between 60 and 86400 then
    raise exception 'invalid_rate_limit';
  end if;

  delete from public.auth_rate_limits
  where updated_at < v_now - interval '2 days';

  insert into public.auth_rate_limits (key_hash, window_started_at, attempts)
  values (p_key_hash, v_now, 0)
  on conflict (key_hash) do nothing;

  select r.window_started_at, r.attempts
  into v_started, v_attempts
  from public.auth_rate_limits r
  where r.key_hash = p_key_hash
  for update;

  if v_started + make_interval(secs => p_window_seconds) <= v_now then
    update public.auth_rate_limits
    set window_started_at = v_now, attempts = 1, updated_at = v_now
    where key_hash = p_key_hash;
    return query select true, 0;
  end if;

  if v_attempts >= p_limit then
    return query select false,
      greatest(1, ceil(extract(epoch from
        (v_started + make_interval(secs => p_window_seconds) - v_now)))::integer);
    return;
  end if;

  update public.auth_rate_limits
  set attempts = attempts + 1, updated_at = v_now
  where key_hash = p_key_hash;
  return query select true, 0;
end;
$$;

revoke all on function public.consume_auth_attempt(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_auth_attempt(text, integer, integer)
  to service_role;
