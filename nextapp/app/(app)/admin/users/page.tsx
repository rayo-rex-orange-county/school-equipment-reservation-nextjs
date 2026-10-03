import { requireAdmin } from "@/lib/auth";
import { AdminUsers } from "@/components/admin/AdminUsers";

export default async function AdminUsersPage() {
  await requireAdmin();
  return <AdminUsers />;
}
