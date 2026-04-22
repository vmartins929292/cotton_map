import Link from "next/link";
import { ArrowLeft, Map } from "lucide-react";
import { logoutAction } from "./actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <header
        className="px-5 py-3 flex items-center justify-between sticky top-0 z-20 gap-3 flex-wrap"
        style={{
          background: "linear-gradient(135deg, #fdfbf6 0%, #f5f2ec 100%)",
          borderBottom: "2px solid var(--accent)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/"
            title="Voltar para Início"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-[12px] cursor-pointer hover:opacity-90 transition-opacity"
            style={{
              background: "var(--accent-dark)",
              color: "white",
              boxShadow: "0 2px 8px rgba(31,91,58,0.25)",
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            <Map className="w-4 h-4" />
            Voltar para Início
          </Link>
          <div className="h-9 w-px" style={{ background: "var(--card-border)" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="VALOR AG Commodities" className="h-9" />
          <div>
            <h1
              className="text-[15px] font-extrabold leading-tight"
              style={{ fontFamily: "'Playfair Display', serif", color: "var(--accent-dark)" }}
            >
              ADMIN · COMPRADORES DE ALGODÃO
            </h1>
            <p className="text-[10px]" style={{ color: "var(--text-dim)" }}>
              Cadastro e manutenção da base
            </p>
          </div>
        </div>
        <nav className="flex items-center gap-2 text-[12px]">
          <Link
            href="/admin"
            className="px-3 py-1.5 rounded-md font-semibold hover:opacity-80"
            style={{ background: "var(--accent)", color: "white" }}
          >
            Empresas
          </Link>
          <Link
            href="/admin/empresas/new"
            className="px-3 py-1.5 rounded-md font-semibold hover:opacity-80"
            style={{ background: "var(--accent2)", color: "white" }}
          >
            + Nova
          </Link>
          <Link
            href="/admin/origens"
            className="px-3 py-1.5 rounded-md font-semibold hover:opacity-80"
            style={{
              background: "var(--bg)",
              border: "1px solid var(--card-border)",
              color: "var(--text-dim)",
            }}
          >
            Origens
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-md font-semibold cursor-pointer hover:opacity-80"
              style={{ background: "var(--bg)", border: "1px solid var(--card-border)", color: "var(--text-dim)" }}
            >
              Sair
            </button>
          </form>
        </nav>
      </header>
      <main className="p-5 max-w-6xl mx-auto">{children}</main>
    </div>
  );
}
