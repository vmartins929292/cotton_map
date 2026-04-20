/**
 * Seed inicial: popula a tabela `companies` no Supabase a partir de data/companies.ts.
 *
 * Uso:
 *   1. Garanta NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local
 *   2. npm run seed
 *
 * Este script faz upsert por id, entao pode rodar mais de uma vez sem duplicar.
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();
import { createClient } from "@supabase/supabase-js";
import { companies } from "../data/companies";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log(`Preparando upsert de ${companies.length} empresas...`);

  const rows = companies.map((c) => ({
    id: c.id,
    name: c.name,
    group: c.group,
    city: c.city,
    state: c.state,
    region: c.region,
    lat: c.lat,
    lng: c.lng,
    type: c.type,
    description: c.desc,
    products: c.products,
    capacity: c.capacity,
    bci: c.bci,
    site: c.site,
    contact: c.contact,
    email: c.email,
    address: c.address,
    published: true,
    status: c.status ?? "frio",
    priority: c.priority ?? "media",
  }));

  // Lotes de 100 (Supabase limita ~1000 rows por insert via PostgREST).
  const batchSize = 100;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from("companies").upsert(batch, { onConflict: "id" });
    if (error) {
      console.error(`Erro no lote ${i}-${i + batch.length}:`, error.message);
      process.exit(1);
    }
    inserted += batch.length;
    console.log(`  ${inserted}/${rows.length} ok`);
  }

  const { count } = await supabase.from("companies").select("*", { count: "exact", head: true });
  console.log(`\nSeed concluido. Total no banco: ${count}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
