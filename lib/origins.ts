import "server-only";
import { DEFAULT_ORIGINS, type Origin } from "@/data/types";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/companies";

export type OriginRow = {
  id: string;
  key: string;
  name: string;
  short: string;
  color: string;
  address: string;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  cep: string | null;
  city: string | null;
  state: string | null;
  lat: number;
  lng: number;
  is_default: boolean;
  sort_order: number;
};

const SELECT_COLUMNS =
  'id,key,name,short,color,address,street,"number",neighborhood,cep,city,state,lat,lng,is_default,sort_order';

function rowToOrigin(row: OriginRow): Origin {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    short: row.short,
    color: row.color,
    address: row.address ?? "",
    street: row.street ?? "",
    number: row.number ?? "",
    neighborhood: row.neighborhood ?? "",
    cep: row.cep ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    lat: row.lat,
    lng: row.lng,
    isDefault: row.is_default,
    sortOrder: row.sort_order,
  };
}

function sortOrigins(list: Origin[]): Origin[] {
  return [...list].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Lista todas as origens publicaveis para o dashboard publico.
 * Fallback automatico para DEFAULT_ORIGINS quando Supabase nao esta configurado.
 */
export async function listOrigins(): Promise<Origin[]> {
  if (!isSupabaseConfigured()) return sortOrigins(DEFAULT_ORIGINS);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("origins")
    .select(SELECT_COLUMNS)
    .order("sort_order", { ascending: true });
  if (error || !data) return sortOrigins(DEFAULT_ORIGINS);
  return sortOrigins((data as OriginRow[]).map(rowToOrigin));
}

/**
 * Versao admin (service_role) — usada pelos server actions de cadastro de empresas
 * para garantir leitura mesmo se RLS ficar restrito no futuro.
 */
export async function listOriginsAdmin(): Promise<Origin[]> {
  if (!isSupabaseConfigured()) return sortOrigins(DEFAULT_ORIGINS);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("origins")
    .select(SELECT_COLUMNS)
    .order("sort_order", { ascending: true });
  if (error || !data) return sortOrigins(DEFAULT_ORIGINS);
  return sortOrigins((data as OriginRow[]).map(rowToOrigin));
}

/**
 * Aceita UUID OU key (slug). Defensivo: o frontend pode acabar com slugs em vez de UUIDs
 * se o SSR caiu pro DEFAULT_ORIGINS por uma falha temporaria do Supabase.
 */
export async function getOriginById(id: string): Promise<Origin | null> {
  if (!id) return null;
  if (!isSupabaseConfigured()) {
    return DEFAULT_ORIGINS.find((o) => o.id === id || o.key === id) ?? null;
  }
  const supabase = createSupabaseAdminClient();
  // UUID v4 tem 36 caracteres com hifens; slug nao tem hifen e eh curto.
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id
  );
  const query = supabase.from("origins").select(SELECT_COLUMNS);
  const { data, error } = looksLikeUuid
    ? await query.eq("id", id).maybeSingle()
    : await query.eq("key", id).maybeSingle();
  if (error || !data) {
    // Fallback final: tenta no DEFAULT_ORIGINS por compatibilidade
    return DEFAULT_ORIGINS.find((o) => o.id === id || o.key === id) ?? null;
  }
  return rowToOrigin(data as OriginRow);
}

export async function createOrigin(input: {
  key: string;
  name: string;
  short: string;
  color: string;
  address: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  cep?: string;
  city?: string;
  state?: string;
  lat: number;
  lng: number;
  sortOrder: number;
}): Promise<Origin> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("origins")
    .insert({
      key: input.key,
      name: input.name,
      short: input.short,
      color: input.color,
      address: input.address,
      street: input.street ?? "",
      number: input.number ?? "",
      neighborhood: input.neighborhood ?? "",
      cep: input.cep ?? "",
      city: input.city ?? "",
      state: input.state ?? "",
      lat: input.lat,
      lng: input.lng,
      is_default: false,
      sort_order: input.sortOrder,
    })
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw new Error(`createOrigin: ${error.message}`);
  return rowToOrigin(data as OriginRow);
}

export async function updateOrigin(
  id: string,
  patch: Partial<{
    name: string;
    short: string;
    color: string;
    address: string;
    street: string;
    number: string;
    neighborhood: string;
    cep: string;
    city: string;
    state: string;
    lat: number;
    lng: number;
    sortOrder: number;
  }>
): Promise<Origin> {
  const supabase = createSupabaseAdminClient();
  const update: Record<string, string | number> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.short !== undefined) update.short = patch.short;
  if (patch.color !== undefined) update.color = patch.color;
  if (patch.address !== undefined) update.address = patch.address;
  if (patch.street !== undefined) update.street = patch.street;
  if (patch.number !== undefined) update.number = patch.number;
  if (patch.neighborhood !== undefined) update.neighborhood = patch.neighborhood;
  if (patch.cep !== undefined) update.cep = patch.cep;
  if (patch.city !== undefined) update.city = patch.city;
  if (patch.state !== undefined) update.state = patch.state;
  if (patch.lat !== undefined) update.lat = patch.lat;
  if (patch.lng !== undefined) update.lng = patch.lng;
  if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;

  const { data, error } = await supabase
    .from("origins")
    .update(update)
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw new Error(`updateOrigin: ${error.message}`);
  return rowToOrigin(data as OriginRow);
}

export async function deleteOrigin(id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const existing = await supabase
    .from("origins")
    .select("is_default")
    .eq("id", id)
    .maybeSingle();
  if (existing.data?.is_default) {
    throw new Error("Origens default (Sapezal/Sorriso/LEM) nao podem ser excluidas.");
  }
  const { error } = await supabase.from("origins").delete().eq("id", id);
  if (error) throw new Error(`deleteOrigin: ${error.message}`);
}
