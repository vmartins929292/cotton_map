-- =====================================================
-- cotton-dashboard / Supabase schema (v2)
-- =====================================================
-- Rode este SQL inteiro no SQL Editor do Supabase.
-- Pode rodar mais de uma vez sem quebrar (tudo eh idempotente).
-- =====================================================

create extension if not exists "pgcrypto";

-- ===== ENUMS =====
do $$ begin
  create type company_type as enum ('fiacao','integrada','denim','malharia','comercial');
exception when duplicate_object then null; end $$;

do $$ begin
  create type company_region as enum ('NE','SE','S','CO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type company_status as enum ('frio','morno','quente','cliente','descartado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type company_priority as enum ('alta','media','baixa');
exception when duplicate_object then null; end $$;

do $$ begin
  create type interaction_kind as enum (
    'nota','ligacao','email','whatsapp','reuniao','visita','proposta','amostra'
  );
exception when duplicate_object then null; end $$;

-- =====================================================
-- TABELA: companies
-- =====================================================
create table if not exists public.companies (
  id              text primary key,
  name            text not null,
  "group"         text not null,
  city            text not null,
  state           text not null,
  region          company_region not null,
  lat             double precision not null,
  lng             double precision not null,
  type            company_type not null,
  description     text not null default '',
  products        text not null default '',
  capacity        text not null default '',
  bci             boolean not null default false,
  site            text not null default '',
  contact         text not null default '',  -- legado: telefone "principal" antigo
  email           text not null default '',  -- legado: email "principal" antigo
  address         text not null default '',  -- legado: label completo (cache do Google Places)
  -- Endereco estruturado (preenchido pelo autocomplete do Places).
  street          text not null default '',
  "number"        text not null default '',
  neighborhood    text not null default '',
  cep             text not null default '',
  dist_sapezal    integer not null default 0,
  dist_sorriso    integer not null default 0,
  dist_lem        integer not null default 0,
  published       boolean not null default true,
  -- novos campos de prospeccao
  status          company_status not null default 'frio',
  priority        company_priority not null default 'media',
  last_contact_at timestamptz,  -- atualizado automaticamente via trigger em company_notes
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Garante novos campos em bancos pre-existentes (idempotente)
alter table public.companies
  add column if not exists status company_status not null default 'frio';
alter table public.companies
  add column if not exists priority company_priority not null default 'media';
alter table public.companies
  add column if not exists last_contact_at timestamptz;
-- Endereco estruturado (preenchido pelo autocomplete do Places).
alter table public.companies
  add column if not exists street text not null default '';
alter table public.companies
  add column if not exists "number" text not null default '';
alter table public.companies
  add column if not exists neighborhood text not null default '';
alter table public.companies
  add column if not exists cep text not null default '';

create index if not exists companies_state_idx     on public.companies (state);
create index if not exists companies_region_idx    on public.companies (region);
create index if not exists companies_type_idx      on public.companies (type);
create index if not exists companies_group_idx     on public.companies ("group");
create index if not exists companies_published_idx on public.companies (published);
create index if not exists companies_status_idx    on public.companies (status);
create index if not exists companies_priority_idx  on public.companies (priority);

-- =====================================================
-- TABELA: company_contacts (N por empresa)
-- =====================================================
create table if not exists public.company_contacts (
  id          uuid primary key default gen_random_uuid(),
  company_id  text not null references public.companies(id) on delete cascade,
  name        text not null,
  role        text not null default '',  -- ex: "Compras", "Diretor Industrial"
  phone       text not null default '',
  email       text not null default '',
  linkedin    text not null default '',
  notes       text not null default '',  -- observacoes especificas do contato
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists company_contacts_company_idx
  on public.company_contacts (company_id);

-- Garante apenas 1 contato primario por empresa
create unique index if not exists company_contacts_one_primary_per_company
  on public.company_contacts (company_id) where is_primary;

-- =====================================================
-- TABELA: company_notes (timeline de prospeccao)
-- =====================================================
create table if not exists public.company_notes (
  id                uuid primary key default gen_random_uuid(),
  company_id        text not null references public.companies(id) on delete cascade,
  contact_id        uuid references public.company_contacts(id) on delete set null,
  kind              interaction_kind not null default 'nota',
  body              text not null,
  happened_at       timestamptz not null default now(),
  next_followup_at  timestamptz,
  author            text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists company_notes_company_idx
  on public.company_notes (company_id);
create index if not exists company_notes_happened_idx
  on public.company_notes (happened_at desc);
create index if not exists company_notes_followup_idx
  on public.company_notes (next_followup_at)
  where next_followup_at is not null;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- updated_at em todas as tabelas
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

drop trigger if exists company_contacts_set_updated_at on public.company_contacts;
create trigger company_contacts_set_updated_at
  before update on public.company_contacts
  for each row execute function public.set_updated_at();

drop trigger if exists company_notes_set_updated_at on public.company_notes;
create trigger company_notes_set_updated_at
  before update on public.company_notes
  for each row execute function public.set_updated_at();

-- Atualiza companies.last_contact_at quando uma nota eh inserida/atualizada/removida
create or replace function public.refresh_company_last_contact()
returns trigger language plpgsql as $$
declare
  cid text;
begin
  cid := coalesce(new.company_id, old.company_id);
  update public.companies c
     set last_contact_at = (
       select max(happened_at)
       from public.company_notes n
       where n.company_id = c.id
     )
   where c.id = cid;
  return null;
end; $$;

drop trigger if exists company_notes_refresh_last_contact on public.company_notes;
create trigger company_notes_refresh_last_contact
  after insert or update of happened_at, company_id or delete on public.company_notes
  for each row execute function public.refresh_company_last_contact();

-- =====================================================
-- TABELA: origins (origens de rota cadastraveis)
-- =====================================================
-- 3 default seeds (Sapezal/Sorriso/LEM, is_default=true) + extras criadas pelo admin.
-- A coluna "key" eh um slug estavel (usado em URLs e seeds); nao muda mesmo se renomearem.
create table if not exists public.origins (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,
  name         text not null,
  short        text not null,
  color        text not null default '#8b5a2b',
  address      text not null default '',  -- legado: label completo (cache do Google Places)
  -- Endereco estruturado (preenchido pelo autocomplete do Places).
  street       text not null default '',
  "number"     text not null default '',
  neighborhood text not null default '',
  cep          text not null default '',
  city         text not null default '',
  state        text not null default '',  -- UF de 2 letras (ex.: "MT", "BA")
  lat          double precision not null,
  lng          double precision not null,
  is_default   boolean not null default false,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Idempotente para bancos preexistentes
alter table public.origins
  add column if not exists street text not null default '';
alter table public.origins
  add column if not exists "number" text not null default '';
alter table public.origins
  add column if not exists neighborhood text not null default '';
alter table public.origins
  add column if not exists cep text not null default '';
alter table public.origins
  add column if not exists city text not null default '';
alter table public.origins
  add column if not exists state text not null default '';

create index if not exists origins_sort_idx on public.origins (sort_order, name);

drop trigger if exists origins_set_updated_at on public.origins;
create trigger origins_set_updated_at
  before update on public.origins
  for each row execute function public.set_updated_at();

-- Seed das 3 origens default. Idempotente via upsert por "key".
insert into public.origins
  (key, name, short, color, city, state, address, lat, lng, is_default, sort_order)
values
  ('sapezal', 'SAPEZAL',                'Sapezal',                '#d97706',
   'Sapezal',                  'MT', 'Sapezal — MT',                  -13.55,    -58.765,  true, 10),
  ('sorriso', 'SORRISO',                'Sorriso',                '#059669',
   'Sorriso',                  'MT', 'Sorriso — MT',                  -12.5432,  -55.7218, true, 20),
  ('lem',     'LUÍS EDUARDO MAGALHÃES', 'Luís Eduardo Magalhães', '#7c3aed',
   'Luís Eduardo Magalhães',   'BA', 'Luís Eduardo Magalhães — BA',   -12.0964,  -45.7897, true, 30)
on conflict (key) do update
  set name       = excluded.name,
      short      = excluded.short,
      color      = excluded.color,
      city       = excluded.city,
      state      = excluded.state,
      address    = excluded.address,
      lat        = excluded.lat,
      lng        = excluded.lng,
      is_default = excluded.is_default,
      sort_order = excluded.sort_order;

-- RLS: leitura publica das origens (precisamos no dashboard publico)
alter table public.origins enable row level security;
drop policy if exists "public read origins" on public.origins;
create policy "public read origins"
  on public.origins for select
  using (true);

-- =====================================================
-- TABELA: company_routes (cache de rotas Google Directions)
-- =====================================================
-- Uma linha por (empresa, origem). polyline = encoded polyline da Google.
-- distance_km e duration_min sao retornados direto pela Directions API.
-- Cache permanente: rotas sao recalculadas apenas se a linha for removida.
create table if not exists public.company_routes (
  company_id   text not null references public.companies(id) on delete cascade,
  origin       text,  -- legado: pre-migracao para origin_id; mantido nullable
  polyline     text not null,
  distance_km  numeric(8,2) not null,
  duration_min integer not null,
  computed_at  timestamptz not null default now()
);

-- Campos novos da Routes API v2 (idempotente)
alter table public.company_routes
  add column if not exists duration_min_traffic integer;
alter table public.company_routes
  add column if not exists tolls_brl numeric(10,2);
alter table public.company_routes
  add column if not exists steps jsonb;

-- ====== MIGRACAO origin (text) -> origin_id (uuid FK) ======
-- 1) Adiciona coluna nova nullable (idempotente).
alter table public.company_routes
  add column if not exists origin_id uuid references public.origins(id) on delete cascade;

-- 2) Backfill: para cada linha onde origin_id eh null mas origin (text) preenchido,
--    resolve via origins.key. Idempotente.
update public.company_routes cr
   set origin_id = o.id
  from public.origins o
 where cr.origin_id is null
   and cr.origin is not null
   and o.key = cr.origin;

-- 3) Permite tornar origin_id NOT NULL apenas se nao houver linhas sem mapeamento.
do $$
begin
  if not exists (
    select 1 from public.company_routes where origin_id is null
  ) then
    begin
      alter table public.company_routes alter column origin_id set not null;
    exception when others then null;
    end;
  end if;
end $$;

-- 4) Remove a PK antiga (company_id, origin) se existir e cria a nova (company_id, origin_id).
do $$
declare
  pk_name text;
begin
  select conname into pk_name
    from pg_constraint
   where conrelid = 'public.company_routes'::regclass
     and contype = 'p';
  if pk_name is not null then
    execute format('alter table public.company_routes drop constraint %I', pk_name);
  end if;
end $$;

create unique index if not exists company_routes_company_origin_id_uidx
  on public.company_routes (company_id, origin_id);

create index if not exists company_routes_company_idx
  on public.company_routes (company_id);
create index if not exists company_routes_origin_id_idx
  on public.company_routes (origin_id);

-- =====================================================
-- TABELA: custom_routes (rotas com origem livre / waypoints)
-- =====================================================
-- Cache de rotas planejadas pelo "Planejador de Rotas" do dashboard.
-- cache_key = sha1(origin_lat|origin_lng|dest|waypoints) — estavel.
create table if not exists public.custom_routes (
  cache_key            text primary key,
  origin_lat           double precision not null,
  origin_lng           double precision not null,
  origin_label         text not null default '',
  dest_company_id      text references public.companies(id) on delete cascade,
  dest_lat             double precision not null,
  dest_lng             double precision not null,
  dest_label           text not null default '',
  waypoints            jsonb not null default '[]'::jsonb,
  polyline             text not null,
  distance_km          numeric(8,2) not null,
  duration_min         integer not null,
  duration_min_traffic integer,
  tolls_brl            numeric(10,2),
  steps                jsonb,
  computed_at          timestamptz not null default now()
);

create index if not exists custom_routes_dest_company_idx
  on public.custom_routes (dest_company_id);
create index if not exists custom_routes_computed_idx
  on public.custom_routes (computed_at desc);

-- RLS: leitura publica (rotas nao sao dado sensivel) + writes via service_role
alter table public.custom_routes enable row level security;
drop policy if exists "public read custom routes" on public.custom_routes;
create policy "public read custom routes"
  on public.custom_routes for select
  using (true);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
alter table public.companies        enable row level security;
alter table public.company_contacts enable row level security;
alter table public.company_notes    enable row level security;
alter table public.company_routes   enable row level security;
alter table public.origins          enable row level security;

-- company_routes: leitura publica (rotas nao sao dado sensivel).
-- Mutacoes sao restritas ao service_role (server actions) -> sem policy de write.
drop policy if exists "public read routes" on public.company_routes;
create policy "public read routes"
  on public.company_routes for select
  using (true);

-- companies: leitura publica das publicadas (mapa do site)
drop policy if exists "public read published companies" on public.companies;
create policy "public read published companies"
  on public.companies for select
  using (published = true);

-- contatos e notas: NUNCA expostos publicamente.
-- Apenas o service_role (server actions do admin) pode ler/escrever.
-- Sem policies para anon -> bloqueia tudo no RLS.
-- Mutacoes de companies tambem ficam restritas a service_role (sem policy de write).

-- =====================================================
-- VIEW UTIL: proximos follow-ups (proximos 7 dias + atrasados)
-- =====================================================
create or replace view public.upcoming_followups as
  select
    n.id              as note_id,
    n.company_id,
    c.name            as company_name,
    c.city,
    c.state,
    c.status          as company_status,
    c.priority        as company_priority,
    n.kind,
    n.body,
    n.next_followup_at,
    n.author,
    case
      when n.next_followup_at < now()                            then 'atrasado'
      when n.next_followup_at < now() + interval '7 days'        then 'esta_semana'
      else 'futuro'
    end as urgency
  from public.company_notes n
  join public.companies c on c.id = n.company_id
  where n.next_followup_at is not null
  order by n.next_followup_at asc;
