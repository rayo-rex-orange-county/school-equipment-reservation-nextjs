import { requireAdmin } from "@/lib/auth";
import { AdminReservations } from "@/components/admin/AdminReservations";

export default async function AdminReservationsPage() {
  await requireAdmin();
  return <AdminReservations />;
}
