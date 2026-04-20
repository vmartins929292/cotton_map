import "server-only";
import type { CompanyNote, InteractionKind } from "@/data/types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/companies";

export type NoteRow = {
  id: string;
  company_id: string;
  contact_id: string | null;
  kind: InteractionKind;
  body: string;
  happened_at: string;
  next_followup_at: string | null;
  author: string;
  created_at?: string;
  updated_at?: string;
};

export type NoteInput = Omit<CompanyNote, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};

export type FollowupRow = {
  noteId: string;
  companyId: string;
  companyName: string;
  city: string;
  state: string;
  companyStatus: string;
  companyPriority: string;
  kind: InteractionKind;
  body: string;
  nextFollowupAt: string;
  author: string;
  urgency: "atrasado" | "esta_semana" | "futuro";
};

const COLS =
  "id,company_id,contact_id,kind,body,happened_at,next_followup_at,author,created_at,updated_at";

const NOT_CONFIGURED =
  "Supabase nao configurado. Notas so funcionam apos rodar o setup do banco.";

function ensure() {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(NOT_CONFIGURED);
  }
}

function rowToNote(row: NoteRow): CompanyNote {
  return {
    id: row.id,
    companyId: row.company_id,
    contactId: row.contact_id,
    kind: row.kind,
    body: row.body,
    happenedAt: row.happened_at,
    nextFollowupAt: row.next_followup_at,
    author: row.author,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function inputToRow(input: NoteInput): Omit<NoteRow, "id" | "created_at" | "updated_at"> {
  return {
    company_id: input.companyId,
    contact_id: input.contactId,
    kind: input.kind,
    body: input.body,
    happened_at: input.happenedAt,
    next_followup_at: input.nextFollowupAt,
    author: input.author,
  };
}

export async function listNotes(companyId: string): Promise<CompanyNote[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("company_notes")
    .select(COLS)
    .eq("company_id", companyId)
    .order("happened_at", { ascending: false });
  if (error) throw new Error(`listNotes: ${error.message}`);
  return (data as NoteRow[]).map(rowToNote);
}

export async function createNote(input: NoteInput): Promise<CompanyNote> {
  ensure();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("company_notes")
    .insert(inputToRow(input))
    .select(COLS)
    .single();
  if (error) throw new Error(`createNote: ${error.message}`);
  return rowToNote(data as NoteRow);
}

export async function updateNote(id: string, input: NoteInput): Promise<CompanyNote> {
  ensure();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("company_notes")
    .update(inputToRow(input))
    .eq("id", id)
    .select(COLS)
    .single();
  if (error) throw new Error(`updateNote: ${error.message}`);
  return rowToNote(data as NoteRow);
}

export async function deleteNote(id: string): Promise<void> {
  ensure();
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("company_notes").delete().eq("id", id);
  if (error) throw new Error(`deleteNote: ${error.message}`);
}

/**
 * Lista de proximos follow-ups (atrasados + proximos 30 dias).
 * Usa a view `upcoming_followups` definida no schema.
 */
export async function listUpcomingFollowups(daysAhead = 30): Promise<FollowupRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseAdminClient();
  const limit = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("upcoming_followups")
    .select("*")
    .lte("next_followup_at", limit)
    .order("next_followup_at", { ascending: true });
  if (error) throw new Error(`listUpcomingFollowups: ${error.message}`);
  type Raw = {
    note_id: string;
    company_id: string;
    company_name: string;
    city: string;
    state: string;
    company_status: string;
    company_priority: string;
    kind: InteractionKind;
    body: string;
    next_followup_at: string;
    author: string;
    urgency: "atrasado" | "esta_semana" | "futuro";
  };
  return (data as Raw[]).map((r) => ({
    noteId: r.note_id,
    companyId: r.company_id,
    companyName: r.company_name,
    city: r.city,
    state: r.state,
    companyStatus: r.company_status,
    companyPriority: r.company_priority,
    kind: r.kind,
    body: r.body,
    nextFollowupAt: r.next_followup_at,
    author: r.author,
    urgency: r.urgency,
  }));
}
