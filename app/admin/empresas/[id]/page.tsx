import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { getCompanyById, isSupabaseConfigured } from "@/lib/companies";
import { listContacts } from "@/lib/contacts";
import { listNotes } from "@/lib/notes";
import { STATE_NAMES, TYPE_LABELS, TYPE_COLORS } from "@/data/types";
import CompanyForm from "@/components/company-form";
import ContactsPanel from "@/components/contacts-panel";
import NotesPanel from "@/components/notes-panel";
import AdminTabs from "@/components/admin-tabs";
import StatusPriorityChips from "@/components/status-priority-chips";

export const dynamic = "force-dynamic";

export default async function AdminEditCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="rounded-xl p-6" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
        <p className="text-[13px]" style={{ color: "var(--text)" }}>
          Configure o Supabase primeiro (veja a tela inicial do <Link href="/admin" className="underline" style={{ color: "var(--accent2)" }}>painel</Link>).
        </p>
      </div>
    );
  }

  const company = await getCompanyById(id);
  if (!company) notFound();

  const [contacts, notes] = await Promise.all([
    listContacts(id),
    listNotes(id),
  ]);

  return (
    <div className="space-y-4">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-[12px] font-semibold hover:opacity-80"
        style={{ color: "var(--accent2)" }}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar para a lista
      </Link>

      {/* Header com info principal */}
      <div
        className="rounded-xl p-5 space-y-3"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h2
              className="text-xl font-bold"
              style={{ fontFamily: "'Playfair Display', serif", color: "var(--accent-dark)" }}
            >
              {company.name}
            </h2>
            <div className="mt-1 flex items-center gap-2 text-[12px] flex-wrap" style={{ color: "var(--text-dim)" }}>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-bold uppercase tracking-wide"
                style={{ background: TYPE_COLORS[company.type] + "22", color: TYPE_COLORS[company.type] }}
              >
                {TYPE_LABELS[company.type]}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {company.city} / {company.state} ({STATE_NAMES[company.state] ?? company.state})
              </span>
              <span>· Grupo {company.group}</span>
              <span className="font-mono text-[10.5px]">· {company.id}</span>
            </div>
          </div>
        </div>

        <StatusPriorityChips
          companyId={company.id}
          status={company.status}
          priority={company.priority}
        />
      </div>

      <div
        className="rounded-xl p-5"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
      >
        <AdminTabs
          tabs={[
            {
              id: "ficha",
              label: "Ficha da empresa",
              content: <CompanyForm mode="update" initialData={company} />,
            },
            {
              id: "contatos",
              label: "Contatos",
              count: contacts.length,
              content: <ContactsPanel companyId={company.id} contacts={contacts} />,
            },
            {
              id: "notas",
              label: "Notas & Histórico",
              count: notes.length,
              content: <NotesPanel companyId={company.id} contacts={contacts} notes={notes} />,
            },
          ]}
          defaultTab="contatos"
        />
      </div>
    </div>
  );
}
