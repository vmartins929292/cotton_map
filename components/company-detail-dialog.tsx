"use client";

import { useEffect, useState, useTransition } from "react";
import {
  X,
  MapPin,
  Phone,
  Mail,
  Globe,
  Navigation,
  StickyNote,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  Company,
  CompanyNote,
  KIND_LABELS,
  Origin,
  TYPE_COLORS,
  TYPE_LABELS,
  originShortLabel,
} from "@/data/types";
import { quickAddNoteAction, quickDeleteNoteAction } from "@/app/admin/notes-actions";

interface Props {
  company: Company | null;
  origins: Origin[];
  isAdmin?: boolean;
  onClose: () => void;
}

export default function CompanyDetailDialog({
  company: c,
  origins,
  isAdmin = false,
  onClose,
}: Props) {
  if (!c) return null;

  const typeColor = TYPE_COLORS[c.type];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-5"
      style={{ background: "rgba(26,31,46,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto p-7 relative"
        style={{
          background: "var(--bg-paper)",
          border: "1px solid var(--card-border)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-black/5 transition cursor-pointer"
        >
          <X className="w-5 h-5" style={{ color: "var(--text-dim)" }} />
        </button>

        <h2
          className="text-xl font-bold pr-8"
          style={{ fontFamily: "'Playfair Display', serif", color: "var(--accent-dark)" }}
        >
          {c.name}
        </h2>

        <div className="flex gap-1.5 mt-2 flex-wrap">
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: `${typeColor}1F`, color: typeColor }}
          >
            {TYPE_LABELS[c.type]}
          </span>
          {c.bci && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{
                background: "rgba(45,122,62,0.15)",
                color: "var(--green)",
                border: "1px solid rgba(45,122,62,0.3)",
              }}
            >
              BCI ✓
            </span>
          )}
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--bg)", color: "var(--text-dim)" }}>
            {c.group}
          </span>
        </div>

        <p className="text-[13px] mt-3 leading-relaxed" style={{ color: "var(--text-dim)" }}>
          {c.desc}
        </p>

        <div className="mt-4 space-y-2">
          <InfoRow icon={<MapPin className="w-4 h-4" />} label="Local" value={`${c.city} — ${c.state}`} />
          {c.address && <InfoRow icon={<Navigation className="w-4 h-4" />} label="Endereço" value={c.address} />}
          {c.contact && (
            <InfoRow
              icon={<Phone className="w-4 h-4" />}
              label="Telefone"
              value={c.contact}
              href={`tel:${c.contact.replace(/\D/g, "")}`}
            />
          )}
          {c.email && (
            <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={c.email} href={`mailto:${c.email}`} />
          )}
          {c.site && (
            <InfoRow
              icon={<Globe className="w-4 h-4" />}
              label="Site"
              value={c.site}
              href={`https://${c.site}`}
            />
          )}
        </div>

        <div className="mt-4 p-3 rounded-lg" style={{ background: "var(--bg)", border: "1px solid var(--card-border)" }}>
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: "var(--text-light)" }}>
            Produtos & Capacidade
          </div>
          <div className="text-[12px]" style={{ color: "var(--text)" }}>
            <strong>Produtos:</strong> {c.products}
          </div>
          <div className="text-[12px] mt-1" style={{ color: "var(--text)" }}>
            <strong>Capacidade:</strong> {c.capacity}
          </div>
        </div>

        <div
          className="grid gap-2 mt-4"
          style={{
            gridTemplateColumns: `repeat(${Math.min(origins.length, 3)}, minmax(0, 1fr))`,
          }}
        >
          {origins.map((o) => (
            <DistCard
              key={o.id}
              label={`km ${originShortLabel(o)}`}
              value={c.distancesByOrigin?.[o.id]}
              color={o.color}
            />
          ))}
        </div>

        {isAdmin && <InlineNotesPanel companyId={c.id} />}
      </div>
    </div>
  );
}

function InlineNotesPanel({ companyId }: { companyId: string }) {
  const [notes, setNotes] = useState<CompanyNote[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [author, setAuthor] = useState("");
  const [adding, startAdd] = useTransition();

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/companies/${companyId}/notes`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { notes: CompanyNote[] };
      setNotes(data.notes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar notas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  function handleAdd() {
    if (!body.trim()) return;
    setError(null);
    startAdd(async () => {
      const res = await quickAddNoteAction(companyId, body, author);
      if (res.error) {
        setError(res.error);
      } else {
        setBody("");
        await reload();
      }
    });
  }

  function handleDelete(noteId: string) {
    if (!confirm("Excluir esta nota?")) return;
    setError(null);
    startAdd(async () => {
      const res = await quickDeleteNoteAction(noteId, companyId);
      if (res.error) {
        setError(res.error);
      } else {
        await reload();
      }
    });
  }

  return (
    <section
      className="mt-5 rounded-xl p-4"
      style={{
        background: "var(--bg)",
        border: "1px solid var(--card-border)",
      }}
    >
      <header className="flex items-center justify-between mb-3">
        <h3
          className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider"
          style={{ color: "var(--accent-dark)" }}
        >
          <StickyNote className="w-4 h-4" />
          Notas / Interações
          {notes && (
            <span className="text-[10px] font-medium" style={{ color: "var(--text-light)" }}>
              ({notes.length})
            </span>
          )}
        </h3>
      </header>

      <div
        className="rounded-lg p-3 mb-3 space-y-2"
        style={{ background: "var(--bg-paper)", border: "1px solid var(--card-border)" }}
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Ex.: Liguei pro João, demonstrou interesse em pluma BCI. Mandar PI até quinta."
          className="w-full px-2.5 py-1.5 rounded-md text-[12.5px] outline-none resize-y border"
          style={{
            background: "var(--bg)",
            borderColor: "var(--card-border)",
            color: "var(--text)",
          }}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Seu nome (opcional)"
            className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-md text-[12px] outline-none border"
            style={{
              background: "var(--bg)",
              borderColor: "var(--card-border)",
              color: "var(--text)",
            }}
          />
          <button
            onClick={handleAdd}
            disabled={adding || !body.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold cursor-pointer hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--accent)", color: "white" }}
          >
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Adicionar nota
          </button>
        </div>
      </div>

      {error && (
        <div
          className="px-3 py-2 rounded-md text-[12px] mb-2"
          style={{ background: "rgba(193,50,47,0.1)", color: "#c1322f" }}
        >
          {error}
        </div>
      )}

      {loading && notes == null && (
        <div className="text-[12px] flex items-center gap-2" style={{ color: "var(--text-light)" }}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Carregando notas...
        </div>
      )}

      {notes && notes.length === 0 && !loading && (
        <p
          className="text-[12px] text-center py-3"
          style={{ color: "var(--text-light)" }}
        >
          Nenhuma nota registrada ainda.
        </p>
      )}

      {notes && notes.length > 0 && (
        <ol className="space-y-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className="rounded-lg p-2.5"
              style={{ background: "var(--bg-paper)", border: "1px solid var(--card-border)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div
                    className="flex items-center gap-2 text-[10.5px] uppercase tracking-wider font-semibold"
                    style={{ color: "var(--text-light)" }}
                  >
                    <span>{KIND_LABELS[n.kind]}</span>
                    <span>·</span>
                    <span>{fmtDate(n.happenedAt)}</span>
                    {n.author && (
                      <>
                        <span>·</span>
                        <span>por {n.author}</span>
                      </>
                    )}
                  </div>
                  <p
                    className="mt-1 text-[12.5px] whitespace-pre-wrap"
                    style={{ color: "var(--text)" }}
                  >
                    {n.body}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(n.id)}
                  disabled={adding}
                  title="Excluir nota"
                  className="p-1 rounded hover:opacity-70 cursor-pointer disabled:opacity-40"
                  style={{ color: "#c1322f" }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function InfoRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  const content = href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">
      {value}
    </a>
  ) : (
    value
  );

  return (
    <div className="flex items-start gap-2 text-[12px]" style={{ color: "var(--text-dim)" }}>
      <span className="mt-0.5 flex-shrink-0" style={{ color: "var(--accent)" }}>
        {icon}
      </span>
      <div>
        <span className="font-semibold" style={{ color: "var(--text)" }}>
          {label}:
        </span>{" "}
        {content}
      </div>
    </div>
  );
}

function DistCard({ label, value, color }: { label: string; value?: number; color: string }) {
  return (
    <div className="text-center p-2 rounded-lg" style={{ background: "rgba(0,0,0,0.03)" }}>
      <div className="text-sm font-bold" style={{ color }}>
        {value?.toLocaleString("pt-BR")}
      </div>
      <div className="text-[8.5px] tracking-wide leading-snug" style={{ color: "var(--text-light)" }}>
        {label}
      </div>
    </div>
  );
}
