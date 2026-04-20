"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, clearAdminSessionCookie } from "@/lib/admin-auth";
import {
  createCompany,
  updateCompany,
  deleteCompany,
  setCompanyPublished,
  setCompanyStatusAndPriority,
  getCompanyById,
  type CompanyInput,
} from "@/lib/companies";
import {
  recomputeCompanyRoutesAction,
  invalidateCompanyRoutesAction,
} from "@/app/actions/routes";
import type { CompanyType, Region, CompanyStatus, CompanyPriority } from "@/data/types";
import type { SaveState } from "./types";

const VALID_TYPES = new Set<CompanyType>(["fiacao", "integrada", "denim", "malharia", "comercial"]);
const VALID_REGIONS = new Set<Region>(["NE", "SE", "S", "CO"]);
const VALID_STATUS = new Set<CompanyStatus>(["frio", "morno", "quente", "cliente", "descartado"]);
const VALID_PRIORITY = new Set<CompanyPriority>(["alta", "media", "baixa"]);

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type ParsedForm = Omit<CompanyInput, "lat" | "lng"> & {
  lat: number | null;
  lng: number | null;
};

function parseForm(formData: FormData): ParsedForm {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const getBool = (k: string) => formData.get(k) === "on" || formData.get(k) === "true";

  const name = get("name");
  const idRaw = get("id");
  const id = idRaw || slugify(`${name}-${get("city")}`);

  const type = get("type") as CompanyType;
  const region = get("region") as Region;

  if (!VALID_TYPES.has(type)) throw new Error(`Tipo invalido: ${type}`);
  if (!VALID_REGIONS.has(region)) throw new Error(`Regiao invalida: ${region}`);

  const latStr = get("lat");
  const lngStr = get("lng");
  const lat = latStr ? Number(latStr) : null;
  const lng = lngStr ? Number(lngStr) : null;
  const latOk = lat != null && Number.isFinite(lat);
  const lngOk = lng != null && Number.isFinite(lng);

  const statusRaw = get("status") as CompanyStatus;
  const priorityRaw = get("priority") as CompanyPriority;
  const status: CompanyStatus = VALID_STATUS.has(statusRaw) ? statusRaw : "frio";
  const priority: CompanyPriority = VALID_PRIORITY.has(priorityRaw) ? priorityRaw : "media";

  return {
    id,
    name,
    group: get("group"),
    city: get("city"),
    state: get("state").toUpperCase(),
    region,
    lat: latOk ? (lat as number) : null,
    lng: lngOk ? (lng as number) : null,
    type,
    desc: get("desc"),
    products: get("products"),
    capacity: get("capacity"),
    bci: getBool("bci"),
    site: get("site"),
    contact: get("contact"),
    email: get("email"),
    address: get("address"),
    status,
    priority,
    published: formData.has("published") ? getBool("published") : true,
  };
}

export async function saveCompanyAction(
  mode: "create" | "update",
  originalId: string | null,
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  await requireAdmin();
  let parsed: ParsedForm;
  try {
    parsed = parseForm(formData);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Dados invalidos." };
  }

  let { lat, lng } = parsed;
  if (lat == null || lng == null) {
    if (!parsed.address || parsed.address.trim().length < 5) {
      return {
        error:
          "Endereco obrigatorio para localizar a empresa no mapa (rua, numero, cidade/UF, CEP).",
      };
    }
    const geo = await geocodeAddress(parsed.address);
    if ("error" in geo) {
      return {
        error: `Nao consegui localizar o endereco no Google Maps: ${geo.error}. Refine o endereco (inclua cidade/UF e CEP) e tente novamente.`,
      };
    }
    lat = geo.lat;
    lng = geo.lng;
  }

  const company: CompanyInput = { ...parsed, lat, lng };

  // Detecta se as coordenadas mudaram (no update) — se sim, invalida cache antigo.
  let coordsChanged = mode === "create";
  let savedId: string;
  try {
    if (mode === "create") {
      const created = await createCompany(company);
      savedId = created.id;
    } else {
      const targetId = originalId ?? company.id;
      const previous = await getCompanyById(targetId);
      if (previous && (previous.lat !== lat || previous.lng !== lng)) {
        coordsChanged = true;
      }
      const updated = await updateCompany(targetId, company);
      savedId = updated.id;
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao salvar." };
  }

  // Recalcula as rotas reais (Sapezal/Sorriso/LEM + extras) automaticamente.
  // Em update, so recalcula se as coordenadas mudaram (rotas existentes ainda sao validas).
  if (coordsChanged) {
    if (mode === "update") {
      await invalidateCompanyRoutesAction(savedId);
    }
    const recompute = await recomputeCompanyRoutesAction(savedId);
    if ("error" in recompute) {
      // Nao bloqueia o save: a empresa esta gravada, so as rotas falharam.
      // O dashboard cai no fallback Haversine (~) e o admin pode tentar recalcular depois.
      console.error(
        `[saveCompanyAction] Falha no recompute de rotas para ${savedId}: ${recompute.error}`
      );
    }
  }

  revalidatePath("/");
  revalidatePath("/empresas");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function deleteCompanyAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteCompany(id);
  revalidatePath("/");
  revalidatePath("/empresas");
  revalidatePath("/admin");
}

/**
 * Recalcula manualmente todas as rotas (Sapezal/Sorriso/LEM + extras) de uma empresa.
 * Util quando o admin quer forcar a atualizacao mesmo sem mudar o endereco.
 */
export async function recomputeCompanyRoutesManualAction(
  companyId: string
): Promise<{ ok: true; computed: number } | { error: string }> {
  await requireAdmin();
  await invalidateCompanyRoutesAction(companyId);
  const res = await recomputeCompanyRoutesAction(companyId);
  if ("error" in res) return { error: res.error };
  revalidatePath("/");
  revalidatePath("/empresas");
  revalidatePath("/admin");
  revalidatePath(`/admin/empresas/${companyId}`);
  return { ok: true, computed: res.computed };
}

export async function togglePublishedAction(id: string, published: boolean): Promise<void> {
  await requireAdmin();
  await setCompanyPublished(id, published);
  revalidatePath("/");
  revalidatePath("/empresas");
  revalidatePath("/admin");
}

export async function updateStatusPriorityAction(
  id: string,
  patch: { status?: CompanyStatus; priority?: CompanyPriority }
): Promise<void> {
  await requireAdmin();
  if (patch.status && !VALID_STATUS.has(patch.status)) throw new Error("Status invalido.");
  if (patch.priority && !VALID_PRIORITY.has(patch.priority)) throw new Error("Prioridade invalida.");
  await setCompanyStatusAndPriority(id, patch);
  revalidatePath("/admin");
  revalidatePath(`/admin/empresas/${id}`);
}

export async function logoutAction(): Promise<void> {
  await clearAdminSessionCookie();
  redirect("/admin/login");
}

type GeocodeResult = { lat: number; lng: number; displayName: string };

async function geocodeAddress(address: string): Promise<GeocodeResult | { error: string }> {
  if (!address || address.trim().length < 5) {
    return { error: "Endereco muito curto." };
  }
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return {
      error: "GOOGLE_MAPS_API_KEY nao configurada no .env.local",
    };
  }
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&region=br&language=pt-BR&key=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return { error: `Geocoding HTTP ${res.status}` };
    const data = (await res.json()) as {
      status: string;
      error_message?: string;
      results: Array<{
        geometry: { location: { lat: number; lng: number } };
        formatted_address: string;
      }>;
    };
    if (data.status !== "OK" || data.results.length === 0) {
      return { error: data.error_message ?? data.status ?? "Endereco nao encontrado." };
    }
    const hit = data.results[0];
    return {
      lat: hit.geometry.location.lat,
      lng: hit.geometry.location.lng,
      displayName: hit.formatted_address,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao geocodificar." };
  }
}

export async function geocodeAddressAction(
  address: string
): Promise<GeocodeResult | { error: string }> {
  await requireAdmin();
  return geocodeAddress(address);
}
