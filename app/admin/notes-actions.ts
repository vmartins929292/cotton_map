"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import {
  createNote,
  updateNote,
  deleteNote,
  type NoteInput,
} from "@/lib/notes";
import type { InteractionKind } from "@/data/types";
import type { NoteSaveState } from "./types";

const VALID_KINDS = new Set<InteractionKind>([
  "nota",
  "ligacao",
  "email",
  "whatsapp",
  "reuniao",
  "visita",
  "proposta",
  "amostra",
]);

function parseLocalDateTime(value: string): string {
  // datetime-local => "2026-04-18T14:30" (sem timezone)
  // tratamos como horario local do servidor
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function parseNoteForm(formData: FormData): NoteInput {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const companyId = get("companyId");
  const body = get("body");
  if (!companyId) throw new Error("Empresa obrigatoria.");
  if (!body) throw new Error("Descreva o que aconteceu na nota.");

  const kindRaw = get("kind") as InteractionKind;
  const kind: InteractionKind = VALID_KINDS.has(kindRaw) ? kindRaw : "nota";

  const contactIdRaw = get("contactId");
  const contactId = contactIdRaw ? contactIdRaw : null;

  const happenedAtRaw = get("happenedAt");
  const happenedAt = parseLocalDateTime(happenedAtRaw);

  const followupRaw = get("nextFollowupAt");
  const nextFollowupAt = followupRaw ? parseLocalDateTime(followupRaw) : null;

  return {
    companyId,
    contactId,
    kind,
    body,
    happenedAt,
    nextFollowupAt,
    author: get("author"),
  };
}

export async function saveNoteAction(
  mode: "create" | "update",
  noteId: string | null,
  _prev: NoteSaveState,
  formData: FormData
): Promise<NoteSaveState> {
  await requireAdmin();
  let input: NoteInput;
  try {
    input = parseNoteForm(formData);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Dados invalidos." };
  }
  try {
    if (mode === "create") {
      await createNote(input);
    } else if (noteId) {
      await updateNote(noteId, input);
    } else {
      return { error: "ID da nota ausente." };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao salvar nota." };
  }
  revalidatePath(`/admin/empresas/${input.companyId}`);
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteNoteAction(noteId: string, companyId: string): Promise<void> {
  await requireAdmin();
  await deleteNote(noteId);
  revalidatePath(`/admin/empresas/${companyId}`);
  revalidatePath("/admin");
  revalidatePath("/");
}

/**
 * Versao simplificada usada no dialog de detalhe da pagina publica (/).
 * Cria uma nota tipo "nota" com data atual, sem contato/follow-up.
 */
export type QuickNoteState = { error?: string; ok?: boolean };

export async function quickAddNoteAction(
  companyId: string,
  body: string,
  author?: string
): Promise<QuickNoteState> {
  await requireAdmin();
  const text = body?.trim();
  if (!companyId) return { error: "Empresa obrigatoria." };
  if (!text) return { error: "Escreva o que aconteceu." };
  try {
    await createNote({
      companyId,
      contactId: null,
      kind: "nota",
      body: text,
      happenedAt: new Date().toISOString(),
      nextFollowupAt: null,
      author: author?.trim() || "",
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao salvar nota." };
  }
  revalidatePath(`/admin/empresas/${companyId}`);
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true };
}

export async function quickDeleteNoteAction(
  noteId: string,
  companyId: string
): Promise<QuickNoteState> {
  await requireAdmin();
  try {
    await deleteNote(noteId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao excluir." };
  }
  revalidatePath(`/admin/empresas/${companyId}`);
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true };
}
