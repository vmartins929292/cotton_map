import type { Origin } from "@/data/types";

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calcula distancia em LINHA RETA (Haversine) por origem. Usado apenas como fallback
 * residual: as distancias reais via Google sao gravadas em company_routes durante o
 * cadastro. Se nao houver rota cacheada, o card exibe esses numeros prefixados com "~".
 */
export function computeDistancesByOrigin(
  lat: number,
  lng: number,
  origins: Origin[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of origins) {
    out[o.id] = Math.round(haversine(lat, lng, o.lat, o.lng));
  }
  return out;
}
