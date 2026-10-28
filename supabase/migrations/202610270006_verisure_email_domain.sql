-- Enforce the corporate email domain at the Auth database boundary, including
-- OTP sign-ups and Microsoft OAuth account creation.
create or replace function public.enforce_verisure_email_domain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or lower(new.email) !~ '^[^@[:space:]]+@verisure[.]com[.]br$' then
    raise exception 'Use seu e-mail corporativo no formato nome@verisure.com.br.'
      using errcode = '23514';
  end if;

  new.email := lower(new.email);
  return new;
end;
$$;

revoke all on function public.enforce_verisure_email_domain() from public, anon, authenticated;

drop trigger if exists enforce_verisure_email_domain on auth.users;
create trigger enforce_verisure_email_domain
before insert or update of email on auth.users
for each row execute function public.enforce_verisure_email_domain();
