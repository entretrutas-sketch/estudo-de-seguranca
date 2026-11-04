-- Employee registration, administrator approval, and server-side access gating.
alter table public.profiles
  add column if not exists employee_number text,
  add column if not exists access_status text not null default 'pending',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists rejection_reason text;

alter table public.profiles drop constraint if exists profiles_access_status_check;
alter table public.profiles add constraint profiles_access_status_check
  check (access_status in ('pending', 'approved', 'rejected'));
create unique index if not exists profiles_employee_number_unique
  on public.profiles (upper(employee_number)) where employee_number is not null and employee_number <> '';

-- Auth identities for this app must use a Verisure corporate mailbox.
create or replace function public.enforce_verisure_email_domain()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null or lower(new.email) !~ '^[^@[:space:]]+@verisure[.]com[.]br$' then
    raise exception 'Use seu e-mail corporativo terminado em @verisure.com.br.' using errcode = '23514';
  end if;
  new.email := lower(new.email);
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, email, employee_number, access_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), ''),
    lower(coalesce(new.email, '')),
    upper(coalesce(new.raw_user_meta_data ->> 'employee_number', '')),
    'pending'
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    email = excluded.email,
    employee_number = coalesce(nullif(excluded.employee_number, ''), public.profiles.employee_number),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of raw_user_meta_data, email on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_master_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role' in ('master_admin', 'admin'), false)
$$;

create or replace function public.has_app_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role' in ('master_admin', 'admin', 'commercial_admin'), false)
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.access_status = 'approved'
    )
  )
$$;

revoke all on function public.is_master_admin() from public, anon;
revoke all on function public.has_app_access() from public, anon;
grant execute on function public.is_master_admin() to authenticated;
grant execute on function public.has_app_access() to authenticated;

create or replace function public.guard_profile_access_fields()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or public.is_master_admin() then return new; end if;
  if new.employee_number is distinct from old.employee_number
    or new.email is distinct from old.email
    or new.access_status is distinct from old.access_status
    or new.reviewed_at is distinct from old.reviewed_at
    or new.reviewed_by is distinct from old.reviewed_by
    or new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'Dados de autorização só podem ser alterados pela gestão.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_access_fields on public.profiles;
create trigger protect_profile_access_fields before update on public.profiles
for each row execute function public.guard_profile_access_fields();

-- Security-definer proposal RPCs must also enforce approval; RLS alone does not cover them.
create or replace function public.require_approved_app_access()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is not null and not public.has_app_access() then
    raise exception 'Acesso ainda não autorizado.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists require_approved_study_access on public.studies;
create trigger require_approved_study_access before insert or update or delete on public.studies
for each row execute function public.require_approved_app_access();
drop trigger if exists require_approved_proposal_access on public.proposals;
create trigger require_approved_proposal_access before insert or update or delete on public.proposals
for each row execute function public.require_approved_app_access();

create or replace function public.review_access_request(p_user_id uuid, p_decision text, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_master_admin() then
    raise exception 'Somente a conta master pode aprovar cadastros.' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decisão inválida.' using errcode = '22023';
  end if;
  update public.profiles
  set access_status = p_decision,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      rejection_reason = case when p_decision = 'rejected' then left(coalesce(p_reason, 'Cadastro não aprovado.'), 300) else null end,
      updated_at = now()
  where id = p_user_id and access_status = 'pending';
  if not found then raise exception 'Solicitação não encontrada ou já revisada.' using errcode = 'P0002'; end if;
end;
$$;

revoke all on function public.review_access_request(uuid, text, text) from public, anon;
grant execute on function public.review_access_request(uuid, text, text) to authenticated;

-- Access requests can be read by their owner while pending; the master sees the queue.
drop policy if exists "Users can create their own profile" on public.profiles;
drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Master admins can read access requests" on public.profiles;
create policy "Users can read their own profile" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "Master admins can read access requests" on public.profiles for select to authenticated
  using ((select public.is_master_admin()));
create policy "Approved users can update their profile" on public.profiles for update to authenticated
  using (id = (select auth.uid()) and (select public.has_app_access()))
  with check (id = (select auth.uid()) and (select public.has_app_access()));
revoke insert on public.profiles from anon, authenticated;

-- Gate all app data through the same approval check, including older permissive policies.
drop policy if exists "Users can read their own studies" on public.studies;
drop policy if exists "Users can create their own studies" on public.studies;
drop policy if exists "Users can update their own studies" on public.studies;
drop policy if exists "Users can delete their own studies" on public.studies;
create policy "Approved users can read own studies" on public.studies for select to authenticated
  using (user_id = (select auth.uid()) and (select public.has_app_access()));
create policy "Approved users can create own studies" on public.studies for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.has_app_access()));
create policy "Approved users can update own studies" on public.studies for update to authenticated
  using (user_id = (select auth.uid()) and (select public.has_app_access()))
  with check (user_id = (select auth.uid()) and (select public.has_app_access()));
create policy "Approved users can delete own studies" on public.studies for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.has_app_access()));

drop policy if exists "Signed-in users can read team chat" on public.team_chat_messages;
drop policy if exists "Users can send chat messages as themselves" on public.team_chat_messages;
drop policy if exists "Users can delete their own chat messages" on public.team_chat_messages;
drop policy if exists "Authorized team members read team chat" on public.team_chat_messages;
drop policy if exists "Authorized team members send as themselves" on public.team_chat_messages;
drop policy if exists "Authorized members delete own messages" on public.team_chat_messages;
create policy "Approved team members read team chat" on public.team_chat_messages for select to authenticated
  using ((select public.has_app_access()) and exists (select 1 from public.team_chat_members m where m.user_id = auth.uid() and m.enabled));
create policy "Approved team members send chat messages" on public.team_chat_messages for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.has_app_access()) and exists (select 1 from public.team_chat_members m where m.user_id = auth.uid() and m.enabled));
create policy "Approved team members delete own messages" on public.team_chat_messages for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.has_app_access()) and exists (select 1 from public.team_chat_members m where m.user_id = auth.uid() and m.enabled));

drop policy if exists "Users can check their chat membership" on public.team_chat_members;
create policy "Approved users can check their chat membership" on public.team_chat_members for select to authenticated
  using (user_id = (select auth.uid()) and (select public.has_app_access()));
drop policy if exists "Users manage own team chat read receipt" on public.team_chat_reads;
create policy "Approved users manage own chat read receipt" on public.team_chat_reads for all to authenticated
  using (user_id = (select auth.uid()) and (select public.has_app_access()))
  with check (user_id = (select auth.uid()) and (select public.has_app_access()));

drop policy if exists "Authenticated can read active catalog" on public.commercial_catalog;
drop policy if exists "Commercial admins read full catalog" on public.commercial_catalog;
drop policy if exists "Commercial admins maintain catalog" on public.commercial_catalog;
create policy "Approved users read active catalog" on public.commercial_catalog for select to authenticated
  using (active and (select public.has_app_access()));
create policy "Approved commercial admins read full catalog" on public.commercial_catalog for select to authenticated
  using ((select public.has_app_access()) and (select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'master_admin', 'commercial_admin'));
create policy "Approved commercial admins maintain catalog" on public.commercial_catalog for update to authenticated
  using ((select public.has_app_access()) and (select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'master_admin', 'commercial_admin'))
  with check ((select public.has_app_access()) and (select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'master_admin', 'commercial_admin'));

drop policy if exists "Users can read their proposals" on public.proposals;
create policy "Approved users can read their proposals" on public.proposals for select to authenticated
  using (user_id = (select auth.uid()) and (select public.has_app_access()));
drop policy if exists "Users can write their own commercial audit entry" on public.commercial_audit_log;
create policy "Approved users can write their own commercial audit entry" on public.commercial_audit_log for insert to authenticated
  with check (actor_id = (select auth.uid()) and (select public.has_app_access()));

drop policy if exists "Authenticated read commercial settings" on public.commercial_settings;
drop policy if exists "Commercial admins maintain settings" on public.commercial_settings;
create policy "Approved users read commercial settings" on public.commercial_settings for select to authenticated
  using ((select public.has_app_access()));
create policy "Approved commercial admins maintain settings" on public.commercial_settings for all to authenticated
  using ((select public.has_app_access()) and (select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'master_admin', 'commercial_admin'))
  with check ((select public.has_app_access()) and (select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'master_admin', 'commercial_admin'));

drop policy if exists "Users upload study photos to own folder" on storage.objects;
create policy "Approved users upload study photos to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'study-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.has_app_access()));
drop policy if exists "Users read own study photos" on storage.objects;
create policy "Approved users read own study photos" on storage.objects for select to authenticated
  using (bucket_id = 'study-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.has_app_access()));
drop policy if exists "Users delete own study photos" on storage.objects;
create policy "Approved users delete own study photos" on storage.objects for delete to authenticated
  using (bucket_id = 'study-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.has_app_access()));
drop policy if exists "Users can read their own profile photo" on storage.objects;
create policy "Approved users read their own profile photo" on storage.objects for select to authenticated
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.has_app_access()));
drop policy if exists "Users can upload their own profile photo" on storage.objects;
create policy "Approved users upload their own profile photo" on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.has_app_access()));
drop policy if exists "Users can update their own profile photo" on storage.objects;
create policy "Approved users update their own profile photo" on storage.objects for update to authenticated
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.has_app_access()))
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.has_app_access()));
