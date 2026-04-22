import "server-only";
import {
  Company,
  CompanyStatus,
  CompanyPriority,
  DEFAULT_ORIGINS,
} from "@/data/types";
import { companies as staticCompanies } from "@/data/companies";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { computeDistancesByOrigin } from "@/lib/distance";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

const SUPABASE_NOT_CONFIGURED_MSG =
  "Supabase nao configurado. Crie .env.local a partir de .env.local.example, rode supabase/schema.sql e depois `npm run seed`. Veja o README.";

export type CompanyRow = {
  id: string;
  name: string;
  group: string;
  city: string;
  state: string;
  region: Company["region"];
  lat: number;
  lng: number;
  type: Company["type"];
  description: string;
  products: string;
  capacity: string;
  bci: boolean;
  site: string;
  contact: string;
  email: string;
  address: string;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  cep: string | null;
  published: boolean;
  status: CompanyStatus;
  priority: CompanyPriority;
  last_contact_at: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AdminCompany = Company & {
  published: boolean;
  status: CompanyStatus;
  priority: CompanyPriority;
  lastContactAt: string | null;
};

const SELECT_COLUMNS =
  'id,name,"group",city,state,region,lat,lng,type,description,products,capacity,bci,site,contact,email,address,street,"number",neighborhood,cep,published,status,priority,last_contact_at';

type RouteSlim = {
  company_id: string;
  origin_id: string | null;
  distance_km: number;
  duration_min: number;
};

function rowToBase(row: CompanyRow): AdminCompany {
  return {
    id: row.id,
    name: row.name,
    group: row.group,
    city: row.city,
    state: row.state,
    region: row.region,
    lat: row.lat,
    lng: row.lng,
    type: row.type,
    desc: row.description,
    products: row.products,
    capacity: row.capacity,
    bci: row.bci,
    site: row.site,
    contact: row.contact,
    email: row.email,
    address: row.address,
    street: row.street ?? "",
    number: row.number ?? "",
    neighborhood: row.neighborhood ?? "",
    cep: row.cep ?? "",
    distancesByOrigin: {},
    durationsByOrigin: {},
    published: row.published,
    status: row.status ?? "frio",
    priority: row.priority ?? "media",
    lastContactAt: row.last_contact_at,
  };
}

/**
 * Para os IDs informados, retorna mapa {companyId -> {originId -> {distanceKm, durationMin}}}.
 * Le do cache company_routes (rotas reais Google).
 */
async function loadRoutesByCompany(
  companyIds: string[]
): Promise<Record<string, RouteSlim[]>> {
  if (companyIds.length === 0) return {};
  if (!isSupabaseConfigured()) return {};
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("company_routes")
    .select("company_id, origin_id, distance_km, duration_min")
    .in("company_id", companyIds);
  if (error || !data) return {};
  const out: Record<string, RouteSlim[]> = {};
  for (const r of data as RouteSlim[]) {
    if (!r.origin_id) continue;
    if (!out[r.company_id]) out[r.company_id] = [];
    out[r.company_id].push(r);
  }
  return out;
}

function attachDistances(
  companies: AdminCompany[],
  routesMap: Record<string, RouteSlim[]>
): AdminCompany[] {
  return companies.map((c) => {
    const distancesByOrigin: Record<string, number> = {};
    const durationsByOrigin: Record<string, number> = {};
    const routes = routesMap[c.id] ?? [];
    for (const r of routes) {
      if (r.origin_id == null) continue;
      distancesByOrigin[r.origin_id] = Math.round(Number(r.distance_km));
      durationsByOrigin[r.origin_id] = Math.round(Number(r.duration_min));
    }
    return { ...c, distancesByOrigin, durationsByOrigin };
  });
}

function attachStaticFallback(companies: Company[]): Company[] {
  // Quando Supabase nao esta configurado, usa Haversine como aproximacao
  // ate o usuario rodar o schema.sql + seed.
  return companies.map((c) => ({
    ...c,
    distancesByOrigin: computeDistancesByOrigin(c.lat, c.lng, DEFAULT_ORIGINS),
  }));
}

// =================== READS (anon) ===================

export async function listPublishedCompanies(): Promise<Company[]> {
  if (!isSupabaseConfigured()) {
    return attachStaticFallback(
      [...staticCompanies].sort((a, b) => a.name.localeCompare(b.name))
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select(SELECT_COLUMNS)
    .eq("published", true)
    .order("name", { ascending: true });

  if (error) throw new Error(`listPublishedCompanies: ${error.message}`);
  const base = (data as CompanyRow[]).map(rowToBase);
  const routes = await loadRoutesByCompany(base.map((c) => c.id));
  return attachDistances(base, routes);
}

// =================== ADMIN (service_role) ===================

function ensureSupabaseAdmin() {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(SUPABASE_NOT_CONFIGURED_MSG);
  }
}

export async function listAllCompanies(): Promise<AdminCompany[]> {
  ensureSupabaseAdmin();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("companies")
    .select(SELECT_COLUMNS)
    .order("name", { ascending: true });

  if (error) throw new Error(`listAllCompanies: ${error.message}`);
  const base = (data as CompanyRow[]).map(rowToBase);
  const routes = await loadRoutesByCompany(base.map((c) => c.id));
  return attachDistances(base, routes);
}

export async function getCompanyById(id: string): Promise<AdminCompany | null> {
  ensureSupabaseAdmin();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("companies")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getCompanyById: ${error.message}`);
  if (!data) return null;
  const base = rowToBase(data as CompanyRow);
  const routes = await loadRoutesByCompany([id]);
  return attachDistances([base], routes)[0];
}

export type CompanyInput = Omit<
  Company,
  "distancesByOrigin" | "durationsByOrigin" | "lastContactAt"
> & {
  published?: boolean;
  status?: CompanyStatus;
  priority?: CompanyPriority;
};

function companyToRow(
  input: CompanyInput
): Omit<CompanyRow, "created_at" | "updated_at" | "last_contact_at"> {
  return {
    id: input.id,
    name: input.name,
    group: input.group,
    city: input.city,
    state: input.state,
    region: input.region,
    lat: input.lat,
    lng: input.lng,
    type: input.type,
    description: input.desc,
    products: input.products,
    capacity: input.capacity,
    bci: input.bci,
    site: input.site,
    contact: input.contact,
    email: input.email,
    address: input.address,
    street: input.street ?? "",
    number: input.number ?? "",
    neighborhood: input.neighborhood ?? "",
    cep: input.cep ?? "",
    published: input.published ?? true,
    status: input.status ?? "frio",
    priority: input.priority ?? "media",
  };
}

export async function createCompany(input: CompanyInput): Promise<AdminCompany> {
  ensureSupabaseAdmin();
  const supabase = createSupabaseAdminClient();
  const row = companyToRow(input);
  const { data, error } = await supabase
    .from("companies")
    .insert(row)
    .select(SELECT_COLUMNS)
    .single();

  if (error) throw new Error(`createCompany: ${error.message}`);
  return rowToBase(data as CompanyRow);
}

export async function updateCompany(id: string, input: CompanyInput): Promise<AdminCompany> {
  ensureSupabaseAdmin();
  const supabase = createSupabaseAdminClient();
  const row = companyToRow({ ...input, id });
  const { data, error } = await supabase
    .from("companies")
    .update(row)
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .single();

  if (error) throw new Error(`updateCompany: ${error.message}`);
  return rowToBase(data as CompanyRow);
}

export async function deleteCompany(id: string): Promise<void> {
  ensureSupabaseAdmin();
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) throw new Error(`deleteCompany: ${error.message}`);
}

export async function setCompanyPublished(id: string, published: boolean): Promise<void> {
  ensureSupabaseAdmin();
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("companies").update({ published }).eq("id", id);
  if (error) throw new Error(`setCompanyPublished: ${error.message}`);
}

export async function setCompanyStatusAndPriority(
  id: string,
  patch: { status?: CompanyStatus; priority?: CompanyPriority }
): Promise<void> {
  ensureSupabaseAdmin();
  const supabase = createSupabaseAdminClient();
  const update: Record<string, string> = {};
  if (patch.status) update.status = patch.status;
  if (patch.priority) update.priority = patch.priority;
  if (Object.keys(update).length === 0) return;
  const { error } = await supabase.from("companies").update(update).eq("id", id);
  if (error) throw new Error(`setCompanyStatusAndPriority: ${error.message}`);
}
