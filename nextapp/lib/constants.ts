import type { EquipmentType, EquipmentStatus, RoomStatus, ReservationStatus } from "@prisma/client";

export const EQUIPMENT_TYPES: { value: EquipmentType; label: string }[] = [
  { value: "PROJECTOR", label: "Projector" },
  { value: "MICROPHONE", label: "Microphone" },
  { value: "SPEAKER", label: "Speaker" },
  { value: "LAPTOP", label: "Laptop" },
  { value: "EXTENSION_CORD", label: "Extension Cord" },
  { value: "OTHER", label: "Other" },
];

export function equipmentTypeLabel(t: EquipmentType) {
  return EQUIPMENT_TYPES.find((x) => x.value === t)?.label ?? "Other";
}

// The brief's own colour key: Blue = Projector, Purple = Microphone,
// Green = Speaker, Orange = Laptop, Gray = everything else.
export const EQUIPMENT_COLORS: Record<EquipmentType, { fg: string; bg: string }> = {
  PROJECTOR: { fg: "#1d4fd8", bg: "#e8eefc" },
  MICROPHONE: { fg: "#6d28d9", bg: "#f0e9fd" },
  SPEAKER: { fg: "#0b7a4b", bg: "#e0f4ea" },
  LAPTOP: { fg: "#b45309", bg: "#fdefdc" },
  EXTENSION_CORD: { fg: "#52627a", bg: "#e9edf3" },
  OTHER: { fg: "#52627a", bg: "#e9edf3" },
};

export const EQUIPMENT_STATUS_LABEL: Record<EquipmentStatus, string> = {
  AVAILABLE: "Available",
  MAINTENANCE: "Maintenance",
  UNAVAILABLE: "Unavailable",
  RETIRED: "Retired",
};
export const EQUIPMENT_STATUS_BADGE: Record<EquipmentStatus, string> = {
  AVAILABLE: "badge-ok",
  MAINTENANCE: "badge-warn",
  UNAVAILABLE: "badge-off",
  RETIRED: "badge-off",
};

export const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  AVAILABLE: "Available",
  UNAVAILABLE: "Unavailable",
};

export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
};

export const MIN_RESERVATION_MINUTES = 15;
