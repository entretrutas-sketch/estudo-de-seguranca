create table if not exists public.employee_login_rate_limits (
  bucket_key text primary key check (bucket_key ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.employee_login_rate_limits enable row level security;
revoke all on public.employee_login_rate_limits from public, anon, authenticated;

create or replace function public.consume_employee_login_attempt(p_bucket_key text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_row public.employee_login_rate_limits%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_bucket_key is null or p_bucket_key !~ '^[a-f0-9]{64}$' then return false; end if;
  insert into public.employee_login_rate_limits (bucket_key, window_started_at, attempts)
  values (p_bucket_key, v_now, 0) on conflict (bucket_key) do nothing;
  select * into v_row from public.employee_login_rate_limits where bucket_key = p_bucket_key for update;
  if v_row.blocked_until is not null and v_row.blocked_until > v_now then return false; end if;
  if v_row.window_started_at < v_now - interval '15 minutes' then
    v_row.window_started_at := v_now;
    v_row.attempts := 0;
    v_row.blocked_until := null;
  end if;
  v_row.attempts := v_row.attempts + 1;
  if v_row.attempts > 8 then v_row.blocked_until := v_now + interval '15 minutes'; end if;
  v_row.updated_at := v_now;
  update public.employee_login_rate_limits
    set window_started_at = v_row.window_started_at, attempts = v_row.attempts,
        blocked_until = v_row.blocked_until, updated_at = v_now
    where bucket_key = p_bucket_key;
  return v_row.attempts <= 8;
end;
$$;
revoke all on function public.consume_employee_login_attempt(text) from public, anon, authenticated;
grant execute on function public.consume_employee_login_attempt(text) to service_role;
