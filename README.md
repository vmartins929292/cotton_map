# cotton-dashboard

Mapa nacional de compradores de algodão (VALOR AG Commodities).
Dashboard Next.js 16 + Supabase, com painel administrativo de prospecção
(empresas, contatos e timeline de interações).

---

## Stack

- Next.js 16 (App Router) + React 19
- TypeScript + Tailwind v4
- Leaflet / react-leaflet (mapa)
- Supabase (Postgres) — fonte de verdade das empresas
- Server Components + Server Actions

---

## Setup

### 1. Variáveis de ambiente

Copie `.env.local.example` para `.env.local` e preencha:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...               # apenas server-side, NUNCA expor
ADMIN_PASSWORD=troque-esta-senha-forte
GOOGLE_MAPS_API_KEY=...                     # geocoding (admin) + Routes v2 + Places (server-only)
GOOGLE_PLACES_RATE_LIMIT_PER_MIN=30         # opcional, default 30 — limite por IP no proxy /api/places/*
```

> **Google Maps — APIs a habilitar** no [Google Cloud Console](https://console.cloud.google.com/apis/library):
>
> - **Routes API** (rota principal — substitui a Directions legada; entrega tempo com tráfego, pedágios em BRL, alternativas e instruções passo-a-passo).
> - **Places API (New)** (autocomplete de endereço no Planejador de Rotas — chamada via proxy `/api/places/autocomplete` e `/api/places/details`).
> - **Geocoding API** (usada no painel admin para converter endereço cadastrado em lat/lng).
>
> A chave é usada **somente server-side** (server actions e route handlers), nunca vai para o bundle do browser. Mesmo assim, **restrinja a chave** no Cloud Console: aba "Restrições de aplicativo" → IP do servidor de produção; aba "Restrições de API" → marque apenas as 3 APIs acima.
>
> ⚠️ **Importante**: se a chave já circulou em chats, e-mails ou prints, **revogue e gere uma nova**. Custos: o crédito recorrente de US$ 200/mês da Maps Platform cobre milhares de chamadas — Routes API custa ~US$ 5 por 1.000 requests (Compute Routes Basic) e Places Autocomplete cobra por sessão (~US$ 17 por 1.000 sessões), por isso o componente `AddressAutocomplete` reutiliza um único `sessionToken` enquanto o usuário digita.

### 2. Criar o schema no Supabase

No Supabase Studio → **SQL Editor**, cole e execute o conteúdo de
[`supabase/schema.sql`](./supabase/schema.sql). Cria 4 tabelas + view + RLS:

- **`companies`** — empresas (com `status` no funil, `priority`, `last_contact_at`)
- **`company_contacts`** — N contatos por empresa (nome, cargo, telefone, e-mail, LinkedIn)
- **`company_notes`** — timeline de interações (ligação, e-mail, reunião, proposta, follow-up)
- **`company_routes`** — cache permanente das rotas Routes API v2 (origem fixa × empresa). Calculado sob demanda na primeira ativação do botão SPZ/SRS/LEM no card; depois fica em cache. Inclui `duration_min_traffic`, `tolls_brl` e `steps` (jsonb com instruções passo-a-passo).
- **`custom_routes`** — cache de rotas planejadas pelo Planejador de Rotas (origem livre via Places + waypoints). Chave = sha1 estável de origem + destino + paradas.
- **`upcoming_followups`** (view) — próximos follow-ups com classificação de urgência
- Trigger automático mantém `companies.last_contact_at` em sincronia com a nota mais recente
- RLS: leitura pública de `companies` publicadas e `company_routes`. Contatos/notas só pelo service_role (server actions).

> O schema é idempotente — pode rodar múltiplas vezes sem quebrar (útil ao migrar de versão antiga).

### 3. Seed inicial (popula 64 empresas)

```bash
npm install
npm run seed
```

O script lê `data/companies.ts` (a base estática histórica) e faz **upsert**
no Supabase recalculando `dist_sapezal/dist_sorriso/dist_lem` via Haversine.
Pode rodar várias vezes — não duplica.

### 4. Rodar localmente

```bash
npm run dev
# http://localhost:3000          → dashboard público
# http://localhost:3000/admin    → painel (pede ADMIN_PASSWORD)
```

---

## Estrutura

```
app/
  page.tsx                    Server Component → busca companies do Supabase
  empresas/page.tsx           Server Component → lista por estado
  actions/
    routes.ts                 getRouteAction (origem fixa) + getCustomRouteAction (origem livre + waypoints), via Routes API v2
  api/
    places/
      autocomplete/route.ts   proxy server-side de Places Autocomplete (com rate-limit por IP)
      details/route.ts        proxy de Place Details
  admin/
    layout.tsx                header + nav + logout
    page.tsx                  lista admin (filtros, follow-ups, status)
    actions.ts                server actions empresas (save/delete/toggle/geocode/status)
    contacts-actions.ts       server actions de contatos
    notes-actions.ts          server actions de notas
    types.ts                  SaveState, ContactSaveState, NoteSaveState
    login/                    /admin/login (form + server action)
    empresas/
      new/page.tsx            criar
      [id]/page.tsx           editar (3 abas: ficha | contatos | notas)
components/
  dashboard-client.tsx        client UI do mapa (incl. Planejador de Rotas e drawer de instruções)
  empresas-client.tsx         client UI da lista por estado
  route-planner.tsx           UI do Planejador (origem fixa/livre + waypoints + traçar)
  address-autocomplete.tsx    input com sugestões via /api/places (debounce + sessionToken)
  route-instructions-drawer.tsx  drawer lateral com passo-a-passo da rota
  map-view.tsx                Leaflet (rotas fixas + custom + alternativas + popups ricos)
  company-form.tsx            form admin de empresa (com geocoding Google)
  admin-company-row.tsx       linha da lista admin (status, prio, toggle, delete)
  admin-tabs.tsx              componente genérico de abas
  contacts-panel.tsx          UI da aba "Contatos" (list + form inline)
  notes-panel.tsx             UI da aba "Notas" (timeline + form inline)
  status-priority-chips.tsx   chips clicáveis no header da empresa
lib/
  companies.ts                CRUD Supabase de empresas (server-only)
  contacts.ts                 CRUD Supabase de contatos
  notes.ts                    CRUD Supabase de notas + listUpcomingFollowups
  companies-utils.ts          agrupar/ordenar (puro, client-safe)
  distance.ts                 Haversine + computeDistances
  polyline.ts                 decodePolyline (Google encoded polyline format)
  routes-v2.ts                wrapper server-only da Routes API v2 (computeRouteV2)
  route-cache.ts              routeCacheKey (sha1 estável de origem+destino+waypoints)
  route-types.ts              tipos client-safe (RouteStep)
  places-types.ts             tipos compartilhados dos endpoints /api/places
  rate-limit.ts               rate-limit in-memory (janela fixa por minuto)
  admin-auth.ts               cookie sessão, requireAdmin()
  search.ts                   matchesSearch
  supabase/
    server.ts                 createSupabaseServerClient + admin client
    client.ts                 createSupabaseBrowserClient
data/
  companies.ts                base estática (usada apenas pelo seed inicial)
  types.ts                    Company, Contact, Note, STATUS/PRIORITY/KIND_LABELS, etc.
scripts/
  seed-companies.ts           popular Supabase a partir de data/companies.ts
supabase/
  schema.sql                  4 tabelas + view + triggers + RLS
middleware.ts                 protege /admin/* (exceto /admin/login)
```

---

## Painel admin

- **Login**: `/admin/login` (senha em `ADMIN_PASSWORD`)

### Lista de empresas (`/admin`)

- Bloco no topo com **próximos follow-ups** (atrasados / esta semana / próximos 30 dias)
- Filtros por **status** (frio · morno · quente · cliente · descartado) e **prioridade** (alta · média · baixa)
- Busca textual por nome, grupo, cidade, ID
- Colunas: tipo, cidade/UF, status, prioridade, último contato, BCI, publicação
- Toggle publicar/ocultar e excluir direto da linha

### Página da empresa (`/admin/empresas/[id]`)

3 abas:

1. **Ficha da empresa** — formulário completo (com geocoding via Nominatim/OSM, recálculo automático de distâncias)
2. **Contatos** — N pessoas por empresa: nome, cargo, telefone/WhatsApp, e-mail, LinkedIn, observações; marca contato principal
3. **Notas & Histórico** — timeline cronológica de interações (8 tipos: nota, ligação, e-mail, WhatsApp, reunião, visita técnica, proposta, amostra), pode amarrar a um contato específico, com `next_followup_at` opcional para alimentar o bloco de follow-ups

No header da página: chips clicáveis para mudar status/prioridade sem abrir o form.

## Planejador de Rotas (dashboard público)

Card recolhível na sidebar (acima da lista de empresas) que permite traçar rotas reais com dados de tráfego ao vivo.

- **Origem**: 4 chips — `SPZ`, `SRS`, `LEM` (atalhos para as fábricas) ou **"Outro endereço…"** que revela um campo com autocomplete (Google Places).
- **Destino**: empresa selecionada na lista (basta clicar num card).
- **Paradas**: até 3 waypoints intermediários (visitas comerciais), cada um com seu próprio autocomplete.
- **Botão "Traçar rota"** → chama `getCustomRouteAction` → Routes API v2 → retorna rota principal + alternativas + pedágios + ETA com tráfego.

No mapa:

- A rota principal aparece em traço grosso marrom; alternativas como linhas tracejadas mais finas — clique numa alternativa para promovê-la a principal.
- Pinos personalizados nos endpoints: **A** (origem, verde-azulado), números (paradas, marrom) e **B** (destino, vermelho).
- Popup da rota traz: distância, tempo sem tráfego, **tempo agora com tráfego** (cor verde/laranja/vermelha conforme congestionamento), pedágios em R$ e botão **"Ver instruções"** que abre o drawer lateral com o passo-a-passo.

### Cache e revalidação

Páginas públicas têm `revalidate = 60`. As mutações revalidam manualmente
`/`, `/empresas`, `/admin` e a página da empresa afetada.

---

## Migração de banco existente (v1 → v2)

Se você já tinha um banco rodando com o schema antigo (só `companies`),
o `supabase/schema.sql` v2 é seguro: roda o SQL inteiro de novo no SQL Editor.
Ele apenas:

- Cria os tipos `company_status`, `company_priority`, `interaction_kind` se não existirem
- Adiciona colunas `status`, `priority`, `last_contact_at` em `companies` (com default)
- Cria as tabelas `company_contacts` e `company_notes`
- Cria a view `upcoming_followups` e os triggers

Não destrói dados. Não precisa rodar `npm run seed` de novo (a menos que
queira repopular do zero).

---

## Segurança

- `SUPABASE_SERVICE_ROLE_KEY` só é usado em código server (`lib/supabase/server.ts → createSupabaseAdminClient`)
- Mutações no banco só acontecem via service role (RLS bloqueia anon)
- Cookie de sessão admin é `httpOnly + sameSite=lax` (`secure` em produção)
- Trocar `ADMIN_PASSWORD` invalida automaticamente todas as sessões existentes
