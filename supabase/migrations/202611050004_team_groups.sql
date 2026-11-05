alter table public.team_conversations add column if not exists title text;

create or replace function public.create_team_group(p_title text, p_member_ids uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_group_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_members uuid[];
begin
  if v_user_id is null or not public.has_app_access() then
    raise exception 'Acesso não autorizado.' using errcode = '42501';
  end if;
  if char_length(v_title) not between 2 and 80 then
    raise exception 'O nome do grupo deve ter entre 2 e 80 caracteres.' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct member_id), '{}'::uuid[]) into v_members
    from unnest(coalesce(p_member_ids, '{}'::uuid[])) member_id
    where member_id <> v_user_id;
  if cardinality(v_members) < 2 or cardinality(v_members) > 30 then
    raise exception 'Selecione de 2 a 30 especialistas além de você.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.team_chat_members m where m.user_id = v_user_id and m.enabled) then
    raise exception 'O chat da equipe não está habilitado para sua conta.' using errcode = '42501';
  end if;
  if exists (
    select 1 from unnest(v_members) selected(user_id)
    where not public.is_approved_profile(selected.user_id)
      or not exists (select 1 from public.specialist_directory d where d.user_id = selected.user_id and d.listed)
      or not exists (select 1 from public.team_chat_members m where m.user_id = selected.user_id and m.enabled)
  ) then
    raise exception 'Todos os participantes precisam estar autorizados e listados.' using errcode = '42501';
  end if;
  insert into public.team_conversations (conversation_key, kind, title, created_by)
  values ('group:' || gen_random_uuid()::text, 'group', v_title, v_user_id)
  returning id into v_group_id;
  insert into public.team_conversation_participants (conversation_id, user_id)
  select v_group_id, participant.user_id from (
    select v_user_id as user_id union select unnest(v_members)
  ) participant;
  return v_group_id;
end;
$$;
revoke all on function public.create_team_group(text, uuid[]) from public, anon;
grant execute on function public.create_team_group(text, uuid[]) to authenticated;

create or replace function public.list_team_groups()
returns table (
  conversation_id uuid,
  title text,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint,
  muted boolean
)
language plpgsql stable security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not public.has_app_access() then
    raise exception 'Acesso não autorizado.' using errcode = '42501';
  end if;
  return query
  select c.id, c.title,
    case when recent.deleted_at is not null then 'Mensagem removida' else left(coalesce(recent.body, ''), 180) end,
    recent.created_at,
    (select count(*) from public.team_chat_messages m
      left join public.team_chat_message_receipts r on r.message_id = m.id and r.user_id = v_user_id
      where m.conversation_id = c.id and m.user_id <> v_user_id and r.read_at is null),
    mine.muted
  from public.team_conversation_participants mine
  join public.team_conversations c on c.id = mine.conversation_id and c.kind = 'group'
  left join lateral (select m.body, m.deleted_at, m.created_at from public.team_chat_messages m where m.conversation_id = c.id order by m.created_at desc limit 1) recent on true
  where mine.user_id = v_user_id
  order by coalesce(recent.created_at, c.created_at) desc;
end;
$$;
revoke all on function public.list_team_groups() from public, anon;
grant execute on function public.list_team_groups() to authenticated;
