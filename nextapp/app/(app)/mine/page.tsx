import { requireUser } from "@/lib/auth";
import { MyReservations } from "@/components/MyReservations";

export default async function MinePage() {
  const user = await requireUser();
  return <MyReservations currentUserId={user.id} />;
}
