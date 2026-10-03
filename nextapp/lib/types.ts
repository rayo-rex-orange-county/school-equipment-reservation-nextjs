// Prisma's Date fields arrive over JSON as ISO strings — these types describe
// what a client component actually receives from fetch(), not the Prisma
// model itself.

export type EquipmentType = "PROJECTOR" | "MICROPHONE" | "SPEAKER" | "LAPTOP" | "EXTENSION_CORD" | "OTHER";
export type EquipmentStatus = "AVAILABLE" | "MAINTENANCE" | "UNAVAILABLE" | "RETIRED";
export type RoomStatus = "AVAILABLE" | "UNAVAILABLE";
export type ReservationStatus = "CONFIRMED" | "CANCELLED";
export type Role = "TEACHER" | "ADMIN";
export type UserStatus = "ACTIVE" | "DISABLED";

export type ApiEquipment = {
  id: string; name: string; type: EquipmentType; status: EquipmentStatus;
  location: string | null; condition: string | null; description: string | null;
};

export type ApiRoom = {
  id: string; name: string; building: string | null; capacity: number | null; status: RoomStatus;
};

export type ApiUserLite = { id: string; name: string; email?: string };

export type ApiReservation = {
  id: string;
  userId: string;
  roomId: string;
  startDateTime: string;
  endDateTime: string;
  purpose: string;
  notes: string | null;
  status: ReservationStatus;
  room: ApiRoom;
  user: ApiUserLite;
  equipment: { equipmentId: string; equipment: ApiEquipment }[];
};

export type ApiUser = {
  id: string; name: string; email: string; role: Role; status: UserStatus; createdAt: string;
};

/** Reservations store `purpose` as "Activity — Purpose" (see lib/conflicts.ts).
 *  Split it back apart for display; older or purpose-less rows just show
 *  the activity name. */
export function splitPurpose(stored: string): { event: string; purpose: string } {
  const i = stored.indexOf(" \u2014 ");
  if (i === -1) return { event: stored, purpose: "" };
  return { event: stored.slice(0, i), purpose: stored.slice(i + 3) };
}
