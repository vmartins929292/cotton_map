import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_COOKIE = "admin_session";
const SESSION_TTL_DAYS = 30;

export function getAdminSecret(): string {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) throw new Error("ADMIN_PASSWORD nao configurado em .env.local");
  return secret;
}

/**
 * Token simples = SHA-256(senha). Suficiente para um usuario unico em uso interno.
 * Se a senha mudar no .env, todos os tokens antigos invalidam automaticamente.
 */
async function hashSecret(secret: string): Promise<string> {
  const data = new TextEncoder().encode(secret);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildSessionToken(): Promise<string> {
  return hashSecret(getAdminSecret());
}

export async function isValidSessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const expected = await buildSessionToken();
  return token === expected;
}

export async function setAdminSessionCookie() {
  const token = await buildSessionToken();
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_TTL_DAYS,
  });
}

export async function clearAdminSessionCookie() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

export async function requireAdmin(): Promise<void> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!(await isValidSessionToken(token))) {
    redirect("/admin/login");
  }
}

/**
 * Versao non-throwing pra checar se ha admin logado.
 * Use em paginas publicas que querem mostrar UI condicional (ex: botao Sair, painel notas).
 */
export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  return isValidSessionToken(token);
}
