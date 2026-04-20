"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import {
  createContact,
  updateContact,
  deleteContact,
  type ContactInput,
} from "@/lib/contacts";
import type { ContactSaveState } from "./types";

function parseContactForm(formData: FormData): ContactInput {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const getBool = (k: string) => formData.get(k) === "on" || formData.get(k) === "true";
  const companyId = get("companyId");
  const name = get("name");
  if (!companyId) throw new Error("Empresa obrigatoria.");
  if (!name) throw new Error("Nome do contato obrigatorio.");
  return {
    companyId,
    name,
    role: get("role"),
    phone: get("phone"),
    email: get("email"),
    linkedin: get("linkedin"),
    notes: get("notes"),
    isPrimary: getBool("isPrimary"),
  };
}

export async function saveContactAction(
  mode: "create" | "update",
  contactId: string | null,
  _prev: ContactSaveState,
  formData: FormData
): Promise<ContactSaveState> {
  await requireAdmin();
  let input: ContactInput;
  try {
    input = parseContactForm(formData);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Dados invalidos." };
  }
  try {
    if (mode === "create") {
      await createContact(input);
    } else if (contactId) {
      await updateContact(contactId, input);
    } else {
      return { error: "ID do contato ausente." };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao salvar contato." };
  }
  revalidatePath(`/admin/empresas/${input.companyId}`);
  return { ok: true };
}

export async function deleteContactAction(contactId: string, companyId: string): Promise<void> {
  await requireAdmin();
  await deleteContact(contactId);
  revalidatePath(`/admin/empresas/${companyId}`);
}
