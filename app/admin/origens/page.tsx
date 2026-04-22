import Link from "next/link";
import { Plus, RefreshCcw } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { isSupabaseConfigured } from "@/lib/companies";
import { listOriginsAdmin } from "@/lib/origins";
import { originShortLabel } from "@/data/types";
import OriginRowActions from "@/components/origin-row-actions";

export const dynamic = "force-dynamic";

export default async function AdminOrigensPage() {
  await requireAdmin();

  if (!isSupabaseConfigured()) {
    return (
      <div
        className="rounded-xl p-6"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
      >
        <p className="text-[13px]" style={{ color: "var(--text)" }}>
          Configure o Supabase primeiro (veja a tela inicial do{" "}
          <Link href="/admin" className="underline" style={{ color: "var(--accent2)" }}>
            painel
          </Link>
          ).
        </p>
      </div>
    );
  }

  const origins = await listOriginsAdmin();

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2
            className="text-lg font-bold"
            style={{
              fontFamily: "'Playfair Display', serif",
              color: "var(--accent-dark)",
            }}
          >
            Origens de rota ({origins.length})
          </h2>
          <p className="text-[11px] max-w-xl" style={{ color: "var(--text-dim)" }}>
            Cada origem vira um chip clicavel no card da empresa, com a distancia real
            calculada via Google Routes API. As 3 origens default (Sapezal, Sorriso, Luis
            Eduardo Magalhaes) nao podem ser excluidas.
          </p>
        </div>
        <Link
          href="/admin/origens/new"
          className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-semibold cursor-pointer hover:opacity-90"
          style={{ background: "var(--accent)", color: "white" }}
        >
          <Plus className="w-3.5 h-3.5" />
          Nova origem
        </Link>
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
      >
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr
              style={{
                background: "rgba(31,91,58,0.06)",
                borderBottom: "2px solid var(--card-border)",
                color: "var(--text-dim)",
              }}
            >
              <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider">Cor</th>
              <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider">Nome</th>
              <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider">Slug</th>
              <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider">Endereço</th>
              <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider">Lat / Lng</th>
              <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider">Ordem</th>
              <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider">Tipo</th>
              <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-right">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {origins.map((o) => (
              <tr
                key={o.id}
                style={{ borderBottom: "1px solid var(--card-border)" }}
                className="hover:bg-black/[0.02]"
              >
                <td className="px-3 py-2.5">
                  <span
                    className="inline-block w-4 h-4 rounded-full"
                    style={{ background: o.color, border: "1px solid var(--card-border)" }}
                    aria-label={o.color}
                    title={o.color}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-semibold" style={{ color: "var(--text)" }}>
                    {o.name}
                  </div>
                  <div className="text-[10.5px]" style={{ color: "var(--text-light)" }}>
                    {originShortLabel(o)}
                  </div>
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px]" style={{ color: "var(--text-dim)" }}>
                  {o.key}
                </td>
                <td className="px-3 py-2.5 text-[11px]" style={{ color: "var(--text-dim)" }}>
                  {o.address || "—"}
                </td>
                <td className="px-3 py-2.5 font-mono text-[10.5px]" style={{ color: "var(--text-dim)" }}>
                  {o.lat.toFixed(4)}, {o.lng.toFixed(4)}
                </td>
                <td className="px-3 py-2.5 text-[11px]" style={{ color: "var(--text-dim)" }}>
                  {o.sortOrder}
                </td>
                <td className="px-3 py-2.5">
                  {o.isDefault ? (
                    <span
                      className="px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider"
                      style={{
                        background: "rgba(45,122,62,0.15)",
                        color: "var(--green)",
                      }}
                    >
                      Padrão
                    </span>
                  ) : (
                    <span
                      className="px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider"
                      style={{ background: "rgba(0,0,0,0.06)", color: "var(--text-dim)" }}
                    >
                      Extra
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <OriginRowActions originId={o.id} isDefault={o.isDefault} />
                </td>
              </tr>
            ))}
            {origins.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-8 text-center"
                  style={{ color: "var(--text-light)" }}
                >
                  Nenhuma origem cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        className="rounded-lg p-3 text-[11.5px] flex items-start gap-2"
        style={{
          background: "var(--card)",
          border: "1px solid var(--card-border)",
          color: "var(--text-dim)",
        }}
      >
        <RefreshCcw
          className="w-3.5 h-3.5 mt-0.5 shrink-0"
          style={{ color: "var(--accent)" }}
        />
        <span>
          Ao <strong>criar</strong> ou <strong>mover</strong> uma origem (lat/lng), as rotas para
          essa origem sao calculadas em segundo plano para todas as empresas (~5s por
          empresa, em paralelo). Isso pode levar minutos dependendo do tamanho da base.
        </span>
      </div>
    </div>
  );
}
