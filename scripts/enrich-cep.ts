/**
 * Enriquece a tabela `companies` com CEP, rua, numero, bairro e coordenadas
 * precisas usando a Google Places API (New) - Text Search por nome+cidade+UF.
 *
 * Uso:
 *   npm run enrich:cep                 # padrao: --only-empty (so empresas sem cep)
 *   npm run enrich:cep -- --force      # reprocessa todas as 73 (sobrescreve cep ja preenchido)
 *   npm run enrich:cep -- --dry-run    # nao escreve no banco, so imprime
 *   npm run enrich:cep -- --yes        # pula confirmacao interativa
 *
 * Variaveis necessarias em .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GOOGLE_MAPS_API_KEY
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { haversine } from "../lib/distance";
import { DEFAULT_ORIGINS } from "../data/types";

// ======================================================================
// CLI args
// ======================================================================

const argv = process.argv.slice(2);
const FORCE = argv.includes("--force");
const DRY_RUN = argv.includes("--dry-run");
const SKIP_CONFIRM = argv.includes("--yes") || argv.includes("-y");
const ONLY_EMPTY = !FORCE;

// ======================================================================
// Env
// ======================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const googleKey = process.env.GOOGLE_MAPS_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local"
  );
  process.exit(1);
}
if (!googleKey) {
  console.error("Falta GOOGLE_MAPS_API_KEY no .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ======================================================================
// Tipos
// ======================================================================

type CompanyRow = {
  id: string;
  name: string;
  group: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  address: string;
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
};

type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type GooglePlace = {
  id?: string;
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  addressComponents?: GoogleAddressComponent[];
  displayName?: { text?: string };
};

type GoogleSearchResp = {
  places?: GooglePlace[];
  error?: { message?: string; status?: string };
};

type ParsedPlace = {
  street: string;
  number: string;
  neighborhood: string;
  cep: string;
  city: string;
  state: string;
  formattedAddress: string;
  lat: number;
  lng: number;
};

type Outcome =
  | { kind: "ok"; company: CompanyRow; parsed: ParsedPlace; deltaKm: number }
  | { kind: "warn_far"; company: CompanyRow; parsed: ParsedPlace; deltaKm: number }
  | { kind: "warn_no_cep"; company: CompanyRow; parsed: ParsedPlace; deltaKm: number }
  | { kind: "not_found"; company: CompanyRow; reason: string }
  | { kind: "skipped"; company: CompanyRow; reason: string };

// ======================================================================
// Origens (Sapezal/Sorriso/LEM) para recalculo das distancias
// ======================================================================

const SAPEZAL = DEFAULT_ORIGINS.find((o) => o.id === "sapezal")!;
const SORRISO = DEFAULT_ORIGINS.find((o) => o.id === "sorriso")!;
const LEM = DEFAULT_ORIGINS.find((o) => o.id === "lem")!;

// ======================================================================
// Address parser (copia do app/api/places/details/route.ts)
// ======================================================================

function extractAddressParts(components: GoogleAddressComponent[] | undefined) {
  const parts = {
    street: "",
    number: "",
    neighborhood: "",
    cep: "",
    city: "",
    state: "",
  };
  if (!components || components.length === 0) return parts;

  function pick(types: string[], opts: { short?: boolean } = {}): string {
    for (const c of components!) {
      if (!c.types) continue;
      if (types.some((t) => c.types!.includes(t))) {
        return (opts.short ? c.shortText : c.longText) ?? c.longText ?? "";
      }
    }
    return "";
  }

  parts.street = pick(["route"]);
  parts.number = pick(["street_number"]);
  parts.neighborhood = pick([
    "sublocality_level_1",
    "sublocality",
    "neighborhood",
  ]);
  parts.cep = pick(["postal_code"]);
  parts.city = pick(["locality", "administrative_area_level_2"]);
  parts.state = pick(["administrative_area_level_1"], { short: true });

  return parts;
}

// ======================================================================
// Places API Text Search
// ======================================================================

async function placesSearchText(query: string): Promise<GooglePlace | null> {
  const res = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleKey!,
        "X-Goog-FieldMask":
          "places.id,places.formattedAddress,places.location,places.addressComponents,places.displayName",
      },
      body: JSON.stringify({
        textQuery: query,
        regionCode: "BR",
        languageCode: "pt-BR",
        maxResultCount: 1,
      }),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Places HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as GoogleSearchResp;
  if (data.error) {
    throw new Error(
      `Places API: ${data.error.message ?? data.error.status ?? "unknown"}`
    );
  }
  return data.places?.[0] ?? null;
}

// ======================================================================
// Helpers
// ======================================================================

function pad(n: number, width: number): string {
  return String(n).padStart(width, " ");
}

function formatCep(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 8) return raw;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function buildAddressLabel(p: ParsedPlace, fallbackName: string): string {
  // Se a Google ja retornou um formattedAddress decente, prefere ele.
  if (p.formattedAddress && p.formattedAddress.length > 0) {
    return p.formattedAddress;
  }
  const left = [p.street, p.number].filter(Boolean).join(", ");
  const mid = [p.neighborhood].filter(Boolean).join(" — ");
  const right = [`${p.city}/${p.state}`, p.cep && `CEP ${p.cep}`]
    .filter(Boolean)
    .join(", ");
  return [left, mid, right].filter(Boolean).join(" — ") || fallbackName;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function confirm(message: string): Promise<boolean> {
  if (SKIP_CONFIRM) return true;
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(`${message} [y/N] `);
  rl.close();
  return answer.trim().toLowerCase().startsWith("y");
}

// ======================================================================
// Main
// ======================================================================

async function main() {
  console.log("=".repeat(70));
  console.log("ENRIQUECIMENTO DE EMPRESAS COM CEP");
  console.log("=".repeat(70));
  console.log(`Modo:           ${DRY_RUN ? "DRY-RUN (nao grava)" : "EXECUCAO"}`);
  console.log(`Filtro:         ${ONLY_EMPTY ? "apenas sem CEP" : "TODAS (--force)"}`);
  console.log("");

  // 1) Carregar empresas do banco
  const cols =
    'id,name,"group",city,state,lat,lng,address,cep,street,"number",neighborhood';
  const { data: rows, error } = await supabase
    .from("companies")
    .select(cols)
    .order("name", { ascending: true });
  if (error) {
    console.error("Erro ao listar companies:", error.message);
    process.exit(1);
  }
  const allCompanies = (rows ?? []) as CompanyRow[];
  const targets = ONLY_EMPTY
    ? allCompanies.filter((c) => !c.cep || c.cep.trim() === "")
    : allCompanies;

  console.log(
    `Encontradas ${allCompanies.length} empresas no banco. Vou processar ${targets.length}.`
  );
  if (targets.length === 0) {
    console.log("Nada a fazer. Saindo.");
    return;
  }

  // 2) Backup
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 16);
  const backupDir = resolve(process.cwd(), "scripts/backups");
  mkdirSync(backupDir, { recursive: true });
  const backupPath = resolve(backupDir, `companies-${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify(allCompanies, null, 2), "utf8");
  console.log(`Backup salvo em: ${backupPath}`);
  console.log("");

  // 3) Confirmacao
  const ok = await confirm(
    `Vai consultar Places API ${targets.length}x e ${
      DRY_RUN ? "SIMULAR" : "ATUALIZAR"
    } o banco. Confirma?`
  );
  if (!ok) {
    console.log("Cancelado pelo usuario.");
    return;
  }
  console.log("");

  // 4) Loop
  const outcomes: Outcome[] = [];
  let i = 0;
  for (const company of targets) {
    i += 1;
    const prefix = `[${pad(i, String(targets.length).length)}/${targets.length}] ${company.name} (${company.city}/${company.state})`;
    console.log(prefix);

    const query = `${company.name} ${company.city} ${company.state}`;
    let place: GooglePlace | null = null;
    try {
      place = await placesSearchText(query);
    } catch (e) {
      console.log(
        `        ERRO Places: ${e instanceof Error ? e.message : String(e)}`
      );
      outcomes.push({
        kind: "not_found",
        company,
        reason: e instanceof Error ? e.message : String(e),
      });
      await sleep(200);
      continue;
    }

    if (!place || !place.location) {
      console.log("        NOT_FOUND: Places nao retornou estabelecimento");
      outcomes.push({
        kind: "not_found",
        company,
        reason: "Places retornou vazio",
      });
      await sleep(200);
      continue;
    }

    const parts = extractAddressParts(place.addressComponents);
    const parsed: ParsedPlace = {
      street: parts.street,
      number: parts.number,
      neighborhood: parts.neighborhood,
      cep: formatCep(parts.cep),
      city: parts.city,
      state: parts.state,
      formattedAddress: place.formattedAddress ?? "",
      lat: place.location.latitude,
      lng: place.location.longitude,
    };

    const deltaKm = haversine(company.lat, company.lng, parsed.lat, parsed.lng);

    // Validacao geografica: se a Google retornou algo a >100km do que estava
    // cadastrado, provavelmente eh um homonimo. Marca como WARN, nao atualiza.
    if (deltaKm > 100) {
      console.log(
        `        WARN_FAR: resultado a ${deltaKm.toFixed(1)}km do cadastrado -> nao atualiza (provavel homonimo). Endereco: ${parsed.formattedAddress}`
      );
      outcomes.push({ kind: "warn_far", company, parsed, deltaKm });
      await sleep(200);
      continue;
    }

    if (!parsed.cep) {
      console.log(
        `        WARN_NO_CEP: Google nao retornou postal_code. Endereco: ${parsed.formattedAddress}`
      );
      outcomes.push({ kind: "warn_no_cep", company, parsed, deltaKm });
      // Mesmo sem CEP, atualizamos o resto se tiver.
    } else {
      console.log(
        `        OK -> CEP ${parsed.cep}${parsed.street ? `, ${parsed.street}${parsed.number ? `, ${parsed.number}` : ""}` : ""}${parsed.neighborhood ? ` — ${parsed.neighborhood}` : ""} (delta ${deltaKm.toFixed(1)}km)`
      );
      outcomes.push({ kind: "ok", company, parsed, deltaKm });
    }

    // 5) UPDATE
    if (!DRY_RUN) {
      const newAddress = buildAddressLabel(parsed, company.address || company.name);
      const update = {
        cep: parsed.cep,
        street: parsed.street,
        number: parsed.number,
        neighborhood: parsed.neighborhood,
        address: newAddress,
        lat: parsed.lat,
        lng: parsed.lng,
        dist_sapezal: Math.round(
          haversine(parsed.lat, parsed.lng, SAPEZAL.lat, SAPEZAL.lng)
        ),
        dist_sorriso: Math.round(
          haversine(parsed.lat, parsed.lng, SORRISO.lat, SORRISO.lng)
        ),
        dist_lem: Math.round(
          haversine(parsed.lat, parsed.lng, LEM.lat, LEM.lng)
        ),
        updated_at: new Date().toISOString(),
      };
      const { error: upErr } = await supabase
        .from("companies")
        .update(update)
        .eq("id", company.id);
      if (upErr) {
        console.log(`        ERRO UPDATE: ${upErr.message}`);
      }
    }

    await sleep(200);
  }

  // 6) Relatorio
  console.log("");
  console.log("=".repeat(70));
  console.log("RELATORIO");
  console.log("=".repeat(70));

  const okCount = outcomes.filter((o) => o.kind === "ok").length;
  const warnFar = outcomes.filter((o) => o.kind === "warn_far") as Extract<
    Outcome,
    { kind: "warn_far" }
  >[];
  const warnNoCep = outcomes.filter((o) => o.kind === "warn_no_cep") as Extract<
    Outcome,
    { kind: "warn_no_cep" }
  >[];
  const notFound = outcomes.filter((o) => o.kind === "not_found") as Extract<
    Outcome,
    { kind: "not_found" }
  >[];
  const bigDelta = outcomes
    .filter(
      (o): o is Extract<Outcome, { kind: "ok" }> =>
        o.kind === "ok" && o.deltaKm > 5
    )
    .sort((a, b) => b.deltaKm - a.deltaKm);

  console.log(`OK total:                       ${okCount}`);
  console.log(`WARN sem CEP (atualizado):      ${warnNoCep.length}`);
  console.log(`WARN homonimo (>100km, pulado): ${warnFar.length}`);
  console.log(`NOT_FOUND:                      ${notFound.length}`);
  console.log(`OK com delta >5km (revisar):    ${bigDelta.length}`);

  // Salva relatorio markdown
  const lines: string[] = [];
  lines.push(`# Relatorio de enriquecimento de CEP`);
  lines.push(``);
  lines.push(`Gerado em: ${new Date().toISOString()}`);
  lines.push(`Modo: ${DRY_RUN ? "DRY-RUN" : "EXECUCAO"}`);
  lines.push(``);
  lines.push(`## Resumo`);
  lines.push(`- OK: ${okCount}`);
  lines.push(`- WARN sem CEP: ${warnNoCep.length}`);
  lines.push(`- WARN homonimo: ${warnFar.length}`);
  lines.push(`- NOT_FOUND: ${notFound.length}`);
  lines.push(``);

  if (notFound.length > 0) {
    lines.push(`## NOT_FOUND (revisar manualmente em /admin/empresas/[id])`);
    for (const o of notFound) {
      lines.push(`- **${o.company.name}** (${o.company.city}/${o.company.state}) — ${o.reason}`);
    }
    lines.push(``);
  }
  if (warnFar.length > 0) {
    lines.push(`## WARN homonimo (resultado da Google a >100km, NAO foi atualizado)`);
    for (const o of warnFar) {
      lines.push(
        `- **${o.company.name}** (${o.company.city}/${o.company.state}) -> Google sugeriu: ${o.parsed.formattedAddress} (delta ${o.deltaKm.toFixed(1)}km)`
      );
    }
    lines.push(``);
  }
  if (warnNoCep.length > 0) {
    lines.push(`## WARN sem CEP (atualizamos o resto, mas sem CEP)`);
    for (const o of warnNoCep) {
      lines.push(
        `- **${o.company.name}** (${o.company.city}/${o.company.state}) -> ${o.parsed.formattedAddress}`
      );
    }
    lines.push(``);
  }
  if (bigDelta.length > 0) {
    lines.push(`## Coordenadas mudaram >5km (revisar se faz sentido)`);
    for (const o of bigDelta) {
      lines.push(
        `- **${o.company.name}** (${o.company.city}/${o.company.state}) -> delta ${o.deltaKm.toFixed(1)}km, novo CEP ${o.parsed.cep}`
      );
    }
    lines.push(``);
  }

  const reportPath = resolve(backupDir, `enrich-cep-report-${stamp}.md`);
  writeFileSync(reportPath, lines.join("\n"), "utf8");
  console.log("");
  console.log(`Relatorio detalhado salvo em: ${reportPath}`);

  if (DRY_RUN) {
    console.log("");
    console.log("DRY-RUN: nada foi gravado. Rode sem --dry-run para aplicar.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
