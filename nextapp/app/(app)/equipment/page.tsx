import { requireUser } from "@/lib/auth";
import { EquipmentAvailability } from "@/components/EquipmentAvailability";

export default async function EquipmentPage() {
  await requireUser();
  return <EquipmentAvailability />;
}
