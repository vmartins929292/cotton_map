import EmpresasClient from "@/components/empresas-client";
import { listPublishedCompanies } from "@/lib/companies";
import { listOrigins } from "@/lib/origins";

export const revalidate = 60;

export default async function EmpresasPage() {
  const [companies, origins] = await Promise.all([
    listPublishedCompanies(),
    listOrigins(),
  ]);
  return <EmpresasClient companies={companies} origins={origins} />;
}
