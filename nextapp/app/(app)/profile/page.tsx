import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForms } from "@/components/ProfileForms";

export default async function ProfilePage() {
  const user = await requireUser();
  const mine = await prisma.reservation.findMany({ where: { userId: user.id, status: "CONFIRMED" } });
  const hours = mine.reduce((s, r) => s + (r.endDateTime.getTime() - r.startDateTime.getTime()) / 3_600_000, 0);

  return (
    <ProfileForms
      user={{ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt.toISOString() }}
      stats={{ reservationCount: mine.length, hours }}
    />
  );
}
