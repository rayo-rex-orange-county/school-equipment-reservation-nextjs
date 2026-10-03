import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { reservationSchema } from "@/lib/validators";
import { updateReservation, cancelReservation, ReservationError } from "@/lib/conflicts";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = reservationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  try {
    const reservation = await updateReservation(params.id, parsed.data, user.id, user.role === "ADMIN");
    return NextResponse.json({ reservation });
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

/** Soft delete (cancel) is the default from the UI — it frees the slot but
 *  keeps the record in history. Pass ?hard=1 for the admin-only permanent
 *  delete used from the admin reservations table. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const hard = new URL(req.url).searchParams.get("hard") === "1";
  if (hard) {
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    await prisma.reservation.delete({ where: { id: params.id } }).catch(() => null);
    return NextResponse.json({ ok: true });
  }

  try {
    const reservation = await cancelReservation(params.id, user.id, user.role === "ADMIN");
    return NextResponse.json({ reservation });
  } catch (err) {
    if (err instanceof ReservationError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error(err);
    return NextResponse.json({ error: "Could not cancel the reservation." }, { status: 500 });
  }
}
