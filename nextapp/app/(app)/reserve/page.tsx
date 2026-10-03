import { requireUser } from "@/lib/auth";
import { ReserveWizard } from "@/components/wizard/ReserveWizard";

export default async function ReservePage({
  searchParams,
}: {
  searchParams: { edit?: string; equip?: string; date?: string; start?: string; end?: string };
}) {
  const user = await requireUser();
  return (
    <ReserveWizard
      editId={searchParams.edit || null}
      currentUserId={user.id}
      seed={
        searchParams.equip
          ? { equipmentId: searchParams.equip, date: searchParams.date, start: searchParams.start, end: searchParams.end }
          : null
      }
    />
  );
}
