"use client";

import { useActionState, useState, useTransition } from "react";
import {
  Plus, Pencil, Trash2, Star, Phone, Mail, Link2, X,
} from "lucide-react";
import {
  saveContactAction,
  deleteContactAction,
} from "@/app/admin/contacts-actions";
import type { ContactSaveState } from "@/app/admin/types";
import type { CompanyContact } from "@/data/types";

const initial: ContactSaveState = {};

export default function ContactsPanel({
  companyId,
  contacts,
}: {
  companyId: string;
  contacts: CompanyContact[];
}) {
  const [editing, setEditing] = useState<CompanyContact | "new" | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px]" style={{ color: "var(--text-dim)" }}>
          {contacts.length} {contacts.length === 1 ? "contato" : "contatos"} cadastrado(s)
        </p>
        <button
          onClick={() => setEditing("new")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold cursor-pointer hover:opacity-90"
          style={{ background: "var(--accent)", color: "white" }}
        >
          <Plus className="w-3.5 h-3.5" />
          Novo contato
        </button>
      </div>

      {contacts.length === 0 && editing == null && (
        <div
          className="rounded-lg p-6 text-center text-[12px]"
          style={{ background: "var(--bg)", border: "1px dashed var(--card-border)", color: "var(--text-light)" }}
        >
          Nenhum contato cadastrado ainda. Adicione o comprador, diretor industrial ou qualquer pessoa-chave.
        </div>
      )}

      <ul className="space-y-2">
        {contacts.map((c) => (
          <li
            key={c.id}
            className="rounded-lg p-3"
            style={{ background: "var(--bg)", border: "1px solid var(--card-border)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[13px]" style={{ color: "var(--text)" }}>
                    {c.name}
                  </span>
                  {c.isPrimary && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold"
                      style={{ background: "rgba(217,119,6,0.15)", color: "#a35a04" }}
                    >
                      <Star className="w-3 h-3" /> Principal
                    </span>
                  )}
                  {c.role && (
                    <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>
                      · {c.role}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: "var(--text-dim)" }}>
                  {c.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                  {c.email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                  {c.linkedin && (
                    <a href={c.linkedin.startsWith("http") ? c.linkedin : `https://${c.linkedin}`}
                       target="_blank" rel="noreferrer"
                       className="inline-flex items-center gap-1 underline" style={{ color: "var(--accent2)" }}>
                      <Link2 className="w-3 h-3" /> LinkedIn
                    </a>
                  )}
                </div>
                {c.notes && (
                  <p className="mt-1.5 text-[11px] italic" style={{ color: "var(--text-light)" }}>
                    {c.notes}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setEditing(c)}
                  className="p-1.5 rounded hover:opacity-70 cursor-pointer"
                  style={{ color: "var(--accent2)" }}
                  title="Editar"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <DeleteButton contactId={c.id} companyId={companyId} name={c.name} />
              </div>
            </div>
          </li>
        ))}
      </ul>

      {editing != null && (
        <ContactForm
          companyId={companyId}
          contact={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function DeleteButton({ contactId, companyId, name }: { contactId: string; companyId: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm(`Excluir contato "${name}"?`)) return;
        start(async () => {
          await deleteContactAction(contactId, companyId);
        });
      }}
      disabled={pending}
      className="p-1.5 rounded hover:opacity-70 cursor-pointer disabled:opacity-40"
      style={{ color: "#c1322f" }}
      title="Excluir"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}

function ContactForm({
  companyId,
  contact,
  onClose,
}: {
  companyId: string;
  contact: CompanyContact | null;
  onClose: () => void;
}) {
  const mode = contact ? "update" : "create";
  const action = saveContactAction.bind(null, mode, contact?.id ?? null);
  const [state, formAction, pending] = useActionState(action, initial);

  // Auto-fechar quando salvar com sucesso
  if (state.ok) {
    queueMicrotask(onClose);
  }

  return (
    <div
      className="rounded-lg p-4 space-y-3 mt-2"
      style={{ background: "var(--card)", border: "2px solid var(--accent2)" }}
    >
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-[13px]" style={{ color: "var(--accent-dark)" }}>
          {mode === "create" ? "Novo contato" : `Editar: ${contact?.name}`}
        </h4>
        <button onClick={onClose} className="p-1 hover:opacity-70 cursor-pointer" style={{ color: "var(--text-dim)" }}>
          <X className="w-4 h-4" />
        </button>
      </div>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="companyId" value={companyId} />
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <Field label="Nome *" required>
            <input name="name" required defaultValue={contact?.name ?? ""} className={inputCls} />
          </Field>
          <Field label="Cargo / Área">
            <input name="role" defaultValue={contact?.role ?? ""} className={inputCls}
                   placeholder="Compras, Diretor, Comercial..." />
          </Field>
          <Field label="Telefone / WhatsApp">
            <input name="phone" defaultValue={contact?.phone ?? ""} className={inputCls} />
          </Field>
          <Field label="E-mail">
            <input name="email" type="email" defaultValue={contact?.email ?? ""} className={inputCls} />
          </Field>
          <Field label="LinkedIn (URL ou usuário)">
            <input name="linkedin" defaultValue={contact?.linkedin ?? ""} className={inputCls}
                   placeholder="linkedin.com/in/..." />
          </Field>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-[12px] cursor-pointer" style={{ color: "var(--text)" }}>
              <input type="checkbox" name="isPrimary" defaultChecked={contact?.isPrimary ?? false} />
              Contato principal da empresa
            </label>
          </div>
        </div>
        <Field label="Observações">
          <textarea name="notes" rows={2} defaultValue={contact?.notes ?? ""}
                    className={`${inputCls} resize-y`}
                    placeholder="Ex: Decisor final em compras de fio, melhor falar de manhã..." />
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
            {pending ? "Salvando..." : mode === "create" ? "Adicionar" : "Salvar"}
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
