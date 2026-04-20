import { Company, REGION_LABELS, STATE_NAMES, TYPE_LABELS } from "@/data/types";

export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function buildSearchHaystack(c: Company): string {
  return normalize(
    [
      c.name,
      c.group,
      c.city,
      c.state,
      STATE_NAMES[c.state] ?? "",
      c.region,
      REGION_LABELS[c.region] ?? "",
      TYPE_LABELS[c.type] ?? "",
      c.products,
      c.address,
      c.contact,
      c.email,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export function matchesSearch(c: Company, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const haystack = buildSearchHaystack(c);
  const terms = q.split(/\s+/).filter(Boolean);
  return terms.every((term) => haystack.includes(term));
}
