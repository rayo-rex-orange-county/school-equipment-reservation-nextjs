import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { reservationSchema } from "@/lib/validators";
import { createReservation, ReservationError } from "@/lib/conflicts";

// The calendar is shared across the whole school (see the brief: "view
// reservations in a calendar-style interface"), so any signed-in teacher can
// read every reservation. Only mutation routes restrict by ownership/role.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mineOnly = searchParams.get("mine") === "1";
  const status = searchParams.get("status"); // CONFIRMED | CANCELLED | undefined (both)
  const from = searchParams.get("from"); // ISO date, inclusive
  const to = searchParams.get("to"); // ISO date, exclusive

  const reservations = await prisma.reservation.findMany({
    where: {
      userId: mineOnly ? user.id : undefined,
      status: status === "CONFIRMED" || status === "CANCELLED" ? status : undefined,
      startDateTime: from ? { gte: new Date(from) } : undefined,
      endDateTime: to ? { lte: new Date(to) } : undefined,
    },
    include: {
      room: true,
      user: { select: { id: true, name: true } },
      equipment: { include: { equipment: true } },
    },
    orderBy: { startDateTime: "asc" },
  });
  return NextResponse.json({ reservations });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = reservationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  // A teacher can only ever book for themselves; the body's userId is
  // trusted only when the caller is an admin booking on a teacher's behalf.
  const targetUserId = user.role === "ADMIN" && parsed.data.userId ? parsed.data.userId : user.id;

  try {
    const reservation = await createReservation(parsed.data, user.id, targetUserId);
    return NextResponse.json({ reservation }, { status: 201 });
  } catch (err) {
    if (err instanceof ReservationError) {
      return NextResponse.json(
        { error: err.message, code: err.code, conflicts: err.conflicts },
        { status: err.code === "CONFLICT" ? 409 : 400 }
      );
    }
    console.error(err);
    return NextResponse.json({ error: "The reservation could not be saved. Try again." }, { status: 500 });
  }
}
