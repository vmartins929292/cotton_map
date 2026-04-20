import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import OriginForm from "@/components/origin-form";

export const dynamic = "force-dynamic";

export default async function AdminNewOriginPage() {
  await requireAdmin();
  return (
    <div className="space-y-4 max-w-3xl">
      <Link
        href="/admin/origens"
        className="inline-flex items-center gap-1 text-[12px] font-semibold hover:opacity-80"
        style={{ color: "var(--accent2)" }}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar para origens
      </Link>

      <div
        className="rounded-xl p-5"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
      >
        <h2
          className="text-xl font-bold mb-1"
          style={{ fontFamily: "'Playfair Display', serif", color: "var(--accent-dark)" }}
        >
          Nova origem de rota
        </h2>
        <p className="text-[12px] mb-4" style={{ color: "var(--text-dim)" }}>
          Defina um ponto de origem (fazenda, porto, CD, escritório etc.). Ele aparecera
          como chip clicavel no card de cada empresa, com a distancia e o tempo reais
          calculados via Google.
        </p>
        <OriginForm mode="create" />
      </div>
    </div>
  );
}
