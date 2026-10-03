import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { equipmentSchema } from "@/lib/validators";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const equipment = await prisma.equipment.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ equipment });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = equipmentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const clash = await prisma.equipment.findUnique({ where: { name: parsed.data.name } });
  if (clash) return NextResponse.json({ error: "Another item already uses that name." }, { status: 409 });

  const equipment = await prisma.equipment.create({ data: parsed.data });
  return NextResponse.json({ equipment }, { status: 201 });
}
