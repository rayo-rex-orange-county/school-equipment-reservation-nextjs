"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

type NavItem = { href: string; label: string };
const TEACHER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
  { href: "/equipment", label: "Equipment" },
  { href: "/reserve", label: "Make a reservation" },
  { href: "/mine", label: "My reservations" },
  { href: "/profile", label: "Profile" },
];
const ADMIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
  { href: "/admin/reservations", label: "Reservations" },
  { href: "/admin/equipment", label: "Equipment" },
  { href: "/admin/rooms", label: "Rooms" },
  { href: "/admin/users", label: "Users" },
  { href: "/reserve", label: "Make a reservation" },
  { href: "/admin/settings", label: "Settings" },
];

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function AppShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: "TEACHER" | "ADMIN" };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const nav = user.role === "ADMIN" ? ADMIN_NAV : TEACHER_NAV;

  async function logout() {
    await api.post("/api/auth/logout");
    router.push("/login");
    router.refresh();
  }

  const navLinks = (
    <>
      <div className="nav">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={active ? "on" : ""} onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="side-foot">
        <span className="avatar">{initials(user.name)}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <b style={{ display: "block", fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.name}
          </b>
          <span style={{ fontSize: 11.5, color: "var(--ink3)", fontWeight: 600 }}>
            {user.role === "ADMIN" ? "Administrator" : "Teacher"}
          </span>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={logout} title="Sign out" aria-label="Sign out">
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <span className="brand-mark">🎓</span>
          <span>
            <div style={{ fontFamily: "var(--serif)", fontWeight: 700, fontSize: 15 }}>Equipment Reservation</div>
            <div style={{ fontSize: 11.5, color: "var(--ink3)", fontWeight: 600 }}>Central Visayan Institute Foundation</div>
          </span>
        </div>
        {navLinks}
      </aside>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(10,16,26,.5)", zIndex: 55 }}
        />
      )}
      {open && (
        <aside className="side" style={{ position: "fixed", inset: "0 auto 0 0", width: 270, zIndex: 60, display: "flex" }}>
          <div className="brand">
            <span className="brand-mark">🎓</span>
            <b style={{ fontSize: 14 }}>Equipment Reservation</b>
          </div>
          {navLinks}
        </aside>
      )}

      <div className="main">
        <div className="topbar">
          <button className="btn btn-sm btn-ghost" onClick={() => setOpen(true)} aria-label="Open menu">☰</button>
          <span style={{ fontWeight: 700 }}>Equipment Reservation</span>
        </div>
        <div className="page">{children}</div>
      </div>
    </div>
  );
}
