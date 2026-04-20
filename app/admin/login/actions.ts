"use server";

import { redirect } from "next/navigation";
import { getAdminSecret, setAdminSessionCookie } from "@/lib/admin-auth";
import type { LoginState } from "../types";

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const from = String(formData.get("from") ?? "/admin");

  if (!password) return { error: "Informe a senha." };

  let expected: string;
  try {
    expected = getAdminSecret();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Configuracao invalida." };
  }

  if (password !== expected) {
    return { error: "Senha incorreta." };
  }

  await setAdminSessionCookie();
  redirect(from && from.startsWith("/admin") ? from : "/admin");
}
