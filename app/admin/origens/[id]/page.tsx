import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { getOriginById } from "@/lib/origins";
import OriginForm from "@/components/origin-form";

export const dynamic = "force-dynamic";

export default async function AdminEditOriginPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const origin = await getOriginById(id);
  if (!origin) notFound();

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
          className="text-xl font-bold"
          style={{ fontFamily: "'Playfair Display', serif", color: "var(--accent-dark)" }}
        >
          Editar origem: {origin.name}
        </h2>
        <p className="text-[11px] mb-4" style={{ color: "var(--text-dim)" }}>
          {origin.isDefault
            ? "Origem padrão — não pode ser excluida. Mudancas em lat/lng disparam recalculo de todas as rotas em background."
            : "Mudancas em lat/lng disparam recalculo das rotas dessa origem em background."}
        </p>
        <OriginForm mode="update" initialData={origin} />
      </div>
    </div>
  );
}
