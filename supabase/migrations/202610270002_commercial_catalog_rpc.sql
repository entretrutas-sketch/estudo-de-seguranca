-- Comercial guardado no servidor. Preços herdados do catálogo legado existente no app;
-- a gestão deve revisá-los e ativar apenas os valores vigentes antes de uso comercial.
alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists avatar_url text not null default '';
alter table public.profiles add column if not exists phone text not null default '';
alter table public.team_chat_messages add column if not exists author_avatar_url text not null default '';
create table if not exists public.team_chat_reads (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now()
);
create table if not exists public.team_chat_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  added_at timestamptz not null default now(),
  added_by uuid references auth.users(id)
);
alter table public.team_chat_members enable row level security;
grant select on public.team_chat_members to authenticated;
drop policy if exists "Users can check their chat membership" on public.team_chat_members;
create policy "Users can check their chat membership" on public.team_chat_members for select to authenticated using (auth.uid() = user_id);
alter table public.team_chat_reads enable row level security;
grant select, insert, update on public.team_chat_reads to authenticated;
drop policy if exists "Users manage own team chat read receipt" on public.team_chat_reads;
create policy "Users manage own team chat read receipt" on public.team_chat_reads for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create table if not exists public.commercial_catalog (
  kit_name text primary key check (kit_name in ('KIT PROTECTION', 'BT4', 'BT6', 'BT8')),
  equipment_amount numeric(12,2) not null check (equipment_amount >= 0),
  monthly_amount numeric(12,2) not null check (monthly_amount >= 0),
  equipment_discount_limit numeric(5,2) not null default 40 check (equipment_discount_limit between 0 and 40),
  monthly_discount_limit numeric(5,2) not null default 10 check (monthly_discount_limit between 0 and 10),
  active boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.commercial_catalog (kit_name, equipment_amount, monthly_amount, active) values
  ('KIT PROTECTION', 2999, 399, false), ('BT4', 2999, 399, false),
  ('BT6', 3999, 469, false), ('BT8', 3999, 469, false)
on conflict (kit_name) do nothing;

create table if not exists public.commercial_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  action text not null,
  study_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists commercial_audit_idempotency_idx on public.commercial_audit_log(actor_id, action, study_id);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  study_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, study_id)
);

alter table public.commercial_catalog enable row level security;
alter table public.commercial_audit_log enable row level security;
alter table public.proposals enable row level security;
grant select on public.commercial_catalog to authenticated;
grant select, insert, update, delete on public.proposals to authenticated;
grant usage, select on sequence public.commercial_audit_log_id_seq to authenticated;
grant insert on public.commercial_audit_log to authenticated;

drop policy if exists "Authenticated can read active catalog" on public.commercial_catalog;
create policy "Authenticated can read active catalog" on public.commercial_catalog
  for select to authenticated using (active);
drop policy if exists "Users can read their proposals" on public.proposals;
create policy "Users can read their proposals" on public.proposals for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can create their proposals" on public.proposals;
drop policy if exists "Users can update their proposals" on public.proposals;
drop policy if exists "Users can delete their proposals" on public.proposals;
drop policy if exists "Users can write their own commercial audit entry" on public.commercial_audit_log;
create policy "Users can write their own commercial audit entry" on public.commercial_audit_log for insert to authenticated with check (auth.uid() = actor_id);
drop policy if exists "Signed-in users can read team chat" on public.team_chat_messages;
drop policy if exists "Users can send chat messages as themselves" on public.team_chat_messages;
drop policy if exists "Users can delete their own chat messages" on public.team_chat_messages;
create policy "Authorized team members read team chat" on public.team_chat_messages for select to authenticated
  using (exists (select 1 from public.team_chat_members m where m.user_id = auth.uid() and m.enabled));
create policy "Authorized team members send as themselves" on public.team_chat_messages for insert to authenticated
  with check (auth.uid() = user_id and exists (select 1 from public.team_chat_members m where m.user_id = auth.uid() and m.enabled));
create policy "Authorized members delete own messages" on public.team_chat_messages for delete to authenticated
  using (auth.uid() = user_id and exists (select 1 from public.team_chat_members m where m.user_id = auth.uid() and m.enabled));

create or replace function public.save_study(
  p_id text,
  p_kit_name text,
  p_equipment_discount numeric,
  p_monthly_discount numeric,
  p_study_data jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  catalog_row public.commercial_catalog%rowtype;
  final_equipment numeric(12,2);
  final_monthly numeric(12,2);
  safe_data jsonb;
  existing_data jsonb;
  saved_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória.' using errcode = '42501'; end if;
  if p_id is null or length(p_id) < 8 or length(p_id) > 80 then raise exception 'Identificador de estudo inválido.'; end if;
  select data, created_at into existing_data, saved_at from public.studies where user_id = auth.uid() and id = p_id;
  if found then
    return jsonb_build_object('id', p_id, 'finalEquipment', (existing_data ->> 'finalEquipment')::numeric, 'finalMonthly', (existing_data ->> 'finalMonthly')::numeric, 'createdAt', saved_at, 'synced', true);
  end if;
  if jsonb_typeof(p_study_data) <> 'object' then raise exception 'Dados do estudo inválidos.'; end if;
  if coalesce(length(p_study_data #>> '{client,name}'), 0) not between 1 and 160 then raise exception 'Nome do cliente obrigatório.'; end if;
  if p_equipment_discount is null or p_monthly_discount is null then raise exception 'Descontos comerciais obrigatórios.'; end if;
  select * into catalog_row from public.commercial_catalog where kit_name = p_kit_name and active = true;
  if not found then raise exception 'Kit sem preço ativo no catálogo. Configure os valores vigentes.'; end if;
  if p_equipment_discount < 0 or p_equipment_discount > catalog_row.equipment_discount_limit
     or p_monthly_discount < 0 or p_monthly_discount > catalog_row.monthly_discount_limit then
    raise exception 'Para condições acima do limite comercial, fale com o gerente da região.' using errcode = '22023';
  end if;
  final_equipment := round(catalog_row.equipment_amount * (1 - p_equipment_discount / 100), 2);
  final_monthly := round(catalog_row.monthly_amount * (1 - p_monthly_discount / 100), 2);
  safe_data := jsonb_set(p_study_data, '{client,name}', to_jsonb(left(regexp_replace(p_study_data #>> '{client,name}', '[[:cntrl:]]', '', 'g'), 160)), true);
  safe_data := jsonb_set(safe_data, '{evaluation,notes}', to_jsonb(left(regexp_replace(coalesce(p_study_data #>> '{evaluation,notes}', ''), '[[:cntrl:]]', ' ', 'g'), 4000)), true);
  safe_data := safe_data || jsonb_build_object('finalEquipment', final_equipment, 'finalMonthly', final_monthly, 'equipmentDiscount', p_equipment_discount, 'monthlyDiscount', p_monthly_discount);
  insert into public.studies(id, user_id, data, created_at) values (p_id, auth.uid(), safe_data, now())
    on conflict (user_id, id) do nothing;
  select data, created_at into existing_data, saved_at from public.studies where user_id = auth.uid() and id = p_id;
  final_equipment := (existing_data ->> 'finalEquipment')::numeric;
  final_monthly := (existing_data ->> 'finalMonthly')::numeric;
  insert into public.commercial_audit_log(actor_id, action, study_id, details)
    values (auth.uid(), 'study_saved', p_id, jsonb_build_object('kit', existing_data ->> 'kit', 'equipmentDiscount', existing_data ->> 'equipmentDiscount', 'monthlyDiscount', existing_data ->> 'monthlyDiscount'))
    on conflict (actor_id, action, study_id) do nothing;
  return jsonb_build_object('id', p_id, 'finalEquipment', final_equipment, 'finalMonthly', final_monthly, 'createdAt', saved_at, 'synced', true);
end;
$$;

create or replace function public.create_proposal(p_study_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare study_row public.studies%rowtype; proposal_row public.proposals%rowtype;
begin
  select * into study_row from public.studies where id = p_study_id and user_id = auth.uid();
  if not found then raise exception 'Estudo não encontrado ou sem permissão.' using errcode = '42501'; end if;
  insert into public.proposals(study_id, user_id, data) values (p_study_id, auth.uid(), study_row.data)
    on conflict (user_id, study_id) do update set data = excluded.data returning * into proposal_row;
  return jsonb_build_object('id', proposal_row.id, 'studyId', proposal_row.study_id, 'createdAt', proposal_row.created_at, 'data', proposal_row.data);
end;
$$;

revoke all on function public.save_study(text, text, numeric, numeric, jsonb) from public, anon;
grant execute on function public.save_study(text, text, numeric, numeric, jsonb) to authenticated;
revoke all on function public.create_proposal(text) from public, anon;
grant execute on function public.create_proposal(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('study-photos', 'study-photos', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
drop policy if exists "Users upload study photos to own folder" on storage.objects;
create policy "Users upload study photos to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'study-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users read own study photos" on storage.objects;
create policy "Users read own study photos" on storage.objects for select to authenticated
  using (bucket_id = 'study-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users delete own study photos" on storage.objects;
create policy "Users delete own study photos" on storage.objects for delete to authenticated
  using (bucket_id = 'study-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
