import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { userUpdateSchema } from "@/lib/validators";
import { z } from "zod";

const createSchema = userUpdateSchema.extend({ password: z.string().min(8, "Set a temporary password of at least 8 characters.") });

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
  });
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const clash = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (clash) return NextResponse.json({ error: "Another account already uses that email address." }, { status: 409 });

  const created = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      status: parsed.data.status,
      passwordHash: await hashPassword(parsed.data.password),
    },
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
  });
  return NextResponse.json({ user: created }, { status: 201 });
}
