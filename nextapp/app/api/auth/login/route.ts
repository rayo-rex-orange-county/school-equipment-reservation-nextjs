import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { loginSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  // Same generic message for "no such user" and "wrong password" — being
  // specific here would let an attacker enumerate registered emails.
  const invalid = () => NextResponse.json({ error: "That email and password do not match." }, { status: 401 });
  if (!user) return invalid();
  if (user.status === "DISABLED") {
    return NextResponse.json(
      { error: "This account has been disabled. Ask an administrator to restore it." },
      { status: 403 }
    );
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return invalid();

  await createSession({ userId: user.id, role: user.role });
  return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role });
}
