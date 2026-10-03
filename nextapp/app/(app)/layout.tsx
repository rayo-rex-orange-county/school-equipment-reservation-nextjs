import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

// Middleware already redirects signed-out visitors before this ever renders;
// requireUser() here is the second, server-rendered layer of the same
// check — belt and suspenders, and it's what supplies the user's name/role
// to the shell.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AppShell user={{ name: user.name, email: user.email, role: user.role }}>{children}</AppShell>;
}
