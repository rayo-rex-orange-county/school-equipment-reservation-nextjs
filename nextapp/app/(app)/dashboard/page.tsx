import { requireUser } from "@/lib/auth";
import { TeacherDashboard } from "@/components/dashboard/TeacherDashboard";
import { AdminOverview } from "@/components/dashboard/AdminOverview";

export default async function DashboardPage() {
  const user = await requireUser();
  return user.role === "ADMIN" ? <AdminOverview /> : <TeacherDashboard user={user} />;
}
