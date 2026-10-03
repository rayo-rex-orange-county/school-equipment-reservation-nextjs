import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { profileSchema } from "@/lib/validators";

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const clash = await prisma.user.findFirst({ where: { email: parsed.data.email, id: { not: user.id } } });
  if (clash) return NextResponse.json({ error: "Another account already uses that email address." }, { status: 409 });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name, email: parsed.data.email },
    select: { id: true, name: true, email: true, role: true },
  });
  return NextResponse.json({ user: updated });
}
