import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { roomSchema } from "@/lib/validators";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = roomSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const clash = await prisma.room.findFirst({ where: { name: parsed.data.name, id: { not: params.id } } });
  if (clash) return NextResponse.json({ error: "Another room already uses that name." }, { status: 409 });

  const room = await prisma.room.update({ where: { id: params.id }, data: parsed.data }).catch(() => null);
  if (!room) return NextResponse.json({ error: "That room no longer exists." }, { status: 404 });
  return NextResponse.json({ room });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }
  const inUse = await prisma.reservation.count({
    where: { roomId: params.id, status: "CONFIRMED", startDateTime: { gte: new Date() } },
  });
  if (inUse > 0) {
    return NextResponse.json(
      { error: `This room is used by ${inUse} upcoming reservation(s). Mark it unavailable instead, or cancel those first.` },
      { status: 409 }
    );
  }
  await prisma.room.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
