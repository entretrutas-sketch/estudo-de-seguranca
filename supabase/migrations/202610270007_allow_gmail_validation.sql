-- Temporarily allow Gmail accounts to validate the Google OAuth flow.
-- Keep the corporate domain available and remove gmail.com after app validation.
create or replace function public.enforce_verisure_email_domain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or lower(new.email) !~ '^[^@[:space:]]+@(verisure[.]com[.]br|gmail[.]com)$' then
    raise exception 'Use uma conta @verisure.com.br ou @gmail.com para validar o aplicativo.'
      using errcode = '23514';
  end if;

  new.email := lower(new.email);
  return new;
end;
$$;
