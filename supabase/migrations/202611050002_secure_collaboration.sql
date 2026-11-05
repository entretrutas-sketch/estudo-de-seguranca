-- One-to-one threads, server-authored message times and private attachments.
create table if not exists public.team_conversations (
  id uuid primary key default gen_random_uuid(),
  conversation_key text not null unique,
  kind text not null default 'direct' check (kind in ('direct', 'group')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_conversation_participants (
  conversation_id uuid not null references public.team_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  muted boolean not null default false,
  primary key (conversation_id, user_id)
);

alter table public.team_conversations enable row level security;
alter table public.team_conversation_participants enable row level security;
grant select on public.team_conversations to authenticated;
grant select on public.team_conversation_participants to authenticated;
revoke update on public.team_conversation_participants from anon, authenticated;
grant update (last_read_at, muted) on public.team_conversation_participants to authenticated;

create policy "Participants read their conversations" on public.team_conversations
  for select to authenticated using (
    (select public.has_app_access()) and exists (
      select 1 from public.team_conversation_participants p
      where p.conversation_id = id and p.user_id = (select auth.uid())
    )
  );
create policy "Participants read own membership" on public.team_conversation_participants
  for select to authenticated using (user_id = (select auth.uid()) and (select public.has_app_access()));
create policy "Participants update own conversation preferences" on public.team_conversation_participants
  for update to authenticated using (user_id = (select auth.uid()) and (select public.has_app_access()))
  with check (user_id = (select auth.uid()) and (select public.has_app_access()));

create or replace function public.start_direct_conversation(p_other_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_key text;
  v_conversation_id uuid;
begin
  if v_user_id is null or not public.has_app_access() then
    raise exception 'Acesso não autorizado.' using errcode = '42501';
  end if;
  if p_other_user_id is null or p_other_user_id = v_user_id
    or not public.is_approved_profile(p_other_user_id)
    or not exists (select 1 from public.specialist_directory d where d.user_id = p_other_user_id and d.listed) then
    raise exception 'Especialista indisponível para conversa.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.team_chat_members m where m.user_id = v_user_id and m.enabled)
    or not exists (select 1 from public.team_chat_members m where m.user_id = p_other_user_id and m.enabled) then
    raise exception 'A conversa exige que os dois especialistas estejam habilitados para colaboração.' using errcode = '42501';
  end if;
  v_key := least(v_user_id::text, p_other_user_id::text) || ':' || greatest(v_user_id::text, p_other_user_id::text);
  insert into public.team_conversations (conversation_key, created_by)
  values (v_key, v_user_id)
  on conflict (conversation_key) do update set updated_at = now()
  returning id into v_conversation_id;
  insert into public.team_conversation_participants (conversation_id, user_id)
  values (v_conversation_id, v_user_id), (v_conversation_id, p_other_user_id)
  on conflict do nothing;
  return v_conversation_id;
end;
$$;
revoke all on function public.start_direct_conversation(uuid) from public, anon;
grant execute on function public.start_direct_conversation(uuid) to authenticated;

create or replace function public.list_direct_conversations()
returns table (
  conversation_id uuid,
  specialist_id uuid,
  display_name text,
  avatar_path text,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint,
  muted boolean
)
language plpgsql stable security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not public.has_app_access() then raise exception 'Acesso não autorizado.' using errcode = '42501'; end if;
  return query
  select c.id, d.user_id, d.display_name, d.avatar_path,
    case when recent.deleted_at is not null then 'Mensagem removida' else left(coalesce(recent.body, ''), 180) end,
    recent.created_at,
    (select count(*) from public.team_chat_messages m
      left join public.team_chat_message_receipts r on r.message_id = m.id and r.user_id = v_user_id
      where m.conversation_id = c.id and m.user_id <> v_user_id and r.read_at is null),
    mine.muted
  from public.team_conversation_participants mine
  join public.team_conversations c on c.id = mine.conversation_id and c.kind = 'direct'
  join public.team_conversation_participants other on other.conversation_id = c.id and other.user_id <> v_user_id
  join public.specialist_directory d on d.user_id = other.user_id and d.listed
  left join lateral (select m.body, m.deleted_at, m.created_at from public.team_chat_messages m where m.conversation_id = c.id order by m.created_at desc limit 1) recent on true
  where mine.user_id = v_user_id
  order by coalesce(recent.created_at, c.created_at) desc;
end;
$$;
revoke all on function public.list_direct_conversations() from public, anon;
grant execute on function public.list_direct_conversations() to authenticated;

create or replace function public.touch_direct_conversation_after_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.conversation_id is not null then
    update public.team_conversations set updated_at = now() where id = new.conversation_id;
  end if;
  return new;
end;
$$;
drop trigger if exists touch_direct_conversation_on_message on public.team_chat_messages;
create trigger touch_direct_conversation_on_message after insert on public.team_chat_messages
  for each row execute function public.touch_direct_conversation_after_message();

alter table public.team_chat_messages add column if not exists conversation_id uuid references public.team_conversations(id) on delete cascade;
alter table public.team_chat_messages add column if not exists edited_at timestamptz;
alter table public.team_chat_messages add column if not exists deleted_at timestamptz;
alter table public.team_chat_messages add column if not exists attachment_path text;
alter table public.team_chat_messages add column if not exists attachment_mime text;
alter table public.team_chat_messages add column if not exists attachment_size bigint;
create index if not exists team_chat_messages_conversation_created_idx on public.team_chat_messages (conversation_id, created_at desc);

-- Remove legacy team-wide policies: permissive RLS policies are OR-combined,
-- so leaving even one in place would expose direct messages to the whole team.
drop policy if exists "Approved team members read team chat" on public.team_chat_messages;
drop policy if exists "Approved team members send chat messages" on public.team_chat_messages;
drop policy if exists "Approved team members delete own messages" on public.team_chat_messages;
drop policy if exists "Authorized team members read team chat" on public.team_chat_messages;
drop policy if exists "Authorized team members send as themselves" on public.team_chat_messages;
drop policy if exists "Authorized members delete own messages" on public.team_chat_messages;
drop policy if exists "Signed-in users can read team chat" on public.team_chat_messages;
drop policy if exists "Users can send chat messages as themselves" on public.team_chat_messages;
drop policy if exists "Users can delete their own chat messages" on public.team_chat_messages;
drop policy if exists "Authorized users read permitted messages" on public.team_chat_messages;
drop policy if exists "Authorized users send permitted messages" on public.team_chat_messages;
drop policy if exists "Authors can edit or soft-delete permitted messages" on public.team_chat_messages;
create policy "Authorized users read permitted messages" on public.team_chat_messages for select to authenticated
  using ((select public.has_app_access()) and (
    (conversation_id is null and exists (select 1 from public.team_chat_members m where m.user_id = (select auth.uid()) and m.enabled))
    or exists (select 1 from public.team_conversation_participants p where p.conversation_id = team_chat_messages.conversation_id and p.user_id = (select auth.uid()))
  ));
create policy "Authorized users send permitted messages" on public.team_chat_messages for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.has_app_access()) and char_length(body) between 1 and 4000 and (
    (conversation_id is null and exists (select 1 from public.team_chat_members m where m.user_id = (select auth.uid()) and m.enabled))
    or exists (select 1 from public.team_conversation_participants p where p.conversation_id = team_chat_messages.conversation_id and p.user_id = (select auth.uid()))
  ));
create policy "Authors can edit or soft-delete permitted messages" on public.team_chat_messages for update to authenticated
  using (user_id = (select auth.uid()) and (select public.has_app_access()) and created_at > now() - interval '15 minutes' and (
    (conversation_id is null and exists (select 1 from public.team_chat_members m where m.user_id = (select auth.uid()) and m.enabled))
    or exists (select 1 from public.team_conversation_participants p where p.conversation_id = team_chat_messages.conversation_id and p.user_id = (select auth.uid()))
  ))
  with check (user_id = (select auth.uid()) and (select public.has_app_access()) and created_at > now() - interval '15 minutes' and (
    (conversation_id is null and exists (select 1 from public.team_chat_members m where m.user_id = (select auth.uid()) and m.enabled))
    or exists (select 1 from public.team_conversation_participants p where p.conversation_id = team_chat_messages.conversation_id and p.user_id = (select auth.uid()))
  ));
revoke update on public.team_chat_messages from anon, authenticated;
grant update (body, edited_at, deleted_at) on public.team_chat_messages to authenticated;

create table if not exists public.team_chat_message_receipts (
  message_id uuid not null references public.team_chat_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, user_id)
);
alter table public.team_chat_message_receipts enable row level security;
grant select, insert, update on public.team_chat_message_receipts to authenticated;
create policy "Conversation participants read message receipts" on public.team_chat_message_receipts for select to authenticated
  using ((select public.has_app_access()) and exists (
    select 1 from public.team_chat_messages m
    where m.id = message_id and (
      (m.conversation_id is not null and exists (select 1 from public.team_conversation_participants p where p.conversation_id = m.conversation_id and p.user_id = (select auth.uid())))
      or (m.conversation_id is null and exists (select 1 from public.team_chat_members t where t.user_id = (select auth.uid()) and t.enabled))
    )
  ));
create policy "Users update their own message receipts" on public.team_chat_message_receipts for all to authenticated
  using (user_id = (select auth.uid()) and (select public.has_app_access()))
  with check (user_id = (select auth.uid()) and (select public.has_app_access()) and exists (
    select 1 from public.team_chat_messages m where m.id = message_id and m.user_id <> (select auth.uid()) and (
      (m.conversation_id is not null and exists (select 1 from public.team_conversation_participants p where p.conversation_id = m.conversation_id and p.user_id = (select auth.uid())))
      or (m.conversation_id is null and exists (select 1 from public.team_chat_members t where t.user_id = (select auth.uid()) and t.enabled))
    )
  ));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('team-chat-attachments', 'team-chat-attachments', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = excluded.allowed_mime_types;
create policy "Participants read private chat attachments" on storage.objects for select to authenticated
  using (bucket_id = 'team-chat-attachments' and (select public.has_app_access())
    and exists (select 1 from public.team_conversation_participants p where p.conversation_id::text = (storage.foldername(name))[1] and p.user_id = (select auth.uid())));
create policy "Participants upload private chat attachments" on storage.objects for insert to authenticated
  with check (bucket_id = 'team-chat-attachments' and (select public.has_app_access())
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (select 1 from public.team_conversation_participants p where p.conversation_id::text = (storage.foldername(name))[1] and p.user_id = (select auth.uid())));
create policy "Authors delete private chat attachments" on storage.objects for delete to authenticated
  using (bucket_id = 'team-chat-attachments' and (select public.has_app_access()) and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (select 1 from public.team_conversation_participants p where p.conversation_id::text = (storage.foldername(name))[1] and p.user_id = (select auth.uid())));

-- Presence and typing events use private channels scoped to the same participant list.
create policy "Conversation members receive realtime events" on realtime.messages for select to authenticated
  using ((select public.has_app_access()) and extension in ('broadcast', 'presence') and exists (
    select 1 from public.team_conversation_participants p
    where p.conversation_id::text = substring(realtime.topic() from 8) and p.user_id = (select auth.uid())
  ));
create policy "Conversation members publish realtime events" on realtime.messages for insert to authenticated
  with check ((select public.has_app_access()) and extension in ('broadcast', 'presence') and exists (
    select 1 from public.team_conversation_participants p
    where p.conversation_id::text = substring(realtime.topic() from 8) and p.user_id = (select auth.uid())
  ));

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_conversations') then
    alter publication supabase_realtime add table public.team_conversations;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_conversation_participants') then
    alter publication supabase_realtime add table public.team_conversation_participants;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_chat_message_receipts') then
    alter publication supabase_realtime add table public.team_chat_message_receipts;
  end if;
end $$;
