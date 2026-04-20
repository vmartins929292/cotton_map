import "server-only";
import type { CompanyContact } from "@/data/types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/companies";

export type ContactRow = {
  id: string;
  company_id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  linkedin: string;
  notes: string;
  is_primary: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ContactInput = Omit<CompanyContact, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};

const COLS =
  "id,company_id,name,role,phone,email,linkedin,notes,is_primary,created_at,updated_at";

const NOT_CONFIGURED =
  "Supabase nao configurado. Contatos so funcionam apos rodar o setup do banco.";

function ensure() {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(NOT_CONFIGURED);
  }
}

function rowToContact(row: ContactRow): CompanyContact {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    role: row.role,
    phone: row.phone,
    email: row.email,
    linkedin: row.linkedin,
    notes: row.notes,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function inputToRow(input: ContactInput): Omit<ContactRow, "id" | "created_at" | "updated_at"> {
  return {
    company_id: input.companyId,
    name: input.name,
    role: input.role,
    phone: input.phone,
    email: input.email,
    linkedin: input.linkedin,
    notes: input.notes,
    is_primary: input.isPrimary,
  };
}

export async function listContacts(companyId: string): Promise<CompanyContact[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("company_contacts")
    .select(COLS)
    .eq("company_id", companyId)
    .order("is_primary", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw new Error(`listContacts: ${error.message}`);
  return (data as ContactRow[]).map(rowToContact);
}

export async function getContactById(id: string): Promise<CompanyContact | null> {
  ensure();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("company_contacts")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getContactById: ${error.message}`);
  return data ? rowToContact(data as ContactRow) : null;
}

async function clearPrimaryFlag(supabase: ReturnType<typeof createSupabaseAdminClient>, companyId: string, exceptId?: string) {
  let q = supabase
    .from("company_contacts")
    .update({ is_primary: false })
    .eq("company_id", companyId)
    .eq("is_primary", true);
  if (exceptId) q = q.neq("id", exceptId);
  const { error } = await q;
  if (error) throw new Error(`clearPrimaryFlag: ${error.message}`);
}

export async function createContact(input: ContactInput): Promise<CompanyContact> {
  ensure();
  const supabase = createSupabaseAdminClient();
  if (input.isPrimary) await clearPrimaryFlag(supabase, input.companyId);
  const { data, error } = await supabase
    .from("company_contacts")
    .insert(inputToRow(input))
    .select(COLS)
    .single();
  if (error) throw new Error(`createContact: ${error.message}`);
  return rowToContact(data as ContactRow);
}

export async function updateContact(id: string, input: ContactInput): Promise<CompanyContact> {
  ensure();
  const supabase = createSupabaseAdminClient();
  if (input.isPrimary) await clearPrimaryFlag(supabase, input.companyId, id);
  const { data, error } = await supabase
    .from("company_contacts")
    .update(inputToRow(input))
    .eq("id", id)
    .select(COLS)
    .single();
  if (error) throw new Error(`updateContact: ${error.message}`);
  return rowToContact(data as ContactRow);
}

export async function deleteContact(id: string): Promise<void> {
  ensure();
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("company_contacts").delete().eq("id", id);
  if (error) throw new Error(`deleteContact: ${error.message}`);
}
