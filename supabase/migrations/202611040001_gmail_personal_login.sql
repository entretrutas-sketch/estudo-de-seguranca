-- Restrict authenticated app accounts to personal Gmail addresses.
-- The application uses Google OAuth; this check also protects direct Auth API calls.
create or replace function public.enforce_verisure_email_domain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or lower(new.email) !~ '^[^@[:space:]]+@gmail[.]com$' then
    raise exception 'Entre com uma conta Google pessoal terminada em @gmail.com.'
      using errcode = '23514';
  end if;

  new.email := lower(new.email);
  return new;
end;
$$;
