-- Directory data is deliberately stored separately from profiles so the public
-- directory never exposes employee email, matrícula, phone, or auth metadata.
create table if not exists public.specialist_directory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_path text not null default '',
  region text not null default '',
  specialties text[] not null default '{}',
  team_name text not null default '',
  availability text not null default 'unknown' check (availability in ('unknown', 'available', 'busy', 'offline')),
  listed boolean not null default true,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.specialist_directory enable row level security;

create or replace function public.is_approved_profile(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.access_status = 'approved'
  )
$$;
revoke all on function public.is_approved_profile(uuid) from public, anon;
grant execute on function public.is_approved_profile(uuid) to authenticated;

drop policy if exists "Approved users can read specialist directory" on public.specialist_directory;
create policy "Approved users can read specialist directory"
  on public.specialist_directory for select to authenticated
  using (listed and (select public.has_app_access()) and (select public.is_approved_profile(user_id)));

drop policy if exists "Specialists can update their directory details" on public.specialist_directory;
create policy "Specialists can update their directory details"
  on public.specialist_directory for update to authenticated
  using (user_id = (select auth.uid()) and (select public.has_app_access()))
  with check (user_id = (select auth.uid()) and (select public.has_app_access()));
revoke insert, delete, update on public.specialist_directory from anon, authenticated;
grant update (region, specialties, team_name, availability, listed) on public.specialist_directory to authenticated;

create or replace function public.sync_specialist_directory_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.access_status = 'approved' then
    insert into public.specialist_directory (user_id, display_name, avatar_path)
    values (new.id, coalesce(new.display_name, ''), coalesce(new.avatar_url, ''))
    on conflict (user_id) do update
      set display_name = coalesce(nullif(excluded.display_name, ''), public.specialist_directory.display_name),
          avatar_path = excluded.avatar_path,
          updated_at = now();
    insert into public.team_chat_members (user_id, enabled, added_by)
    values (new.id, true, coalesce(auth.uid(), new.id))
    on conflict (user_id) do update set enabled = true;
  else
    delete from public.specialist_directory where user_id = new.id;
    update public.team_chat_members set enabled = false where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_specialist_directory_after_profile on public.profiles;
create trigger sync_specialist_directory_after_profile
  after insert or update of display_name, avatar_url, access_status on public.profiles
  for each row execute function public.sync_specialist_directory_profile();

insert into public.specialist_directory (user_id, display_name, avatar_path)
select id, coalesce(display_name, ''), coalesce(avatar_url, '') from public.profiles where access_status = 'approved'
on conflict (user_id) do update
  set display_name = coalesce(nullif(excluded.display_name, ''), public.specialist_directory.display_name), avatar_path = excluded.avatar_path, updated_at = now();

insert into public.team_chat_members (user_id, enabled, added_by)
select id, true, id from public.profiles where access_status = 'approved'
on conflict (user_id) do update set enabled = true;

create index if not exists specialist_directory_region_idx on public.specialist_directory (lower(region));
create index if not exists specialist_directory_team_idx on public.specialist_directory (lower(team_name));
create index if not exists specialist_directory_availability_idx on public.specialist_directory (availability);

drop policy if exists "Approved specialists read listed profile photos" on storage.objects;
create policy "Approved specialists read listed profile photos" on storage.objects for select to authenticated
  using (bucket_id = 'profile-avatars' and (select public.has_app_access()) and exists (
    select 1 from public.specialist_directory d where d.user_id::text = (storage.foldername(name))[1] and d.listed
      and d.avatar_path = name and (select public.is_approved_profile(d.user_id))
  ));
