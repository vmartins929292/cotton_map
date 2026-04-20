import { createHash } from "node:crypto";

export type LatLng = { lat: number; lng: number };

/**
 * Gera uma chave de cache estavel para uma rota custom.
 * Arredonda coordenadas em 5 casas (~1m) para evitar misses por jitter.
 */
export function routeCacheKey(
  origin: LatLng,
  destination: LatLng,
  waypoints: LatLng[] = []
): string {
  const round = (n: number) => Math.round(n * 1e5) / 1e5;
  const pieces = [
    `o:${round(origin.lat)},${round(origin.lng)}`,
    `d:${round(destination.lat)},${round(destination.lng)}`,
    `w:${waypoints
      .map((w) => `${round(w.lat)},${round(w.lng)}`)
      .join("|")}`,
  ];
  return createHash("sha1").update(pieces.join(";")).digest("hex");
}
