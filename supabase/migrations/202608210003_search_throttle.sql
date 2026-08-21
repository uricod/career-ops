alter table public.profiles
  add column if not exists last_search_at timestamptz,
  add column if not exists search_run_count bigint not null default 0
    check (search_run_count >= 0);

create or replace function public.claim_job_search(
  p_min_interval_seconds integer default 15
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_claimed boolean := false;
  v_interval_seconds integer := greatest(10, least(300, p_min_interval_seconds));
begin
  if v_user_id is null or not public.is_active_member() then
    return false;
  end if;

  update public.profiles
     set last_search_at = clock_timestamp(),
         search_run_count = search_run_count + 1
   where id = v_user_id
     and (
       last_search_at is null
       or last_search_at <= clock_timestamp() - make_interval(secs => v_interval_seconds)
     )
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

revoke all on function public.claim_job_search(integer)
  from public, anon, authenticated;
grant execute on function public.claim_job_search(integer) to authenticated;

comment on function public.claim_job_search(integer) is
  'Rate-limits hosted board sweeps and stores only aggregate run timing/count, never search text or results.';
