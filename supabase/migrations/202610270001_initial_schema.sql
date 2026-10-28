-- User profiles, private studies, and team-wide authenticated chat.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studies (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists studies_user_created_at_idx on public.studies (user_id, created_at desc);

create table if not exists public.team_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists team_chat_messages_created_at_idx on public.team_chat_messages (created_at desc);

alter table public.profiles enable row level security;
alter table public.studies enable row level security;
alter table public.team_chat_messages enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.studies to authenticated;
grant select, insert, delete on public.team_chat_messages to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "Users can read their own studies" on public.studies;
create policy "Users can read their own studies" on public.studies for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can create their own studies" on public.studies;
create policy "Users can create their own studies" on public.studies for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their own studies" on public.studies;
create policy "Users can update their own studies" on public.studies for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their own studies" on public.studies;
create policy "Users can delete their own studies" on public.studies for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Signed-in users can read team chat" on public.team_chat_messages;
create policy "Signed-in users can read team chat" on public.team_chat_messages for select to authenticated using ((select auth.uid()) is not null);
drop policy if exists "Users can send chat messages as themselves" on public.team_chat_messages;
create policy "Users can send chat messages as themselves" on public.team_chat_messages for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their own chat messages" on public.team_chat_messages;
create policy "Users can delete their own chat messages" on public.team_chat_messages for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'user_name', split_part(new.email, '@', 1), ''))
  on conflict (id) do update set display_name = excluded.display_name, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of raw_user_meta_data on auth.users
for each row execute procedure public.handle_new_user();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_chat_messages'
  ) then
    alter publication supabase_realtime add table public.team_chat_messages;
  end if;
end;
$$;
