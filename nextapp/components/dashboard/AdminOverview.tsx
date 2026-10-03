import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDateLong, todayStr, addDaysStr, startOfDayInstant } from "@/lib/datetime";

export async function AdminOverview() {
  const now = new Date();
  const today = todayStr();
  // See TeacherDashboard.tsx / lib/datetime.ts: day boundaries use the
  // school's fixed timezone, not this process's own local clock.
  const startOfToday = startOfDayInstant(today);
  const startOfTomorrow = startOfDayInstant(addDaysStr(today, 1));
  const startOfNextWeek = startOfDayInstant(addDaysStr(today, 7));

  const [totalEquipment, available, maintenance, activeNow, todayCount, weekCount, teachers, admins, rooms] =
    await Promise.all([
      prisma.equipment.count(),
      prisma.equipment.count({ where: { status: "AVAILABLE" } }),
      prisma.equipment.count({ where: { status: "MAINTENANCE" } }),
      prisma.reservation.findMany({
        where: { status: "CONFIRMED", startDateTime: { lte: now }, endDateTime: { gt: now } },
        include: { equipment: true },
      }),
      prisma.reservation.count({ where: { status: "CONFIRMED", startDateTime: { gte: startOfToday, lt: startOfTomorrow } } }),
      prisma.reservation.count({ where: { status: "CONFIRMED", startDateTime: { gte: startOfToday, lt: startOfNextWeek } } }),
      prisma.user.count({ where: { role: "TEACHER" } }),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.room.count(),
    ]);

  const todayReservations = await prisma.reservation.findMany({
    where: { status: "CONFIRMED", startDateTime: { gte: startOfToday, lt: startOfTomorrow } },
    orderBy: { startDateTime: "asc" },
    include: { room: true, user: true, equipment: { include: { equipment: true } } },
  });

  const busyCount = new Set(activeNow.flatMap((r) => r.equipment.map((e) => e.equipmentId))).size;

  return (
    <>
      <div className="page-head">
        <div><h1>Administration overview</h1><p>{fmtDateLong(today)} · every reservation, item and room in one place</p></div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin/equipment" className="btn btn-ghost">Manage equipment</Link>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><div className="n">{totalEquipment}</div><div className="k">Total equipment</div></div>
        <div className="stat ok"><div className="n">{available}</div><div className="k">Available to book</div></div>
        <div className="stat busy"><div className="n">{busyCount}</div><div className="k">In use right now</div></div>
        <div className="stat warn"><div className="n">{maintenance}</div><div className="k">Under maintenance</div></div>
        <div className="stat accent"><div className="n">{todayCount}</div><div className="k">Reservations today</div></div>
        <div className="stat accent"><div className="n">{weekCount}</div><div className="k">Next 7 days</div></div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h3>Today across the school</h3><Link href="/calendar" className="btn btn-sm btn-ghost">Calendar</Link></div>
          {todayReservations.length ? todayReservations.map((r) => (
            <div className="res-item" key={r.id}>
              <span className="res-bar" style={{ background: "var(--blue)" }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="res-title">{r.equipment.map((e) => e.equipment.name).join(" + ") || "No equipment"}</div>
                <div className="res-meta">{r.room.name} · {r.user.name}</div>
              </div>
            </div>
          )) : <div className="empty"><strong>Nothing booked today</strong>The equipment room is quiet.</div>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card">
            <div className="card-head"><h3>Accounts</h3><Link href="/admin/users" className="btn btn-sm btn-ghost">Manage</Link></div>
            <div className="card-pad" style={{ display: "flex", gap: 22 }}>
              <div><div style={{ fontSize: 22, fontWeight: 700 }}>{teachers}</div><div className="tiny muted">Teachers</div></div>
              <div><div style={{ fontSize: 22, fontWeight: 700 }}>{admins}</div><div className="tiny muted">Administrators</div></div>
              <div><div style={{ fontSize: 22, fontWeight: 700 }}>{rooms}</div><div className="tiny muted">Rooms</div></div>
            </div>
          </div>
          <div className="card card-pad">
            <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Quick links</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link href="/admin/reservations" className="btn btn-ghost btn-block">All reservations</Link>
              <Link href="/admin/rooms" className="btn btn-ghost btn-block">Manage rooms</Link>
              <Link href="/admin/settings" className="btn btn-ghost btn-block">Settings</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
