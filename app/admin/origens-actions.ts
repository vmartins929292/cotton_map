"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import {
  createOrigin,
  updateOrigin,
  deleteOrigin,
  getOriginById,
  listOriginsAdmin,
} from "@/lib/origins";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { computeRouteV2 } from "@/lib/routes-v2";
import type { SaveState } from "./types";

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

type ParsedOrigin = {
  id: string | null;
  key: string;
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
};

function parseForm(formData: FormData): ParsedOrigin {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const idRaw = get("id");
  const name = get("name");
  const city = get("city");
  const state = get("state").toUpperCase();
  // Fallback de short: se admin nao informou, usa o nome do municipio (ou nome formal).
  const short = get("short") || city || name;
  const keyRaw = get("key");
  const key = keyRaw || slugify(name);
  const colorRaw = get("color") || "#8b5a2b";
  const address = get("address");
  const street = get("street");
  const number = get("number");
  const neighborhood = get("neighborhood");
  const cep = get("cep");
  const lat = Number(get("lat"));
  const lng = Number(get("lng"));
  const sortRaw = get("sort_order");
  const sortOrder = sortRaw ? Number(sortRaw) : 100;

  if (!name) throw new Error("Nome obrigatorio.");
  if (!city) throw new Error("Cidade/municipio obrigatorio.");
  if (!state || state.length !== 2) {
    throw new Error("Estado (UF de 2 letras) obrigatorio.");
  }
  if (!key) throw new Error("Slug (key) invalido.");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("lat/lng invalidos. Use o autocomplete para localizar o endereco.");
  }
  if (!Number.isFinite(sortOrder)) {
    throw new Error("sort_order invalido.");
  }

  return {
    id: idRaw || null,
    key,
    name,
    short,
    color: colorRaw,
    address,
    street,
    number,
    neighborhood,
    cep,
    city,
    state,
    lat,
    lng,
    sortOrder,
  };
}

export async function saveOriginAction(
  mode: "create" | "update",
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  await requireAdmin();
  let parsed: ParsedOrigin;
  try {
    parsed = parseForm(formData);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Dados invalidos." };
  }

  let originId: string;
  let coordsChanged = mode === "create";

  try {
    if (mode === "create") {
      const created = await createOrigin({
        key: parsed.key,
        name: parsed.name,
        short: parsed.short,
        color: parsed.color,
        address: parsed.address,
        street: parsed.street,
        number: parsed.number,
        neighborhood: parsed.neighborhood,
        cep: parsed.cep,
        city: parsed.city,
        state: parsed.state,
        lat: parsed.lat,
        lng: parsed.lng,
        sortOrder: parsed.sortOrder,
      });
      originId = created.id;
    } else {
      if (!parsed.id) return { error: "ID da origem nao informado." };
      const previous = await getOriginById(parsed.id);
      if (!previous) return { error: "Origem nao encontrada." };
      if (previous.lat !== parsed.lat || previous.lng !== parsed.lng) {
        coordsChanged = true;
      }
      const updated = await updateOrigin(parsed.id, {
        name: parsed.name,
        short: parsed.short,
        color: parsed.color,
        address: parsed.address,
        street: parsed.street,
        number: parsed.number,
        neighborhood: parsed.neighborhood,
        cep: parsed.cep,
        city: parsed.city,
        state: parsed.state,
        lat: parsed.lat,
        lng: parsed.lng,
        sortOrder: parsed.sortOrder,
      });
      originId = updated.id;
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao salvar origem." };
  }

  // Backfill em background (fire-and-forget): popula company_routes para essa origem
  // em todas as empresas. Em coords inalteradas no update, nao precisa.
  if (coordsChanged) {
    void backfillOriginRoutes(originId).catch((e) => {
      console.error(`[saveOriginAction] backfill falhou: ${e}`);
    });
  }

  revalidatePath("/");
  revalidatePath("/empresas");
  revalidatePath("/admin/origens");
  redirect("/admin/origens");
}

export async function deleteOriginAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteOrigin(id);
  revalidatePath("/");
  revalidatePath("/empresas");
  revalidatePath("/admin/origens");
}

/**
 * Recalcula a coluna company_routes para UMA origem em TODAS as empresas.
 * Roda em segundo plano: o admin nao espera. Concorrencia 4 para nao estourar Routes API.
 */
async function backfillOriginRoutes(originId: string): Promise<void> {
  const origin = await getOriginById(originId);
  if (!origin) return;

  const db = createSupabaseAdminClient();
  // Apaga rotas antigas dessa origem (caso lat/lng tenha mudado).
  await db.from("company_routes").delete().eq("origin_id", originId);

  // Busca todas as empresas com coordenadas validas.
  const { data: companies, error } = await db
    .from("companies")
    .select("id, lat, lng")
    .not("lat", "is", null)
    .not("lng", "is", null);
  if (error || !companies) return;

  const CONCURRENCY = 4;
  let cursor = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= companies!.length) return;
      const c = companies![i] as { id: string; lat: number; lng: number };
      if (
        c.lat == null ||
        c.lng == null ||
        !Number.isFinite(c.lat) ||
        !Number.isFinite(c.lng)
      ) {
        continue;
      }
      const res = await computeRouteV2({
        origin: { lat: origin!.lat, lng: origin!.lng },
        destination: { lat: c.lat, lng: c.lng },
        withAlternatives: false,
      });
      if ("error" in res) continue;
      const r = res.primary;
      await db.from("company_routes").upsert(
        {
          company_id: c.id,
          origin_id: originId,
          polyline: r.polyline,
          distance_km: r.distanceKm,
          duration_min: r.durationMin,
          duration_min_traffic: r.durationMinTraffic,
          tolls_brl: r.tollsBRL,
          steps: r.steps,
        },
        { onConflict: "company_id,origin_id" }
      );
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, companies.length) }, () =>
      worker()
    )
  );
}

export async function backfillOriginRoutesManualAction(
  originId: string
): Promise<{ ok: true } | { error: string }> {
  await requireAdmin();
  try {
    void backfillOriginRoutes(originId).catch((e) => {
      console.error(`[backfillOriginRoutesManual] ${e}`);
    });
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao iniciar backfill." };
  }
}

export async function listOriginsForAdminAction() {
  await requireAdmin();
  return listOriginsAdmin();
}
