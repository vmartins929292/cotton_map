import Link from "next/link";
import { listAllCompanies, isSupabaseConfigured } from "@/lib/companies";
import { listUpcomingFollowups } from "@/lib/notes";
import { requireAdmin } from "@/lib/admin-auth";
import {
  TYPE_COLORS, TYPE_LABELS, STATE_NAMES,
  STATUS_LABELS, STATUS_COLORS,
  PRIORITY_LABELS, PRIORITY_COLORS,
  KIND_LABELS, KIND_ICONS,
  type CompanyStatus, type CompanyPriority,
} from "@/data/types";
import AdminCompanyRow from "@/components/admin-company-row";
import ExportCompaniesPdfButton from "@/components/export-companies-pdf-button";

export const dynamic = "force-dynamic";

const STATUS_KEYS: CompanyStatus[] = ["frio", "morno", "quente", "cliente", "descartado"];
const PRIORITY_KEYS: CompanyPriority[] = ["alta", "media", "baixa"];

function fmtFollowup(date: string): string {
  const d = new Date(date);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default async function AdminListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; priority?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const statusFilter = sp.status as CompanyStatus | undefined;
  const priorityFilter = sp.priority as CompanyPriority | undefined;

  if (!isSupabaseConfigured()) {
    return (
      <div
        className="rounded-xl p-6 space-y-3"
        style={{
          background: "var(--card)",
          border: "1px solid rgba(193,50,47,0.3)",
        }}
      >
        <h2 className="text-lg font-bold" style={{ color: "#c1322f" }}>
          Supabase ainda não configurado
        </h2>
        <p className="text-[13px] leading-relaxed" style={{ color: "var(--text)" }}>
          O painel administrativo precisa do Supabase para criar/editar empresas,
          contatos e notas. Enquanto não estiver configurado, o site público
          funciona com a base estática (<code className="font-mono">data/companies.ts</code>).
        </p>
        <ol className="list-decimal pl-5 space-y-1 text-[12.5px]" style={{ color: "var(--text-dim)" }}>
          <li>Crie um projeto em <a className="underline" style={{ color: "var(--accent2)" }} href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a> (free tier).</li>
          <li>Copie <code className="font-mono">.env.local.example</code> para <code className="font-mono">.env.local</code> e preencha as 3 chaves do Supabase + <code className="font-mono">ADMIN_PASSWORD</code>.</li>
          <li>No SQL Editor do Supabase, rode o conteúdo de <code className="font-mono">supabase/schema.sql</code>.</li>
          <li>Rode <code className="font-mono">npm run seed</code> para popular as 64 empresas.</li>
          <li>Reinicie o <code className="font-mono">npm run dev</code> e volte ao painel.</li>
        </ol>
      </div>
    );
  }

  const [all, followups] = await Promise.all([
    listAllCompanies(),
    listUpcomingFollowups(30).catch(() => []),
  ]);

  const list = all.filter((c) => {
    if (q) {
      const hay = [c.name, c.group, c.city, c.state, STATE_NAMES[c.state] ?? "", c.id].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (statusFilter && c.status !== statusFilter) return false;
    if (priorityFilter && c.priority !== priorityFilter) return false;
    return true;
  });

  const total = all.length;
  const published = all.filter((c) => c.published).length;
  const statusCounts = STATUS_KEYS.reduce((acc, s) => {
    acc[s] = all.filter((c) => c.status === s).length;
    return acc;
  }, {} as Record<CompanyStatus, number>);

  const overdue = followups.filter((f) => f.urgency === "atrasado");
  const thisWeek = followups.filter((f) => f.urgency === "esta_semana");

  return (
    <div className="space-y-4">
      {/* Bloco de Follow-ups */}
      {followups.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{
            background: "var(--card)",
            border: `1px solid ${overdue.length > 0 ? "rgba(193,50,47,0.4)" : "var(--card-border)"}`,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-bold" style={{ color: "var(--accent-dark)" }}>
              📅 Próximos follow-ups
              {overdue.length > 0 && (
                <span className="ml-2 text-[11px] font-bold" style={{ color: "#c1322f" }}>
                  ({overdue.length} atrasado{overdue.length > 1 ? "s" : ""})
                </span>
              )}
            </h3>
            <span className="text-[10.5px]" style={{ color: "var(--text-dim)" }}>
              próximos 30 dias
            </span>
          </div>
          <ul className="space-y-1.5">
            {[...overdue, ...thisWeek, ...followups.filter((f) => f.urgency === "futuro")].slice(0, 10).map((f) => (
              <li key={f.noteId} className="flex items-center gap-2 text-[12px]">
                <span aria-hidden>{KIND_ICONS[f.kind]}</span>
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0"
                  style={{
                    background:
                      f.urgency === "atrasado"
                        ? "rgba(193,50,47,0.15)"
                        : f.urgency === "esta_semana"
                        ? "rgba(217,119,6,0.15)"
                        : "rgba(0,0,0,0.06)",
                    color:
                      f.urgency === "atrasado"
                        ? "#c1322f"
                        : f.urgency === "esta_semana"
                        ? "#a35a04"
                        : "var(--text-dim)",
                  }}
                >
                  {fmtFollowup(f.nextFollowupAt)}
                </span>
                <Link
                  href={`/admin/empresas/${f.companyId}`}
                  className="font-semibold hover:underline truncate"
                  style={{ color: "var(--accent2)" }}
                >
                  {f.companyName}
                </Link>
                <span className="truncate" style={{ color: "var(--text-dim)" }}>
                  — {KIND_LABELS[f.kind]}: {f.body.slice(0, 80)}{f.body.length > 80 ? "…" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Header + filtros */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2
            className="text-lg font-bold"
            style={{ fontFamily: "'Playfair Display', serif", color: "var(--accent-dark)" }}
          >
            {list.length} {list.length === 1 ? "empresa" : "empresas"}
            {(q || statusFilter || priorityFilter) && (
              <span className="text-[12px] font-normal ml-2" style={{ color: "var(--text-dim)" }}>
                de {total}
              </span>
            )}
          </h2>
          <p className="text-[11px]" style={{ color: "var(--text-dim)" }}>
            {published} publicadas · {total - published} ocultas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportCompaniesPdfButton
            companies={list}
            filters={{ q, status: statusFilter, priority: priorityFilter }}
          />
          <Link
            href="/admin/empresas/new"
            className="px-3 py-2 rounded-md text-[12px] font-semibold cursor-pointer hover:opacity-90"
            style={{ background: "var(--accent)", color: "white" }}
          >
            + Nova empresa
          </Link>
        </div>
      </div>

      {/* Filtros chips */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            Status:
          </span>
          <FilterPill
            href={makeHref({ q, status: undefined, priority: priorityFilter })}
            active={!statusFilter}
            label={`Todos (${total})`}
          />
          {STATUS_KEYS.map((s) => (
            <FilterPill
              key={s}
              href={makeHref({ q, status: s, priority: priorityFilter })}
              active={statusFilter === s}
              label={`${STATUS_LABELS[s]} (${statusCounts[s]})`}
              color={STATUS_COLORS[s]}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            Prioridade:
          </span>
          <FilterPill
            href={makeHref({ q, status: statusFilter, priority: undefined })}
            active={!priorityFilter}
            label="Todas"
          />
          {PRIORITY_KEYS.map((p) => (
            <FilterPill
              key={p}
              href={makeHref({ q, status: statusFilter, priority: p })}
              active={priorityFilter === p}
              label={PRIORITY_LABELS[p]}
              color={PRIORITY_COLORS[p]}
            />
          ))}
        </div>

        <form className="flex items-center gap-2 mt-1">
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          {priorityFilter && <input type="hidden" name="priority" value={priorityFilter} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome, grupo, cidade..."
            className="px-3 py-2 rounded-md text-sm outline-none w-72"
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
              color: "var(--text)",
            }}
          />
          <button
            type="submit"
            className="px-3 py-2 rounded-md text-[12px] font-semibold cursor-pointer hover:opacity-90"
            style={{ background: "var(--accent)", color: "white" }}
          >
            Buscar
          </button>
        </form>
      </div>

      {/* Tabela */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr
                style={{
                  background: "rgba(139,90,43,0.06)",
                  borderBottom: "2px solid var(--card-border)",
                  color: "var(--text-dim)",
                }}
              >
                <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider">Empresa</th>
                <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider">Tipo</th>
                <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider">Cidade / UF</th>
                <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider">Status</th>
                <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider">Prio.</th>
                <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider">Últ. contato</th>
                <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider">BCI</th>
                <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider">Publicada</th>
                <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <AdminCompanyRow
                  key={c.id}
                  company={c}
                  typeColor={TYPE_COLORS[c.type]}
                  typeLabel={TYPE_LABELS[c.type]}
                  stateName={STATE_NAMES[c.state] ?? c.state}
                />
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center" style={{ color: "var(--text-light)" }}>
                    Nenhuma empresa encontrada com os filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function makeHref(params: { q?: string; status?: string; priority?: string }): string {
  const u = new URLSearchParams();
  if (params.q) u.set("q", params.q);
  if (params.status) u.set("status", params.status);
  if (params.priority) u.set("priority", params.priority);
  const s = u.toString();
  return s ? `/admin?${s}` : "/admin";
}

function FilterPill({
  href, active, label, color,
}: {
  href: string;
  active: boolean;
  label: string;
  color?: string;
}) {
  const baseColor = color ?? "var(--accent2)";
  return (
    <Link
      href={href}
      className="px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-all hover:opacity-90"
      style={{
        background: active ? baseColor : "transparent",
        color: active ? "white" : baseColor,
        border: `1px solid ${baseColor}`,
      }}
    >
      {label}
    </Link>
  );
}
