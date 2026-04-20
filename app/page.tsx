import DashboardClient from "@/components/dashboard-client";
import { listPublishedCompanies } from "@/lib/companies";
import { listOrigins } from "@/lib/origins";
import { isAdminAuthed } from "@/lib/admin-auth";

export const revalidate = 60;

export default async function DashboardPage() {
  const [companies, origins, isAdmin] = await Promise.all([
    listPublishedCompanies(),
    listOrigins(),
    isAdminAuthed(),
  ]);
  return (
    <DashboardClient companies={companies} origins={origins} isAdmin={isAdmin} />
  );
}
