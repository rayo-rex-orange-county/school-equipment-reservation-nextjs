import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { roomSchema } from "@/lib/validators";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const rooms = await prisma.room.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ rooms });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = roomSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const clash = await prisma.room.findUnique({ where: { name: parsed.data.name } });
  if (clash) return NextResponse.json({ error: "A room with that name already exists." }, { status: 409 });

  const room = await prisma.room.create({ data: parsed.data });
  return NextResponse.json({ room }, { status: 201 });
}
