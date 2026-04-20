"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";
import type { LoginState } from "../types";

const initial: LoginState = {};

export default function LoginForm({ from }: { from: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="from" value={from} />
      <div>
        <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-dim)" }}>
          Senha
        </label>
        <input
          type="password"
          name="password"
          autoFocus
          required
          className="w-full px-3 py-2 rounded-md text-sm outline-none"
          style={{
            background: "var(--bg)",
            border: "1px solid var(--card-border)",
            color: "var(--text)",
          }}
        />
      </div>
      {state.error && (
        <p className="text-[12px]" style={{ color: "#c1322f" }}>
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full py-2 rounded-lg font-semibold text-sm cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ background: "var(--accent)", color: "white" }}
      >
        {pending ? "Validando..." : "Entrar"}
      </button>
    </form>
  );
}
