-- Initial commercial references are centralized in the database and can be
-- maintained by commercial administrators without changing the mobile bundle.
alter table public.commercial_catalog
  add column if not exists kit_composition jsonb not null default '[]'::jsonb;
alter table public.commercial_catalog drop constraint if exists commercial_catalog_equipment_discount_limit_check;
alter table public.commercial_catalog drop constraint if exists commercial_catalog_monthly_discount_limit_check;
alter table public.commercial_catalog add constraint commercial_catalog_equipment_discount_limit_check check (equipment_discount_limit between 0 and 100);
alter table public.commercial_catalog add constraint commercial_catalog_monthly_discount_limit_check check (monthly_discount_limit between 0 and 100);
alter table public.commercial_catalog drop constraint if exists commercial_catalog_kit_composition_array_check;
alter table public.commercial_catalog add constraint commercial_catalog_kit_composition_array_check check (jsonb_typeof(kit_composition) = 'array');

update public.commercial_catalog
set equipment_amount = case kit_name
      when 'KIT PROTECTION' then 2999.00 when 'BT4' then 2999.00
      when 'BT6' then 3999.00 when 'BT8' then 3999.00 end,
    monthly_amount = case kit_name
      when 'KIT PROTECTION' then 399.00 when 'BT4' then 399.00
      when 'BT6' then 469.00 when 'BT8' then 469.00 end,
    equipment_discount_limit = 40,
    monthly_discount_limit = 10,
    active = true,
    updated_at = now();

update public.commercial_catalog
set kit_composition = jsonb_build_array(
        jsonb_build_object('name','Unidade Central','quantity',1,'description','Comunicação e coordenação da solução de proteção.','kind','Físico','place','Área protegida e discreta','image','07-unidade-central.webp'),
        jsonb_build_object('name','Videodetector Interno','quantity',1,'description','Detecção de movimento com verificação visual em ambiente interno.','kind','Físico','place','Sala, hall ou circulação','image','02-videodetector-interno.webp'),
        jsonb_build_object('name','Chaves Inteligentes','quantity',3,'description','Identificação e operação por usuários autorizados, conforme configuração.','kind','Físico','place','Com usuários autorizados','image','08-chaves-inteligentes.webp'),
        jsonb_build_object('name','Painel de Controle','quantity',1,'description','Operação local das funções disponíveis do sistema.','kind','Físico','place','Próximo à entrada, em área interna','image','06-painel-controle.webp'),
        jsonb_build_object('name','Placas de Inibição','quantity',2,'description','Sinalização visual do sistema de proteção.','kind','Sinalização','place','Fachada, portão ou muro','image','04-placa-inibicao.webp'),
        jsonb_build_object('name','MY VERISURE','quantity',1,'description','Aplicativo mobile para até cinco pessoas autorizadas, conforme catálogo.','kind','Aplicativo','place','Celulares dos usuários autorizados','image','11-my-verisure.webp')),
    updated_at = now()
where kit_name = 'KIT PROTECTION';

update public.commercial_catalog as target
set kit_composition = base.kit_composition || jsonb_build_array(jsonb_build_object(
      'name','Sensor de abertura PreSense™','quantity',case target.kit_name when 'BT4' then 3 when 'BT6' then 5 else 7 end,
      'description','Sensor adicional para portas, janelas e pontos de acesso compatíveis.','kind','Físico',
      'place','Pontos de acesso definidos na avaliação','image','05-sensor-abertura-presense.webp')),
    updated_at = now()
from public.commercial_catalog as base
where base.kit_name = 'KIT PROTECTION' and target.kit_name in ('BT4','BT6','BT8');

create table if not exists public.commercial_settings (
  singleton boolean primary key default true check (singleton),
  equipment_discount_limit numeric(5,2) not null default 40 check (equipment_discount_limit between 0 and 100),
  monthly_discount_limit numeric(5,2) not null default 10 check (monthly_discount_limit between 0 and 100),
  updated_at timestamptz not null default now()
);
insert into public.commercial_settings(singleton) values (true) on conflict (singleton) do nothing;
alter table public.commercial_settings enable row level security;
grant select on public.commercial_settings to authenticated;
grant update on public.commercial_settings to authenticated;
drop policy if exists "Authenticated read commercial settings" on public.commercial_settings;
create policy "Authenticated read commercial settings" on public.commercial_settings for select to authenticated using (true);
drop policy if exists "Commercial admins maintain settings" on public.commercial_settings;
create policy "Commercial admins maintain settings" on public.commercial_settings for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','commercial_admin'))
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','commercial_admin'));

drop policy if exists "Commercial admins read full catalog" on public.commercial_catalog;
create policy "Commercial admins read full catalog" on public.commercial_catalog for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','commercial_admin'));
drop policy if exists "Commercial admins maintain catalog" on public.commercial_catalog;
create policy "Commercial admins maintain catalog" on public.commercial_catalog for update to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','commercial_admin'))
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','commercial_admin'));
grant update on public.commercial_catalog to authenticated;

create or replace function public.create_custom_proposal(p_id text, p_data jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  proposal_row public.proposals%rowtype;
  catalog_row public.commercial_catalog%rowtype;
  settings_row public.commercial_settings%rowtype;
  item jsonb;
  safe_items jsonb := '[]'::jsonb;
  proposal_data jsonb;
  requested_items jsonb;
  issued_at timestamptz := now();
  gross_equipment numeric(12,2);
  equipment_discount numeric(5,2);
  gross_monthly numeric(12,2);
  monthly_discount numeric(5,2);
  item_name text;
  item_description text;
  item_kind text;
  item_place text;
  item_image text;
  item_quantity integer;
  item_count integer := 0;
  proposal_label text;
  equipment_limit numeric(5,2);
  monthly_limit numeric(5,2);
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória.' using errcode = '42501'; end if;
  if p_id is null or length(p_id) < 8 or length(p_id) > 80 then raise exception 'Identificador da proposta inválido.' using errcode = '22023'; end if;
  select * into proposal_row from public.proposals where user_id = auth.uid() and study_id = p_id;
  if found then return jsonb_build_object('id',proposal_row.id,'studyId',proposal_row.study_id,'createdAt',proposal_row.created_at,'data',proposal_row.data); end if;
  if jsonb_typeof(p_data) <> 'object' or jsonb_typeof(p_data->'client') <> 'object' or jsonb_typeof(p_data->'specialist') <> 'object' then
    raise exception 'Dados da proposta inválidos.' using errcode = '22023';
  end if;
  if coalesce(length(trim(p_data #>> '{client,name}')),0) not between 1 and 160 then raise exception 'Informe o nome do cliente.' using errcode = '22023'; end if;
  if coalesce(length(trim(p_data #>> '{specialist,name}')),0) not between 1 and 160 or coalesce(length(trim(p_data #>> '{specialist,email}')),0) not between 3 and 254 then raise exception 'Informe nome e e-mail do especialista.' using errcode = '22023'; end if;
  if coalesce(p_data->>'equipmentGross','') !~ '^([0-9]{1,9})(\.[0-9]{1,2})?$' or coalesce(p_data->>'monthlyGross','') !~ '^([0-9]{1,9})(\.[0-9]{1,2})?$' then raise exception 'Informe valores brutos válidos.' using errcode = '22023'; end if;
  if coalesce(p_data->>'equipmentDiscount','') !~ '^[0-9]{1,3}(\.[0-9]{1,2})?$' or coalesce(p_data->>'monthlyDiscount','') !~ '^[0-9]{1,3}(\.[0-9]{1,2})?$' then raise exception 'Informe percentuais de desconto válidos.' using errcode = '22023'; end if;
  gross_equipment := (p_data->>'equipmentGross')::numeric;
  gross_monthly := (p_data->>'monthlyGross')::numeric;
  equipment_discount := (p_data->>'equipmentDiscount')::numeric;
  monthly_discount := (p_data->>'monthlyDiscount')::numeric;
  select * into settings_row from public.commercial_settings where singleton = true;
  if not found then raise exception 'Regras comerciais não configuradas.'; end if;
  equipment_limit := settings_row.equipment_discount_limit;
  monthly_limit := settings_row.monthly_discount_limit;
  if coalesce(nullif(p_data->>'kit',''),'Composição personalizada') <> 'Composição personalizada' then
    select * into catalog_row from public.commercial_catalog where kit_name = p_data->>'kit' and active = true;
    if not found then raise exception 'Kit inativo ou indisponível no catálogo.' using errcode = '22023'; end if;
    equipment_limit := catalog_row.equipment_discount_limit;
    monthly_limit := catalog_row.monthly_discount_limit;
  end if;
  if gross_equipment > 100000000 or gross_monthly > 100000000 or equipment_discount < 0 or monthly_discount < 0
     or equipment_discount > equipment_limit or monthly_discount > monthly_limit then
    raise exception 'Para condições acima do limite comercial, fale com o gerente da região.' using errcode = '22023';
  end if;
  if coalesce(jsonb_typeof(p_data->'customItems'),'') <> 'array' then raise exception 'A lista de itens adicionais precisa ser válida.' using errcode = '22023'; end if;
  if jsonb_array_length(p_data->'customItems') > 40 then raise exception 'A proposta aceita até 40 tipos adicionais de item.' using errcode = '22023'; end if;
  if coalesce(nullif(p_data->>'kit',''),'Composição personalizada') <> 'Composição personalizada' and coalesce(jsonb_typeof(catalog_row.kit_composition),'') <> 'array' then raise exception 'A composição do kit está inválida no catálogo.'; end if;
  requested_items := coalesce(catalog_row.kit_composition,'[]'::jsonb) || p_data->'customItems';
  if jsonb_array_length(requested_items) not between 1 and 40 then raise exception 'A proposta aceita de 1 a 40 tipos de item no total.' using errcode = '22023'; end if;
  for item in select value from jsonb_array_elements(requested_items) loop
    item_name := left(regexp_replace(trim(coalesce(item->>'name','')), '[[:cntrl:]]', ' ', 'g'), 160);
    item_description := left(regexp_replace(trim(coalesce(item->>'description','')), '[[:cntrl:]]', ' ', 'g'), 1000);
    item_kind := left(regexp_replace(trim(coalesce(item->>'kind','')), '[[:cntrl:]]', ' ', 'g'), 40);
    item_place := left(regexp_replace(trim(coalesce(item->>'place','')), '[[:cntrl:]]', ' ', 'g'), 160);
    item_image := left(regexp_replace(trim(coalesce(item->>'image','sensor')), '[^a-zA-Z0-9._-]', '', 'g'), 80);
    if item_name = '' or coalesce(item->>'quantity','') !~ '^[0-9]{1,3}$' then raise exception 'Item ou quantidade inválida.' using errcode = '22023'; end if;
    item_quantity := (item->>'quantity')::integer;
    if item_quantity not between 1 and 999 then raise exception 'A quantidade de cada item deve ficar entre 1 e 999.' using errcode = '22023'; end if;
    safe_items := safe_items || jsonb_build_array(jsonb_build_object('name',item_name,'quantity',item_quantity,'description',item_description,'kind',item_kind,'place',item_place,'image',item_image));
    item_count := item_count + item_quantity;
  end loop;
  proposal_label := left(regexp_replace(trim(coalesce(nullif(p_data->>'kit',''),'Composição personalizada')), '[[:cntrl:]]', ' ', 'g'), 100);
  proposal_data := p_data || jsonb_build_object(
    'kit',proposal_label,
    'customItems',safe_items,
    'equipmentOriginal',gross_equipment,
    'monthlyOriginal',gross_monthly,
    'equipmentDiscount',equipment_discount,
    'monthlyDiscount',monthly_discount,
    'finalEquipment',round(gross_equipment * (1 - equipment_discount / 100),2),
    'finalMonthly',round(gross_monthly * (1 - monthly_discount / 100),2),
    'itemCount',item_count,
    'issuedAt',issued_at,
    'proposalVersion',to_char(issued_at at time zone 'UTC','YYYYMMDD-HH24MISS'));
  proposal_data := jsonb_set(proposal_data,'{client,name}',to_jsonb(left(regexp_replace(trim(p_data #>> '{client,name}'),'[[:cntrl:]]',' ','g'),160)),true);
  proposal_data := jsonb_set(proposal_data,'{evaluation,notes}',to_jsonb(left(regexp_replace(coalesce(p_data #>> '{evaluation,notes}',''),'[[:cntrl:]]',' ','g'),4000)),true);
  insert into public.proposals(study_id,user_id,data,created_at) values (p_id,auth.uid(),proposal_data,issued_at)
    on conflict (user_id,study_id) do nothing;
  select * into proposal_row from public.proposals where user_id=auth.uid() and study_id=p_id;
  insert into public.commercial_audit_log(actor_id,action,study_id,details)
    values (auth.uid(),'custom_proposal_generated',p_id,jsonb_build_object('kit',proposal_label,'equipmentGross',gross_equipment,'equipmentDiscount',equipment_discount,'monthlyGross',gross_monthly,'monthlyDiscount',monthly_discount,'itemCount',item_count))
    on conflict (actor_id,action,study_id) do nothing;
  return jsonb_build_object('id',proposal_row.id,'studyId',proposal_row.study_id,'createdAt',proposal_row.created_at,'data',proposal_row.data);
end;
$$;
revoke all on function public.create_custom_proposal(text,jsonb) from public,anon;
grant execute on function public.create_custom_proposal(text,jsonb) to authenticated;
