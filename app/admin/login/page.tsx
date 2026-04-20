import LoginForm from "./login-form";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-7"
        style={{
          background: "var(--card)",
          border: "1px solid var(--card-border)",
          boxShadow: "0 12px 32px rgba(0,0,0,0.08)",
        }}
      >
        <h1
          className="text-xl font-extrabold mb-1"
          style={{ fontFamily: "'Playfair Display', serif", color: "var(--accent-dark)" }}
        >
          Painel administrativo
        </h1>
        <p className="text-[12px] mb-5" style={{ color: "var(--text-dim)" }}>
          Acesso restrito. Informe sua senha.
        </p>
        <LoginForm from={sp.from ?? "/admin"} />
      </div>
    </div>
  );
}
