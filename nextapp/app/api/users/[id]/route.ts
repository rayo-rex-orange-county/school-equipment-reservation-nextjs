import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { userUpdateSchema } from "@/lib/validators";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const clash = await prisma.user.findFirst({ where: { email: parsed.data.email, id: { not: params.id } } });
  if (clash) return NextResponse.json({ error: "Another account already uses that email address." }, { status: 409 });

  // An admin cannot lock themselves out by disabling or demoting their own
  // only account from this dialog — the "you" row in the UI hides the
  // control, and this is the server-side backstop for it.
  if (params.id === user.id && (parsed.data.status === "DISABLED" || parsed.data.role !== "ADMIN")) {
    return NextResponse.json({ error: "You cannot disable or demote your own account." }, { status: 400 });
  }

  const data: Record<string, unknown> = {
    name: parsed.data.name,
    email: parsed.data.email,
    role: parsed.data.role,
    status: parsed.data.status,
  };
  if (parsed.data.password) data.passwordHash = await hashPassword(parsed.data.password);

  const updated = await prisma.user
    .update({ where: { id: params.id }, data, select: { id: true, name: true, email: true, role: true, status: true } })
    .catch(() => null);
  if (!updated) return NextResponse.json({ error: "That account no longer exists." }, { status: 404 });
  return NextResponse.json({ user: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  if (params.id === user.id) return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });

  await prisma.user.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
