import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import CompanyForm from "@/components/company-form";

export default async function AdminNewCompanyPage() {
  await requireAdmin();
  return (
    <div className="space-y-4">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-[12px] font-semibold hover:opacity-80"
        style={{ color: "var(--accent2)" }}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar para a lista
      </Link>
      <div
        className="rounded-xl p-6"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
      >
        <h2
          className="text-lg font-bold mb-4"
          style={{ fontFamily: "'Playfair Display', serif", color: "var(--accent-dark)" }}
        >
          Nova empresa
        </h2>
        <CompanyForm mode="create" />
      </div>
    </div>
  );
}
