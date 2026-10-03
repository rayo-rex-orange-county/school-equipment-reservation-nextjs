import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { registerSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account already uses that email address." }, { status: 409 });
  }

  // New self-registered accounts always start as TEACHER; only an
  // administrator can promote one afterward (see /api/users/[id]).
  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password), role: "TEACHER", status: "ACTIVE" },
  });

  await createSession({ userId: user.id, role: user.role });
  return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role });
}
