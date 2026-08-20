-- Invite-only membership and administration for the hosted Community product.
-- Invitation secrets are stored only as SHA-256 hashes.

alter table public.profiles
  add column if not exists membership_status text not null default 'invited'
  check (membership_status in ('invited', 'active', 'suspended'));

create index if not exists profiles_membership_status_idx
  on public.profiles(membership_status, created_at desc);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'redeemed', 'revoked', 'expired')),
  daily_token_limit integer not null default 20000
    check (daily_token_limit between 0 and 100000),
  created_by uuid not null references auth.users(id) on delete restrict,
  redeemed_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  constraint invitations_email_length
    check (char_length(email) between 3 and 320),
  constraint invitations_code_hash_length
    check (char_length(code_hash) = 64)
);

create unique index if not exists invitations_pending_email_idx
  on public.invitations(lower(email))
  where status = 'pending';
create index if not exists invitations_created_at_idx
  on public.invitations(created_at desc);

alter table public.invitations enable row level security;

-- No browser-facing invitation policies: only the server service role operates
-- on this table. Admin authorization is also checked in the server route.
revoke all on public.invitations from anon, authenticated;

-- Preserve already-authorized installations when this migration is applied.
-- New users remain invited until redeem_invitation succeeds.
update public.profiles p
set membership_status = 'active'
from auth.users u
where p.id = u.id
  and (
    coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin'
    or coalesce((u.raw_app_meta_data ->> 'invited')::boolean, false)
  );

create or replace function public.redeem_invitation(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invite public.invitations%rowtype;
begin
  if v_user is null or v_email = '' then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if char_length(p_code) < 24 or char_length(p_code) > 200 then
    return false;
  end if;

  select i.* into v_invite
  from public.invitations i
  where i.code_hash = encode(extensions.digest(p_code, 'sha256'), 'hex')
    and lower(i.email) = v_email
    and i.status = 'pending'
    and i.expires_at > now()
  for update;

  if v_invite.id is null then return false; end if;

  update public.invitations
  set status = 'redeemed', redeemed_by = v_user, redeemed_at = now()
  where id = v_invite.id;

  update public.profiles
  set membership_status = 'active',
      daily_token_limit = v_invite.daily_token_limit,
      updated_at = now()
  where id = v_user;

  return true;
end;
$$;

create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.membership_status = 'active'
  );
$$;

revoke all on function public.redeem_invitation(text) from public, anon;
revoke all on function public.is_active_member() from public, anon;
grant execute on function public.redeem_invitation(text) to authenticated;
grant execute on function public.is_active_member() to authenticated;

-- Quota reservations are membership-gated even if called outside the web app.
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
  v_status text;
begin
  if v_user is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_reserved_tokens < 1 or p_reserved_tokens > 20000 then raise exception 'invalid_reservation'; end if;
  if char_length(p_operation) not between 1 and 60 then raise exception 'invalid_operation'; end if;
  if char_length(p_model) not between 1 and 100 then raise exception 'invalid_model'; end if;

  select p.daily_token_limit, p.membership_status into v_limit, v_status
  from public.profiles p where p.id = v_user;
  if v_status is distinct from 'active' then
    raise exception 'active_membership_required' using errcode = '42501';
  end if;
  v_limit := coalesce(v_limit, 20000);

  insert into public.usage_buckets (user_id, usage_day)
  values (v_user, v_day) on conflict (user_id, usage_day) do nothing;

  select b.used_tokens, b.reserved_tokens into v_used, v_reserved
  from public.usage_buckets b
  where b.user_id = v_user and b.usage_day = v_day for update;

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

revoke all on function public.reserve_ai_usage(uuid, integer, text, text)
  from public, anon;
grant execute on function public.reserve_ai_usage(uuid, integer, text, text)
  to authenticated;
