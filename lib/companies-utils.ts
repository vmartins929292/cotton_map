import { Company } from "@/data/types";

export function groupByState(list: Company[]): Record<string, Company[]> {
  const grouped: Record<string, Company[]> = {};
  for (const c of list) {
    if (!grouped[c.state]) grouped[c.state] = [];
    grouped[c.state].push(c);
  }
  return grouped;
}

export function uniqueGroups(list: Company[]): string[] {
  return [...new Set(list.map((c) => c.group))];
}

export function uniqueStates(list: Company[]): string[] {
  return [...new Set(list.map((c) => c.state))].sort();
}

/**
 * Ordena por distancia para uma origem. Usa rota real (Google) quando existe,
 * cai pro fallback Haversine (linha reta) quando nao. Assim a ordenacao funciona
 * mesmo antes de todas as rotas serem calculadas.
 */
export function sortByDistance(
  list: Company[],
  originId: string,
  fallbackByCompany?: Record<string, Record<string, number>>
): Company[] {
  function distOf(c: Company): number | undefined {
    return c.distancesByOrigin?.[originId] ?? fallbackByCompany?.[c.id]?.[originId];
  }
  return [...list].sort((a, b) => {
    const da = distOf(a);
    const db = distOf(b);
    if (da == null && db == null) return 0;
    if (da == null) return 1;
    if (db == null) return -1;
    return da - db;
  });
}

export function getDistance(c: Company, originId: string): number | undefined {
  return c.distancesByOrigin?.[originId];
}
