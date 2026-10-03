import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { z } from "zod";

// Simplified for this demo: confirming the email is enough to set a new
// password immediately. A production deployment should instead email a
// signed, single-use, expiring link and only accept a new password once
// that link is opened — swap this handler for one that verifies such a
// token instead of trusting the email address alone.
const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Use a password of at least 8 characters."),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return NextResponse.json({ error: "No account uses that email address." }, { status: 404 });

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.password) } });
  return NextResponse.json({ ok: true });
}
