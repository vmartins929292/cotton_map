"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Calendar, Bell, X, User } from "lucide-react";
import { saveNoteAction, deleteNoteAction } from "@/app/admin/notes-actions";
import type { NoteSaveState } from "@/app/admin/types";
import {
  KIND_LABELS,
  KIND_ICONS,
  type CompanyContact,
  type CompanyNote,
  type InteractionKind,
} from "@/data/types";

const initial: NoteSaveState = {};
const KIND_OPTIONS = Object.entries(KIND_LABELS) as Array<[InteractionKind, string]>;

function fmt(date: string): string {
  try {
    return new Date(date).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return date;
  }
}

function fmtRelative(date: string): string {
  const d = new Date(date).getTime();
  const now = Date.now();
  const days = Math.round((d - now) / (24 * 60 * 60 * 1000));
  if (days === 0) return "hoje";
  if (days === 1) return "amanhã";
  if (days === -1) return "ontem";
  if (days > 0) return `em ${days} dias`;
  return `há ${Math.abs(days)} dias`;
}

function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NotesPanel({
  companyId,
  notes,
  contacts,
}: {
  companyId: string;
  notes: CompanyNote[];
  contacts: CompanyContact[];
}) {
  const [editing, setEditing] = useState<CompanyNote | "new" | null>(null);
  const [now] = useState(() => Date.now());
  const contactById = new Map(contacts.map((c) => [c.id, c]));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px]" style={{ color: "var(--text-dim)" }}>
          {notes.length} {notes.length === 1 ? "interação" : "interações"} registrada(s)
        </p>
        <button
          onClick={() => setEditing("new")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold cursor-pointer hover:opacity-90"
          style={{ background: "var(--accent)", color: "white" }}
        >
          <Plus className="w-3.5 h-3.5" />
          Nova nota
        </button>
      </div>

      {editing != null && (
        <NoteForm
          companyId={companyId}
          contacts={contacts}
          note={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      {notes.length === 0 && editing == null && (
        <div
          className="rounded-lg p-6 text-center text-[12px]"
          style={{ background: "var(--bg)", border: "1px dashed var(--card-border)", color: "var(--text-light)" }}
        >
          Nenhuma interação registrada. Adicione ligações, e-mails, reuniões, propostas...
        </div>
      )}

      <ol className="relative space-y-2">
        {notes.map((n) => {
          const contact = n.contactId ? contactById.get(n.contactId) : null;
          const overdue = n.nextFollowupAt && new Date(n.nextFollowupAt).getTime() < now;
          return (
            <li
              key={n.id}
              className="rounded-lg p-3"
              style={{ background: "var(--bg)", border: "1px solid var(--card-border)" }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0"
                  style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
                  aria-hidden
                >
                  {KIND_ICONS[n.kind]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap text-[12px]">
                      <span className="font-bold" style={{ color: "var(--text)" }}>
                        {KIND_LABELS[n.kind]}
                      </span>
                      <span style={{ color: "var(--text-dim)" }}>
                        <Calendar className="inline w-3 h-3 mr-0.5" />
                        {fmt(n.happenedAt)}
                      </span>
                      {contact && (
                        <span style={{ color: "var(--text-dim)" }}>
                          <User className="inline w-3 h-3 mr-0.5" />
                          {contact.name}
                        </span>
                      )}
                      {n.author && (
                        <span className="text-[10px]" style={{ color: "var(--text-light)" }}>
                          por {n.author}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditing(n)}
                              className="p-1 rounded hover:opacity-70 cursor-pointer"
                              style={{ color: "var(--accent2)" }} title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <DeleteNoteButton noteId={n.id} companyId={companyId} />
                    </div>
                  </div>
                  <p className="mt-1.5 text-[13px] whitespace-pre-wrap" style={{ color: "var(--text)" }}>
                    {n.body}
                  </p>
                  {n.nextFollowupAt && (
                    <div
                      className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold"
                      style={{
                        background: overdue ? "rgba(193,50,47,0.12)" : "rgba(45,122,62,0.10)",
                        color: overdue ? "#c1322f" : "#2d7a3e",
                      }}
                    >
                      <Bell className="w-3 h-3" />
                      Follow-up: {fmt(n.nextFollowupAt)} ({fmtRelative(n.nextFollowupAt)})
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function DeleteNoteButton({ noteId, companyId }: { noteId: string; companyId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm("Excluir esta nota?")) return;
        start(async () => {
          await deleteNoteAction(noteId, companyId);
        });
      }}
      disabled={pending}
      className="p-1 rounded hover:opacity-70 cursor-pointer disabled:opacity-40"
      style={{ color: "#c1322f" }}
      title="Excluir"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}

function NoteForm({
  companyId,
  contacts,
  note,
  onClose,
}: {
  companyId: string;
  contacts: CompanyContact[];
  note: CompanyNote | null;
  onClose: () => void;
}) {
  const mode = note ? "update" : "create";
  const action = saveNoteAction.bind(null, mode, note?.id ?? null);
  const [state, formAction, pending] = useActionState(action, initial);

  if (state.ok) queueMicrotask(onClose);

  return (
    <div
      className="rounded-lg p-4 space-y-3"
      style={{ background: "var(--card)", border: "2px solid var(--accent2)" }}
    >
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-[13px]" style={{ color: "var(--accent-dark)" }}>
          {mode === "create" ? "Nova nota / interação" : "Editar nota"}
        </h4>
        <button onClick={onClose} className="p-1 hover:opacity-70 cursor-pointer" style={{ color: "var(--text-dim)" }}>
          <X className="w-4 h-4" />
        </button>
      </div>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="companyId" value={companyId} />
        <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
          <Field label="Tipo *" required>
            <select name="kind" required defaultValue={note?.kind ?? "nota"} className={inputCls}>
              {KIND_OPTIONS.map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Quando aconteceu *" required>
            <input
              type="datetime-local"
              name="happenedAt"
              required
              defaultValue={toLocalInput(note?.happenedAt ?? new Date().toISOString())}
              className={inputCls}
            />
          </Field>
          <Field label="Próximo follow-up (opcional)">
            <input
              type="datetime-local"
              name="nextFollowupAt"
              defaultValue={toLocalInput(note?.nextFollowupAt)}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <Field label="Contato envolvido (opcional)">
            <select name="contactId" defaultValue={note?.contactId ?? ""} className={inputCls}>
              <option value="">— Nenhum —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.role ? ` (${c.role})` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Autor (quem registrou)">
            <input name="author" defaultValue={note?.author ?? ""} className={inputCls} placeholder="Seu nome" />
          </Field>
        </div>

        <Field label="O que aconteceu *" required>
          <textarea
            name="body"
            required
            rows={4}
            defaultValue={note?.body ?? ""}
            className={`${inputCls} resize-y`}
            placeholder="Ex: Liguei pro Fulano, demonstrou interesse em fio open-end Ne 12. Pediu cotação para 50t/mês. Enviar PI até quinta."
          />
        </Field>

        {state.error && (
          <div className="px-3 py-2 rounded-md text-[12px]"
               style={{ background: "rgba(193,50,47,0.1)", color: "#c1322f" }}>
            {state.error}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button type="submit" disabled={pending}
                  className="px-3 py-1.5 rounded-md font-semibold text-[12px] cursor-pointer hover:opacity-90 disabled:opacity-60"
                  style={{ background: "var(--accent)", color: "white" }}>
            {pending ? "Salvando..." : mode === "create" ? "Registrar" : "Salvar"}
          </button>
          <button type="button" onClick={onClose}
                  className="px-3 py-1.5 rounded-md text-[12px] cursor-pointer hover:opacity-80"
                  style={{ background: "var(--bg)", border: "1px solid var(--card-border)", color: "var(--text-dim)" }}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full px-2.5 py-1.5 rounded-md text-[13px] outline-none border [background:var(--bg)] [border-color:var(--card-border)] [color:var(--text)]";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10.5px] font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
        {label}
        {required && <span style={{ color: "#c1322f" }}> *</span>}
      </label>
      {children}
    </div>
  );
}
