import { requireUser } from "@/lib/auth";
import { CalendarView } from "@/components/calendar/CalendarView";

export default async function CalendarPage() {
  const user = await requireUser();
  return <CalendarView currentUserId={user.id} isAdmin={user.role === "ADMIN"} />;
}
