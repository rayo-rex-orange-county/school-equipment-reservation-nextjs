import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { getSession } from "./session";
import type { User } from "@prisma/client";

export type SafeUser = Omit<User, "passwordHash">;

function strip(user: User): SafeUser {
  const { passwordHash, ...safe } = user;
  return safe;
}

/** For server components and API routes alike: the signed-in user, or null.
 *  Never returns the password hash — callers cannot leak it even by accident. */
export async function getCurrentUser(): Promise<SafeUser | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status === "DISABLED") return null;
  return strip(user);
}

/** Server-component guard: redirects to /login instead of rendering. */
export async function requireUser(): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Server-component guard for admin-only pages. A teacher who lands here is
 *  sent to their own dashboard rather than seeing a bare 403 page. */
export async function requireAdmin(): Promise<SafeUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
