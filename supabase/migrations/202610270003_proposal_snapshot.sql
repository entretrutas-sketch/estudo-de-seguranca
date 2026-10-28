-- Persists the catalog basis and prices used for every generated proposal.
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
    return jsonb_build_object('id', p_id, 'finalEquipment', (existing_data ->> 'finalEquipment')::numeric, 'finalMonthly', (existing_data ->> 'finalMonthly')::numeric, 'equipmentOriginal', (existing_data ->> 'equipmentOriginal')::numeric, 'monthlyOriginal', (existing_data ->> 'monthlyOriginal')::numeric, 'createdAt', saved_at, 'synced', true);
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
  safe_data := safe_data || jsonb_build_object('finalEquipment', final_equipment, 'finalMonthly', final_monthly, 'equipmentOriginal', catalog_row.equipment_amount, 'monthlyOriginal', catalog_row.monthly_amount, 'equipmentDiscount', p_equipment_discount, 'monthlyDiscount', p_monthly_discount);
  insert into public.studies(id, user_id, data, created_at) values (p_id, auth.uid(), safe_data, now())
    on conflict (user_id, id) do nothing;
  select data, created_at into existing_data, saved_at from public.studies where user_id = auth.uid() and id = p_id;
  final_equipment := (existing_data ->> 'finalEquipment')::numeric;
  final_monthly := (existing_data ->> 'finalMonthly')::numeric;
  insert into public.commercial_audit_log(actor_id, action, study_id, details)
    values (auth.uid(), 'study_saved', p_id, jsonb_build_object('kit', existing_data ->> 'kit', 'equipmentDiscount', existing_data ->> 'equipmentDiscount', 'monthlyDiscount', existing_data ->> 'monthlyDiscount'))
    on conflict (actor_id, action, study_id) do nothing;
  return jsonb_build_object('id', p_id, 'finalEquipment', final_equipment, 'finalMonthly', final_monthly, 'equipmentOriginal', (existing_data ->> 'equipmentOriginal')::numeric, 'monthlyOriginal', (existing_data ->> 'monthlyOriginal')::numeric, 'createdAt', saved_at, 'synced', true);
end;
$$;

create or replace function public.create_proposal(p_study_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  study_row public.studies%rowtype;
  catalog_row public.commercial_catalog%rowtype;
  proposal_row public.proposals%rowtype;
  proposal_data jsonb;
  issued_at timestamptz := now();
  equipment_discount numeric(5,2);
  monthly_discount numeric(5,2);
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória.' using errcode = '42501'; end if;
  select * into study_row from public.studies where id = p_study_id and user_id = auth.uid() for update;
  if not found then raise exception 'Estudo não encontrado ou sem permissão.' using errcode = '42501'; end if;
  equipment_discount := coalesce((study_row.data ->> 'equipmentDiscount')::numeric, 0);
  monthly_discount := coalesce((study_row.data ->> 'monthlyDiscount')::numeric, 0);
  select * into catalog_row from public.commercial_catalog where kit_name = study_row.data ->> 'kit' and active = true;
  if not found then raise exception 'Kit sem preço ativo no catálogo. A proposta não pode ser emitida.'; end if;
  if equipment_discount < 0 or equipment_discount > catalog_row.equipment_discount_limit
     or monthly_discount < 0 or monthly_discount > catalog_row.monthly_discount_limit then
    raise exception 'Esta condição excede os limites comerciais configurados e depende de validação e aprovação do gerente da região.' using errcode = '22023';
  end if;
  proposal_data := study_row.data || jsonb_build_object(
    'equipmentOriginal', catalog_row.equipment_amount,
    'monthlyOriginal', catalog_row.monthly_amount,
    'finalEquipment', round(catalog_row.equipment_amount * (1 - equipment_discount / 100), 2),
    'finalMonthly', round(catalog_row.monthly_amount * (1 - monthly_discount / 100), 2),
    'issuedAt', issued_at,
    'proposalVersion', to_char(issued_at at time zone 'UTC', 'YYYYMMDD-HH24MISS')
  );
  insert into public.proposals(study_id, user_id, data, created_at)
    values (p_study_id, auth.uid(), proposal_data, issued_at)
    on conflict (user_id, study_id) do update set data = excluded.data, created_at = excluded.created_at
    returning * into proposal_row;
  insert into public.commercial_audit_log(actor_id, action, study_id, details)
    values (auth.uid(), 'proposal_generated', p_study_id, jsonb_build_object('proposalVersion', proposal_data ->> 'proposalVersion', 'kit', proposal_data ->> 'kit'))
    on conflict (actor_id, action, study_id) do nothing;
  return jsonb_build_object('id', proposal_row.id, 'studyId', proposal_row.study_id, 'createdAt', proposal_row.created_at, 'data', proposal_row.data);
end;
$$;

revoke all on function public.save_study(text, text, numeric, numeric, jsonb) from public, anon;
grant execute on function public.save_study(text, text, numeric, numeric, jsonb) to authenticated;
revoke all on function public.create_proposal(text) from public, anon;
grant execute on function public.create_proposal(text) to authenticated;
