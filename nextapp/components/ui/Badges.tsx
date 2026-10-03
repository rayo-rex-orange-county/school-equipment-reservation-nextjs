import type { EquipmentStatus, EquipmentType } from "@/lib/types";
import { EQUIPMENT_COLORS, EQUIPMENT_STATUS_BADGE, EQUIPMENT_STATUS_LABEL } from "@/lib/constants";

export function StatusBadge({ status }: { status: EquipmentStatus }) {
  return <span className={`badge ${EQUIPMENT_STATUS_BADGE[status]}`}>{EQUIPMENT_STATUS_LABEL[status]}</span>;
}

export function EquipmentChip({ name, type }: { name: string; type: EquipmentType }) {
  return (
    <span className="chip">
      <span className="chip-dot" style={{ background: EQUIPMENT_COLORS[type].fg }} />
      {name}
    </span>
  );
}

export function TypeDot({ type }: { type: EquipmentType }) {
  return <span className="chip-dot" style={{ background: EQUIPMENT_COLORS[type].fg, display: "inline-block" }} />;
}
