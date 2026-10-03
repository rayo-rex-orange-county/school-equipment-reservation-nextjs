import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { equipmentSchema } from "@/lib/validators";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = equipmentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const clash = await prisma.equipment.findFirst({ where: { name: parsed.data.name, id: { not: params.id } } });
  if (clash) return NextResponse.json({ error: "Another item already uses that name." }, { status: 409 });

  const equipment = await prisma.equipment
    .update({ where: { id: params.id }, data: parsed.data })
    .catch(() => null);
  if (!equipment) return NextResponse.json({ error: "That item no longer exists." }, { status: 404 });
  return NextResponse.json({ equipment });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }
  // Removing the equipment also removes its join rows (onDelete: Cascade in
  // the schema) but leaves the reservations themselves intact with their
  // other items, matching the admin UI's warning before this is called.
  await prisma.equipment.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
