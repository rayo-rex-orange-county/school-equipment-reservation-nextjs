import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDateLong, fmtRange, toDateStr, toTimeStr, todayStr, addDaysStr, startOfDayInstant } from "@/lib/datetime";
import { splitPurpose } from "@/lib/types";
import { EQUIPMENT_COLORS } from "@/lib/constants";
import type { SafeUser } from "@/lib/auth";

function relDay(dateStr: string, today: string) {
  if (dateStr === today) return "Today";
  const t = new Date(today), d = new Date(dateStr);
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff === 1) return "Tomorrow";
  return fmtDateLong(dateStr);
}

export async function TeacherDashboard({ user }: { user: SafeUser }) {
  const now = new Date();
  const today = todayStr();
  // Day boundaries are computed in the school's fixed timezone (not this
  // server process's own local time — see lib/datetime.ts), so "today"
  // means the same thing no matter where this runs.
  const startOfToday = startOfDayInstant(today);
  const startOfTomorrow = startOfDayInstant(addDaysStr(today, 1));

  const [upcoming, todayAcrossSchool, allEquipment, activeNow] = await Promise.all([
    prisma.reservation.findMany({
      where: { userId: user.id, status: "CONFIRMED", endDateTime: { gt: now } },
      orderBy: { startDateTime: "asc" },
      include: { room: true, equipment: { include: { equipment: true } } },
      take: 5,
    }),
    prisma.reservation.findMany({
      where: { status: "CONFIRMED", startDateTime: { gte: startOfToday, lt: startOfTomorrow } },
      orderBy: { startDateTime: "asc" },
      include: { room: true, user: true, equipment: { include: { equipment: true } } },
    }),
    prisma.equipment.findMany(),
    prisma.reservation.findMany({
      where: { status: "CONFIRMED", startDateTime: { lte: now }, endDateTime: { gt: now } },
      include: { room: true, equipment: true },
    }),
  ]);

  const busyIds = new Set(activeNow.flatMap((r) => r.equipment.map((e) => e.equipmentId)));
  const bookable = allEquipment.filter((e) => e.status === "AVAILABLE");
  const freeNow = bookable.filter((e) => !busyIds.has(e.id));
  const busyNow = bookable.filter((e) => busyIds.has(e.id));
  const maintenance = allEquipment.filter((e) => e.status === "MAINTENANCE");
  const next = upcoming[0];

  return (
    <>
      <h1 className="font-serif" style={{ fontSize: "clamp(23px,3.4vw,31px)", margin: "0 0 3px", fontWeight: 700 }}>
        Welcome, {user.name}.
      </h1>
      <p className="muted" style={{ margin: "0 0 20px", fontSize: 14 }}>
        {fmtDateLong(today)} · {todayAcrossSchool.length
          ? `${todayAcrossSchool.length} booking${todayAcrossSchool.length === 1 ? "" : "s"} across the school today`
          : "No equipment booked across the school today"}
      </p>

      <div className="stats">
        <div className="stat ok"><div className="n">{freeNow.length}</div><div className="k">Available right now</div></div>
        <div className="stat busy"><div className="n">{busyNow.length}</div><div className="k">In use right now</div></div>
        <div className="stat warn"><div className="n">{maintenance.length}</div><div className="k">Under maintenance</div></div>
        <div className="stat accent"><div className="n">{upcoming.length}</div><div className="k">Your upcoming reservations</div></div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <Link href="/reserve" className="btn btn-primary btn-lg">+ Make a reservation</Link>
        <Link href="/equipment" className="btn btn-ghost">Check availability</Link>
        <Link href="/calendar" className="btn btn-ghost">Open calendar</Link>
      </div>

      <div className="grid-2">
        <div className="stack" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card">
            <div className="card-head"><h3>Your upcoming reservations</h3><Link href="/mine" className="btn btn-sm btn-ghost">See all</Link></div>
            {upcoming.length ? upcoming.slice(0, 4).map((r) => {
              const { event } = splitPurpose(r.purpose);
              const first = r.equipment[0]?.equipment;
              return (
                <div className="res-item" key={r.id}>
                  <span className="res-bar" style={{ background: first ? EQUIPMENT_COLORS[first.type].fg : "var(--eq-other)" }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="res-title">{r.equipment.map((e) => e.equipment.name).join(" + ") || "No equipment"}</div>
                    <div className="res-meta">
                      {r.room.name} · {relDay(toDateStr(r.startDateTime), today)} · {fmtRange(toTimeStr(r.startDateTime), toTimeStr(r.endDateTime))}
                      <br /><span style={{ color: "var(--ink3)" }}>{event}</span>
                    </div>
                  </div>
                </div>
              );
            }) : <div className="empty"><strong>No upcoming reservations</strong>Anything you book will appear here.</div>}
          </div>

          <div className="card">
            <div className="card-head"><h3>Booked across the school today</h3><Link href="/calendar" className="btn btn-sm btn-ghost">Calendar</Link></div>
            {todayAcrossSchool.length ? todayAcrossSchool.map((r) => {
              const { event } = splitPurpose(r.purpose);
              const first = r.equipment[0]?.equipment;
              return (
                <div className="res-item" key={r.id}>
                  <span className="res-bar" style={{ background: first ? EQUIPMENT_COLORS[first.type].fg : "var(--eq-other)" }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="res-title">{r.equipment.map((e) => e.equipment.name).join(" + ") || "No equipment"}</div>
                    <div className="res-meta">
                      {r.room.name} · {fmtRange(toTimeStr(r.startDateTime), toTimeStr(r.endDateTime))} · {r.user.name}
                      <br /><span style={{ color: "var(--ink3)" }}>{event}</span>
                    </div>
                  </div>
                </div>
              );
            }) : <div className="empty"><strong>Nothing booked today</strong>Every item is free for the rest of the day.</div>}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {next ? (() => {
            const { event } = splitPurpose(next.purpose);
            return (
              <div className="next-up">
                <div className="eyebrow">Your next reservation</div>
                <div className="when">{relDay(toDateStr(next.startDateTime), today)}, {fmtRange(toTimeStr(next.startDateTime), toTimeStr(next.endDateTime))}</div>
                <div className="det">
                  <b>{next.equipment.map((e) => e.equipment.name).join(" + ")}</b><br />
                  {next.room.name} · {event}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <Link href={`/mine`} className="btn btn-sm" style={{ background: "rgba(255,255,255,.2)", color: "#fff" }}>View details</Link>
                  <Link href={`/reserve?edit=${next.id}`} className="btn btn-sm btn-ghost" style={{ color: "#fff", borderColor: "rgba(255,255,255,.4)" }}>Edit</Link>
                </div>
              </div>
            );
          })() : (
            <div className="card card-pad">
              <div className="empty" style={{ padding: "22px 6px" }}>
                <strong>Nothing booked yet</strong>Reserve a projector, microphone or speaker in under a minute.
                <div style={{ marginTop: 14 }}><Link href="/reserve" className="btn btn-primary">Make a reservation</Link></div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-head"><h3>Free right now</h3><span className="badge badge-ok badge-plain">{freeNow.length} items</span></div>
            <div className="card-pad" style={{ paddingTop: 14 }}>
              {freeNow.length ? freeNow.slice(0, 8).map((e) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--line)" }}>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className="chip-dot" style={{ background: EQUIPMENT_COLORS[e.type].fg }} />
                    <b style={{ fontSize: 14 }}>{e.name}</b>
                  </span>
                  <span className="tiny muted">{e.location}</span>
                </div>
              )) : <p className="muted tiny" style={{ margin: 0 }}>Everything is in use at the moment.</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
