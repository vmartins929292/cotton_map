import "server-only";
import type { RouteStep } from "@/lib/route-types";
export type { RouteStep } from "@/lib/route-types";

export type LatLng = { lat: number; lng: number };

export type RouteV2Result = {
  polyline: string;
  distanceKm: number;
  durationMin: number;
  durationMinTraffic: number | null;
  tollsBRL: number | null;
  steps: RouteStep[];
  routeLabels: string[];
};

export type RouteV2Response =
  | { primary: RouteV2Result; alternatives: RouteV2Result[] }
  | { error: string };

const ROUTES_URL =
  "https://routes.googleapis.com/directions/v2:computeRoutes";

const FIELD_MASK = [
  "routes.duration",
  "routes.staticDuration",
  "routes.distanceMeters",
  "routes.polyline.encodedPolyline",
  "routes.legs.steps.navigationInstruction",
  "routes.legs.steps.distanceMeters",
  "routes.travelAdvisory.tollInfo",
  "routes.routeLabels",
].join(",");

type GoogleStep = {
  navigationInstruction?: { instructions?: string; maneuver?: string };
  distanceMeters?: number;
};

type GoogleLeg = { steps?: GoogleStep[] };

type GoogleTollPrice = {
  units?: string | number;
  nanos?: number;
  currencyCode?: string;
};

type GoogleRoute = {
  duration?: string; // "1234s"
  staticDuration?: string;
  distanceMeters?: number;
  polyline?: { encodedPolyline?: string };
  legs?: GoogleLeg[];
  travelAdvisory?: {
    tollInfo?: {
      estimatedPrice?: GoogleTollPrice[];
    };
  };
  routeLabels?: string[];
};

type GoogleResponse = {
  routes?: GoogleRoute[];
  error?: { code?: number; message?: string; status?: string };
};

function parseDuration(s?: string): number | null {
  if (!s) return null;
  const m = s.match(/^([\d.]+)s$/);
  if (!m) return null;
  return Math.round(Number(m[1]) / 60);
}

function priceToBRL(prices?: GoogleTollPrice[]): number | null {
  if (!prices || prices.length === 0) return null;
  // Soma todas as estimativas em BRL; converte outras moedas grosseiramente (1 USD = 5 BRL fallback).
  let total = 0;
  for (const p of prices) {
    const units = Number(p.units ?? 0);
    const nanos = Number(p.nanos ?? 0) / 1e9;
    let val = units + nanos;
    if (p.currencyCode && p.currencyCode !== "BRL") {
      // fallback simples; o ideal seria converter via API de FX
      if (p.currencyCode === "USD") val *= 5;
    }
    total += val;
  }
  return Math.round(total * 100) / 100;
}

function mapRoute(r: GoogleRoute): RouteV2Result | null {
  const polyline = r.polyline?.encodedPolyline;
  const distanceMeters = r.distanceMeters;
  if (!polyline || distanceMeters == null) return null;

  const durationStatic = parseDuration(r.staticDuration);
  const durationTraffic = parseDuration(r.duration);

  const steps: RouteStep[] = [];
  (r.legs ?? []).forEach((leg) => {
    (leg.steps ?? []).forEach((s) => {
      const inst = s.navigationInstruction?.instructions?.trim();
      if (!inst) return;
      steps.push({
        instruction: inst,
        distanceMeters: s.distanceMeters ?? 0,
        maneuver: s.navigationInstruction?.maneuver,
      });
    });
  });

  return {
    polyline,
    distanceKm: Math.round((distanceMeters / 1000) * 100) / 100,
    durationMin: durationStatic ?? durationTraffic ?? 0,
    durationMinTraffic: durationTraffic,
    tollsBRL: priceToBRL(r.travelAdvisory?.tollInfo?.estimatedPrice),
    steps,
    routeLabels: r.routeLabels ?? [],
  };
}

export async function computeRouteV2(params: {
  origin: LatLng;
  destination: LatLng;
  waypoints?: LatLng[];
  withAlternatives?: boolean;
}): Promise<RouteV2Response> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return { error: "GOOGLE_MAPS_API_KEY nao configurada no .env.local" };
  }

  const body = {
    origin: {
      location: {
        latLng: { latitude: params.origin.lat, longitude: params.origin.lng },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: params.destination.lat,
          longitude: params.destination.lng,
        },
      },
    },
    intermediates: (params.waypoints ?? []).map((w) => ({
      location: { latLng: { latitude: w.lat, longitude: w.lng } },
    })),
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    computeAlternativeRoutes: params.withAlternatives ?? false,
    extraComputations: ["TOLLS"],
    languageCode: "pt-BR",
    regionCode: "BR",
    units: "METRIC",
    polylineQuality: "OVERVIEW",
  };

  let data: GoogleResponse;
  try {
    const res = await fetch(ROUTES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 403) {
        return {
          error: `Google Routes API recusou (403). Habilite a "Routes API" no Google Cloud e ative billing. Detalhe: ${text.slice(0, 200)}`,
        };
      }
      return {
        error: `Routes API HTTP ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    data = (await res.json()) as GoogleResponse;
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Falha de rede ao chamar Routes API.",
    };
  }

  if (data.error) {
    return {
      error: `Routes API: ${data.error.message ?? data.error.status ?? "erro desconhecido"}`,
    };
  }

  const routes = data.routes ?? [];
  if (routes.length === 0) {
    return { error: "Nenhuma rota encontrada entre origem e destino." };
  }

  const mapped = routes
    .map(mapRoute)
    .filter((r): r is RouteV2Result => r !== null);

  if (mapped.length === 0) {
    return { error: "Resposta da Routes API sem polyline utilizavel." };
  }

  return {
    primary: mapped[0],
    alternatives: mapped.slice(1),
  };
}
