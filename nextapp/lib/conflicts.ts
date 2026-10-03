import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { combineDateTime, overlaps, fmtDate, fmtTime, toDateStr, toTimeStr, startOfDayInstant } from "./datetime";
import { MIN_RESERVATION_MINUTES } from "./constants";
import type { ReservationInput } from "./validators";

export class ReservationError extends Error {
  code: "VALIDATION" | "CONFLICT";
  conflicts?: ConflictDetail[];
  constructor(message: string, code: "VALIDATION" | "CONFLICT", conflicts?: ConflictDetail[]) {
    super(message);
    this.code = code;
    this.conflicts = conflicts;
  }
}

export type ConflictDetail = {
  kind: "equipment" | "room";
  subject: string;
  message: string;
};

/** Every overlap check and every write go through here — no route ever
 *  touches `prisma.reservation.create` / `.update` directly, so the rule
 *  "no double-booking" cannot be bypassed by a future endpoint. */

async function loadOverlapping(tx: Prisma.TransactionClient, start: Date, end: Date, excludeId?: string) {
  return tx.reservation.findMany({
    where: {
      status: "CONFIRMED",
      id: excludeId ? { not: excludeId } : undefined,
      startDateTime: { lt: end },
      endDateTime: { gt: start },
    },
    include: { equipment: { include: { equipment: true } }, room: true, user: true },
  });
}

function detectConflicts(
  candidateRoomId: string,
  candidateEquipmentIds: string[],
  start: Date,
  end: Date,
  others: Awaited<ReturnType<typeof loadOverlapping>>
): ConflictDetail[] {
  const out: ConflictDetail[] = [];
  for (const r of others) {
    if (!overlaps(start, end, r.startDateTime, r.endDateTime)) continue; // defensive; query already filtered

    const clashingItems = r.equipment.filter((re) => candidateEquipmentIds.includes(re.equipmentId));
    for (const re of clashingItems) {
      out.push({
        kind: "equipment",
        subject: re.equipment.name,
        message:
          `${re.equipment.name} is already reserved from ${fmtTime(toTimeStr(r.startDateTime))} to ` +
          `${fmtTime(toTimeStr(r.endDateTime))} on ${fmtDate(toDateStr(r.startDateTime))} by ${r.user.name}. ` +
          `Please select another time or another item.`,
      });
    }
    if (candidateRoomId && r.roomId === candidateRoomId) {
      out.push({
        kind: "room",
        subject: r.room.name,
        message:
          `${r.room.name} is already booked from ${fmtTime(toTimeStr(r.startDateTime))} to ` +
          `${fmtTime(toTimeStr(r.endDateTime))} on ${fmtDate(toDateStr(r.startDateTime))} by ${r.user.name}. ` +
          `Please select another time or another room.`,
      });
    }
  }
  return out;
}

async function validateStructure(input: ReservationInput, start: Date, end: Date) {
  const errors: string[] = [];
  if (end.getTime() <= start.getTime()) errors.push("The end time must be after the start time.");
  else if ((end.getTime() - start.getTime()) / 60000 < MIN_RESERVATION_MINUTES) {
    errors.push(`A reservation must run for at least ${MIN_RESERVATION_MINUTES} minutes.`);
  }
  if (start.getTime() < Date.now() - 60_000) errors.push("That date and time have already passed.");

  const room = await prisma.room.findUnique({ where: { id: input.roomId } });
  if (!room) errors.push("That room no longer exists.");
  else if (room.status !== "AVAILABLE") errors.push(`${room.name} is currently marked unavailable.`);

  const items = await prisma.equipment.findMany({ where: { id: { in: input.equipmentIds } } });
  if (items.length !== input.equipmentIds.length) errors.push("One of the selected items no longer exists.");
  for (const item of items) {
    if (item.status !== "AVAILABLE") {
      errors.push(`${item.name} is marked ${item.status.toLowerCase()} and cannot be reserved.`);
    }
  }
  return errors;
}

/** Creates a reservation, or throws ReservationError with either field
 *  errors (code VALIDATION) or scheduling clashes (code CONFLICT, with full
 *  detail for the UI to display). Runs at SERIALIZABLE isolation so that two
 *  requests racing for the same slot cannot both succeed — Postgres aborts
 *  the loser with a serialization failure, which is retried once here as a
 *  fresh conflict check rather than surfaced as a generic 500. */
export async function createReservation(input: ReservationInput, requestedByUserId: string, targetUserId: string) {
  const start = combineDateTime(input.date, input.start);
  const end = combineDateTime(input.date, input.end);

  const structural = await validateStructure(input, start, end);
  if (structural.length) throw new ReservationError(structural[0], "VALIDATION");

  return runSerializable(async (tx) => {
    const others = await loadOverlapping(tx, start, end);
    const conflicts = detectConflicts(input.roomId, input.equipmentIds, start, end, others);
    if (conflicts.length) throw new ReservationError(conflicts[0].message, "CONFLICT", conflicts);

    return tx.reservation.create({
      data: {
        userId: targetUserId,
        roomId: input.roomId,
        startDateTime: start,
        endDateTime: end,
        purpose: input.event + (input.purpose ? ` \u2014 ${input.purpose}` : ""),
        notes: input.notes || null,
        status: "CONFIRMED",
        equipment: { create: input.equipmentIds.map((equipmentId) => ({ equipmentId })) },
      },
      include: { equipment: { include: { equipment: true } }, room: true, user: true },
    });
  });
}

/** Same gate as create, applied to an edit. The reservation being edited is
 *  excluded from its own conflict check so moving it within its previous
 *  slot (or not moving it at all) never flags itself. */
export async function updateReservation(
  reservationId: string,
  input: ReservationInput,
  requestingUserId: string,
  isAdmin: boolean
) {
  const existing = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!existing) throw new ReservationError("That reservation no longer exists.", "VALIDATION");
  if (!isAdmin && existing.userId !== requestingUserId) {
    throw new ReservationError("Only the teacher who booked this, or an administrator, can change it.", "VALIDATION");
  }

  const start = combineDateTime(input.date, input.start);
  const end = combineDateTime(input.date, input.end);
  const structural = await validateStructure(input, start, end);
  if (structural.length) throw new ReservationError(structural[0], "VALIDATION");

  return runSerializable(async (tx) => {
    const others = await loadOverlapping(tx, start, end, reservationId);
    const conflicts = detectConflicts(input.roomId, input.equipmentIds, start, end, others);
    if (conflicts.length) throw new ReservationError(conflicts[0].message, "CONFLICT", conflicts);

    await tx.reservationEquipment.deleteMany({ where: { reservationId } });
    return tx.reservation.update({
      where: { id: reservationId },
      data: {
        roomId: input.roomId,
        startDateTime: start,
        endDateTime: end,
        purpose: input.event + (input.purpose ? ` \u2014 ${input.purpose}` : ""),
        notes: input.notes || null,
        equipment: { create: input.equipmentIds.map((equipmentId) => ({ equipmentId })) },
      },
      include: { equipment: { include: { equipment: true } }, room: true, user: true },
    });
  });
}

export async function cancelReservation(reservationId: string, requestingUserId: string, isAdmin: boolean) {
  const existing = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!existing) throw new ReservationError("That reservation no longer exists.", "VALIDATION");
  if (!isAdmin && existing.userId !== requestingUserId) {
    throw new ReservationError("Only the teacher who booked this, or an administrator, can cancel it.", "VALIDATION");
  }
  return prisma.reservation.update({
    where: { id: reservationId },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
}

async function runSerializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  try {
    return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (err: any) {
    // Postgres serialization failure (code 40001): the two racing requests
    // cannot both be right — the one that lands here retries the conflict
    // check once against the now-committed state instead of surfacing a 500.
    if (err?.code === "P2034") {
      return prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }
    throw err;
  }
}
