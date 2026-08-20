-- Career Ops Community: minimal member data + atomic AI budget accounting.
-- No CVs, job descriptions, prompts, or model outputs are persisted here.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  target_roles text[] not null default '{}',
  locations text[] not null default '{}',
  work_modes text[] not null default '{remote,hybrid}',
  salary_min integer,
  salary_max integer,
  include_community_sources boolean not null default true,
  daily_token_limit integer not null default 20000 check (daily_token_limit between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(display_name) <= 80),
  constraint profiles_salary_order check (salary_min is null or salary_max is null or salary_min <= salary_max)
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_url text not null,
  company text not null default '',
  title text not null default '',
  location text not null default '',
  source text not null default 'manual',
  status text not null default 'saved' check (status in ('saved','evaluating','ready','applied','interview','offer','rejected','withdrawn','skipped')),
  score numeric(3,2) check (score is null or (score >= 0 and score <= 5)),
  note text not null default '',
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_job_url_length check (char_length(job_url) between 8 and 2048),
  constraint applications_company_length check (char_length(company) <= 160),
  constraint applications_title_length check (char_length(title) <= 200),
  constraint applications_note_length check (char_length(note) <= 1000)
);

create index if not exists applications_user_status_idx on public.applications(user_id, status, updated_at desc);
create unique index if not exists applications_user_url_idx on public.applications(user_id, job_url);

create table if not exists public.usage_buckets (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null default (now() at time zone 'utc')::date,
  used_tokens integer not null default 0 check (used_tokens >= 0),
  reserved_tokens integer not null default 0 check (reserved_tokens >= 0),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_day)
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  operation text not null,
  model text not null,
  status text not null default 'reserved' check (status in ('reserved','completed','failed')),
  reserved_tokens integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  estimated_microusd bigint not null default 0,
  error_code text,
  usage_day date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, request_id),
  constraint usage_events_operation_length check (char_length(operation) between 1 and 60),
  constraint usage_events_model_length check (char_length(model) between 1 and 100),
  constraint usage_events_error_code_length check (error_code is null or char_length(error_code) <= 80)
);

create index if not exists usage_events_user_created_idx on public.usage_events(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.applications enable row level security;
alter table public.usage_buckets enable row level security;
alter table public.usage_events enable row level security;

create policy "members read own profile" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "members update own profile" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "members read own applications" on public.applications for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "members create own applications" on public.applications for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "members update own applications" on public.applications for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "members delete own applications" on public.applications for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "members read own usage buckets" on public.usage_buckets for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "members read own usage events" on public.usage_events for select to authenticated
  using ((select auth.uid()) = user_id);

-- Members may edit preferences but never their own quota. Hide reservation IDs
-- so an in-flight server reservation cannot be finalized from a browser client.
revoke update on public.profiles from authenticated;
grant update (display_name, target_roles, locations, work_modes, salary_min, salary_max, include_community_sources)
  on public.profiles to authenticated;
revoke select on public.usage_events from authenticated;
grant select (id, operation, model, status, input_tokens, output_tokens, total_tokens, estimated_microusd, error_code, created_at, completed_at)
  on public.usage_events to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists applications_updated_at on public.applications;
create trigger applications_updated_at before update on public.applications
for each row execute function public.set_updated_at();

create or replace function public.handle_new_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_member();

create or replace function public.reserve_ai_usage(
  p_request_id uuid,
  p_reserved_tokens integer,
  p_operation text,
  p_model text
)
returns table(granted boolean, remaining_tokens integer, daily_limit integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_day date := (now() at time zone 'utc')::date;
  v_limit integer;
  v_used integer;
  v_reserved integer;
begin
  if v_user is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_reserved_tokens < 1 or p_reserved_tokens > 20000 then raise exception 'invalid_reservation'; end if;
  if char_length(p_operation) not between 1 and 60 then raise exception 'invalid_operation'; end if;
  if char_length(p_model) not between 1 and 100 then raise exception 'invalid_model'; end if;

  select p.daily_token_limit into v_limit from public.profiles p where p.id = v_user;
  v_limit := coalesce(v_limit, 20000);

  insert into public.usage_buckets (user_id, usage_day)
  values (v_user, v_day) on conflict (user_id, usage_day) do nothing;

  select b.used_tokens, b.reserved_tokens into v_used, v_reserved
  from public.usage_buckets b where b.user_id = v_user and b.usage_day = v_day for update;

  if v_used + v_reserved + p_reserved_tokens > v_limit then
    return query select false, greatest(0, v_limit - v_used - v_reserved), v_limit;
    return;
  end if;

  insert into public.usage_events (user_id, request_id, operation, model, reserved_tokens)
  values (v_user, p_request_id, p_operation, p_model, p_reserved_tokens);
  update public.usage_buckets
  set reserved_tokens = reserved_tokens + p_reserved_tokens,
      request_count = request_count + 1,
      updated_at = now()
  where user_id = v_user and usage_day = v_day;

  return query select true, v_limit - v_used - v_reserved - p_reserved_tokens, v_limit;
end;
$$;

create or replace function public.finalize_ai_usage(
  p_request_id uuid,
  p_input_tokens integer,
  p_output_tokens integer,
  p_total_tokens integer,
  p_estimated_microusd bigint default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_reserved integer;
  v_event_day date;
begin
  if v_user is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if least(p_input_tokens, p_output_tokens, p_total_tokens, p_estimated_microusd) < 0 then raise exception 'invalid_usage'; end if;

  select e.reserved_tokens, e.usage_day into v_reserved, v_event_day from public.usage_events e
  where e.user_id = v_user and e.request_id = p_request_id and e.status = 'reserved' for update;
  if v_reserved is null then raise exception 'reservation_not_found'; end if;

  update public.usage_buckets
  set reserved_tokens = greatest(0, reserved_tokens - v_reserved),
      used_tokens = used_tokens + p_total_tokens,
      updated_at = now()
  where user_id = v_user and usage_day = v_event_day;

  update public.usage_events set
    status = 'completed', input_tokens = p_input_tokens, output_tokens = p_output_tokens,
    total_tokens = p_total_tokens, estimated_microusd = p_estimated_microusd,
    completed_at = now()
  where user_id = v_user and request_id = p_request_id;
end;
$$;

create or replace function public.release_ai_usage(p_request_id uuid, p_error_code text default 'request_failed')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_reserved integer;
  v_event_day date;
begin
  if v_user is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select e.reserved_tokens, e.usage_day into v_reserved, v_event_day from public.usage_events e
  where e.user_id = v_user and e.request_id = p_request_id and e.status = 'reserved' for update;
  if v_reserved is null then return; end if;
  update public.usage_buckets set reserved_tokens = greatest(0, reserved_tokens - v_reserved), updated_at = now()
  where user_id = v_user and usage_day = v_event_day;
  update public.usage_events set status = 'failed', error_code = left(p_error_code, 80), completed_at = now()
  where user_id = v_user and request_id = p_request_id;
end;
$$;

create or replace function public.admin_usage_summary(p_days integer default 30)
returns table(member_count bigint, request_count bigint, total_tokens bigint, estimated_microusd numeric)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
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

revoke all on function public.reserve_ai_usage(uuid, integer, text, text) from public, anon;
revoke all on function public.finalize_ai_usage(uuid, integer, integer, integer, bigint) from public, anon;
revoke all on function public.release_ai_usage(uuid, text) from public, anon;
revoke all on function public.admin_usage_summary(integer) from public, anon;
grant execute on function public.reserve_ai_usage(uuid, integer, text, text) to authenticated;
grant execute on function public.finalize_ai_usage(uuid, integer, integer, integer, bigint) to authenticated;
grant execute on function public.release_ai_usage(uuid, text) to authenticated;
grant execute on function public.admin_usage_summary(integer) to authenticated;
