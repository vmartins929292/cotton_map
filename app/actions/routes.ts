"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { decodePolyline } from "@/lib/polyline";
import { computeRouteV2, type RouteStep } from "@/lib/routes-v2";
import { routeCacheKey, type LatLng } from "@/lib/route-cache";
import { listOriginsAdmin, getOriginById } from "@/lib/origins";

export type RouteResult = {
  coords: [number, number][];
  distanceKm: number;
  durationMin: number;
  durationMinTraffic: number | null;
  tollsBRL: number | null;
  steps: RouteStep[];
};

export type RouteAlternative = RouteResult & { label: string };

export type CustomRouteResult = RouteResult & {
  origin: { lat: number; lng: number; label: string };
  destination: { lat: number; lng: number; label: string };
  waypoints: Array<{ lat: number; lng: number; label: string }>;
  alternatives: RouteAlternative[];
};

export type RouteResponse = RouteResult | { error: string };
export type CustomRouteResponse = CustomRouteResult | { error: string };

// =====================================================
// getRouteAction — origem cadastrada (qualquer Origin do banco) + destino = empresa
// =====================================================
export async function getRouteAction(
  companyId: string,
  originId: string
): Promise<RouteResponse> {
  if (!companyId) return { error: "ID da empresa nao informado." };
  if (!originId) return { error: "Origem nao informada." };

  const origin = await getOriginById(originId);
  if (!origin) return { error: "Origem nao encontrada." };

  const db = createSupabaseAdminClient();

  // 1) Cache
  const cached = await db
    .from("company_routes")
    .select(
      "polyline, distance_km, duration_min, duration_min_traffic, tolls_brl, steps"
    )
    .eq("company_id", companyId)
    .eq("origin_id", origin.id)
    .maybeSingle();

  if (cached.error) {
    return {
      error: `Falha ao consultar cache de rotas: ${cached.error.message}`,
    };
  }

  if (cached.data) {
    return {
      coords: decodePolyline(cached.data.polyline),
      distanceKm: Number(cached.data.distance_km),
      durationMin: Number(cached.data.duration_min),
      durationMinTraffic:
        cached.data.duration_min_traffic != null
          ? Number(cached.data.duration_min_traffic)
          : null,
      tollsBRL:
        cached.data.tolls_brl != null ? Number(cached.data.tolls_brl) : null,
      steps: (cached.data.steps as RouteStep[] | null) ?? [],
    };
  }

  // 2) Cache miss -> empresa
  const company = await db
    .from("companies")
    .select("lat, lng")
    .eq("id", companyId)
    .maybeSingle();

  if (company.error) {
    return { error: `Falha ao buscar empresa: ${company.error.message}` };
  }
  if (!company.data) {
    return { error: "Empresa nao encontrada." };
  }
  const { lat, lng } = company.data;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: "Empresa sem coordenadas (lat/lng) definidas." };
  }

  // 3) Routes v2
  const result = await computeRouteV2({
    origin: { lat: origin.lat, lng: origin.lng },
    destination: { lat, lng },
    withAlternatives: false,
  });

  if ("error" in result) return { error: result.error };
  const r = result.primary;

  // 4) Persiste cache
  await db.from("company_routes").upsert(
    {
      company_id: companyId,
      origin_id: origin.id,
      polyline: r.polyline,
      distance_km: r.distanceKm,
      duration_min: r.durationMin,
      duration_min_traffic: r.durationMinTraffic,
      tolls_brl: r.tollsBRL,
      steps: r.steps,
    },
    { onConflict: "company_id,origin_id" }
  );

  return {
    coords: decodePolyline(r.polyline),
    distanceKm: r.distanceKm,
    durationMin: r.durationMin,
    durationMinTraffic: r.durationMinTraffic,
    tollsBRL: r.tollsBRL,
    steps: r.steps,
  };
}

// =====================================================
// recomputeCompanyRoutesAction — calcula TODAS as rotas (origens cadastradas)
// para uma empresa e grava no cache. Chamado no save da empresa.
// =====================================================
export type RecomputeResult = {
  ok: true;
  computed: number;
  failed: Array<{ originId: string; originName: string; error: string }>;
};

export async function recomputeCompanyRoutesAction(
  companyId: string
): Promise<RecomputeResult | { error: string }> {
  if (!companyId) return { error: "companyId obrigatorio." };

  const db = createSupabaseAdminClient();
  const company = await db
    .from("companies")
    .select("lat, lng")
    .eq("id", companyId)
    .maybeSingle();
  if (company.error) {
    return { error: `Falha ao buscar empresa: ${company.error.message}` };
  }
  if (!company.data) return { error: "Empresa nao encontrada." };
  const { lat, lng } = company.data;
  if (
    lat == null ||
    lng == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return { error: "Empresa sem coordenadas (lat/lng) definidas." };
  }

  const origins = await listOriginsAdmin();
  if (origins.length === 0) return { ok: true, computed: 0, failed: [] };

  // Concorrencia controlada (Routes API: ~5s por chamada).
  const CONCURRENCY = 5;
  let cursor = 0;
  let computed = 0;
  const failed: Array<{ originId: string; originName: string; error: string }> = [];

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= origins.length) return;
      const o = origins[i];
      const res = await computeRouteV2({
        origin: { lat: o.lat, lng: o.lng },
        destination: { lat, lng },
        withAlternatives: false,
      });
      if ("error" in res) {
        failed.push({ originId: o.id, originName: o.name, error: res.error });
        continue;
      }
      const r = res.primary;
      const up = await db.from("company_routes").upsert(
        {
          company_id: companyId,
          origin_id: o.id,
          polyline: r.polyline,
          distance_km: r.distanceKm,
          duration_min: r.durationMin,
          duration_min_traffic: r.durationMinTraffic,
          tolls_brl: r.tollsBRL,
          steps: r.steps,
        },
        { onConflict: "company_id,origin_id" }
      );
      if (up.error) {
        failed.push({
          originId: o.id,
          originName: o.name,
          error: `upsert: ${up.error.message}`,
        });
        continue;
      }
      computed++;
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, origins.length) }, () =>
      worker()
    )
  );

  return { ok: true, computed, failed };
}

// =====================================================
// invalidateCompanyRoutesAction — apaga cache antigo da empresa
// (chamado quando lat/lng/endereco muda no update)
// =====================================================
export async function invalidateCompanyRoutesAction(
  companyId: string
): Promise<{ ok: true } | { error: string }> {
  if (!companyId) return { error: "companyId obrigatorio." };
  const db = createSupabaseAdminClient();
  const { error } = await db
    .from("company_routes")
    .delete()
    .eq("company_id", companyId);
  if (error) return { error: `invalidate: ${error.message}` };
  return { ok: true };
}

// =====================================================
// getCustomRouteAction — origem livre + destino livre + waypoints
// (mantido sem mudanca relevante; apenas usa cache de custom_routes)
// =====================================================
export type CustomRouteInput = {
  origin: { lat: number; lng: number; label?: string };
  destination: {
    companyId?: string | null;
    lat?: number;
    lng?: number;
    label?: string;
  };
  waypoints?: Array<{ lat: number; lng: number; label?: string }>;
  withAlternatives?: boolean;
};

function isFiniteCoord(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export async function getCustomRouteAction(
  input: CustomRouteInput
): Promise<CustomRouteResponse> {
  if (!isFiniteCoord(input.origin?.lat) || !isFiniteCoord(input.origin?.lng)) {
    return { error: "Origem invalida (lat/lng obrigatorios)." };
  }

  const db = createSupabaseAdminClient();

  let destLat: number;
  let destLng: number;
  let destLabel = input.destination.label ?? "";

  if (input.destination.companyId) {
    const company = await db
      .from("companies")
      .select("name, city, state, lat, lng")
      .eq("id", input.destination.companyId)
      .maybeSingle();
    if (company.error) {
      return { error: `Falha ao buscar empresa: ${company.error.message}` };
    }
    if (!company.data) return { error: "Empresa de destino nao encontrada." };
    if (!isFiniteCoord(company.data.lat) || !isFiniteCoord(company.data.lng)) {
      return { error: "Empresa de destino sem coordenadas." };
    }
    destLat = company.data.lat;
    destLng = company.data.lng;
    destLabel ||= `${company.data.name} — ${company.data.city}/${company.data.state}`;
  } else if (
    isFiniteCoord(input.destination.lat) &&
    isFiniteCoord(input.destination.lng)
  ) {
    destLat = input.destination.lat;
    destLng = input.destination.lng;
  } else {
    return { error: "Destino invalido (informe companyId ou lat/lng)." };
  }

  const waypoints = (input.waypoints ?? []).filter(
    (w) => isFiniteCoord(w.lat) && isFiniteCoord(w.lng)
  );
  if (waypoints.length > 8) {
    return { error: "Maximo de 8 paradas intermediarias." };
  }

  const originLatLng: LatLng = { lat: input.origin.lat, lng: input.origin.lng };
  const destLatLng: LatLng = { lat: destLat, lng: destLng };
  const wptsLatLng: LatLng[] = waypoints.map((w) => ({ lat: w.lat, lng: w.lng }));

  const cacheKey = routeCacheKey(originLatLng, destLatLng, wptsLatLng);

  if (!input.withAlternatives) {
    const cached = await db
      .from("custom_routes")
      .select(
        "polyline, distance_km, duration_min, duration_min_traffic, tolls_brl, steps, origin_label, dest_label"
      )
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (cached.data) {
      return {
        coords: decodePolyline(cached.data.polyline),
        distanceKm: Number(cached.data.distance_km),
        durationMin: Number(cached.data.duration_min),
        durationMinTraffic:
          cached.data.duration_min_traffic != null
            ? Number(cached.data.duration_min_traffic)
            : null,
        tollsBRL:
          cached.data.tolls_brl != null ? Number(cached.data.tolls_brl) : null,
        steps: (cached.data.steps as RouteStep[] | null) ?? [],
        origin: {
          lat: originLatLng.lat,
          lng: originLatLng.lng,
          label: cached.data.origin_label ?? input.origin.label ?? "",
        },
        destination: {
          lat: destLat,
          lng: destLng,
          label: cached.data.dest_label ?? destLabel,
        },
        waypoints: waypoints.map((w) => ({
          lat: w.lat,
          lng: w.lng,
          label: w.label ?? "",
        })),
        alternatives: [],
      };
    }
  }

  const result = await computeRouteV2({
    origin: originLatLng,
    destination: destLatLng,
    waypoints: wptsLatLng,
    withAlternatives: input.withAlternatives ?? true,
  });
  if ("error" in result) return { error: result.error };

  const r = result.primary;
  const alternatives: RouteAlternative[] = result.alternatives.map((a, i) => ({
    coords: decodePolyline(a.polyline),
    distanceKm: a.distanceKm,
    durationMin: a.durationMin,
    durationMinTraffic: a.durationMinTraffic,
    tollsBRL: a.tollsBRL,
    steps: a.steps,
    label: a.routeLabels?.[0] ?? `Alternativa ${i + 1}`,
  }));

  await db.from("custom_routes").upsert(
    {
      cache_key: cacheKey,
      origin_lat: originLatLng.lat,
      origin_lng: originLatLng.lng,
      origin_label: input.origin.label ?? "",
      dest_company_id: input.destination.companyId ?? null,
      dest_lat: destLat,
      dest_lng: destLng,
      dest_label: destLabel,
      waypoints: waypoints.map((w) => ({
        lat: w.lat,
        lng: w.lng,
        label: w.label ?? "",
      })),
      polyline: r.polyline,
      distance_km: r.distanceKm,
      duration_min: r.durationMin,
      duration_min_traffic: r.durationMinTraffic,
      tolls_brl: r.tollsBRL,
      steps: r.steps,
    },
    { onConflict: "cache_key" }
  );

  return {
    coords: decodePolyline(r.polyline),
    distanceKm: r.distanceKm,
    durationMin: r.durationMin,
    durationMinTraffic: r.durationMinTraffic,
    tollsBRL: r.tollsBRL,
    steps: r.steps,
    origin: {
      lat: originLatLng.lat,
      lng: originLatLng.lng,
      label: input.origin.label ?? "",
    },
    destination: { lat: destLat, lng: destLng, label: destLabel },
    waypoints: waypoints.map((w) => ({
      lat: w.lat,
      lng: w.lng,
      label: w.label ?? "",
    })),
    alternatives,
  };
}
