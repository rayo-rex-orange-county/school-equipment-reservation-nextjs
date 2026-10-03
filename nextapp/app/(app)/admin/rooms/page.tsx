import { requireAdmin } from "@/lib/auth";
import { AdminRooms } from "@/components/admin/AdminRooms";

export default async function AdminRoomsPage() {
  await requireAdmin();
  return <AdminRooms />;
}
