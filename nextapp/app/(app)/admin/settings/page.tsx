import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MIN_RESERVATION_MINUTES } from "@/lib/constants";
import { fmtDate, fmtRange, toDateStr, toTimeStr } from "@/lib/datetime";
import { splitPurpose } from "@/lib/types";

export default async function SettingsPage() {
  await requireAdmin();

  const [userCount, equipmentCount, roomCount, reservationCount, activeCount, recentPast] = await Promise.all([
    prisma.user.count(),
    prisma.equipment.count(),
    prisma.room.count(),
    prisma.reservation.count(),
    prisma.reservation.count({ where: { status: "CONFIRMED" } }),
    prisma.reservation.findMany({
      where: { status: "CONFIRMED", endDateTime: { lt: new Date() } },
      orderBy: { startDateTime: "desc" },
      take: 8,
      include: { room: true, user: true, equipment: { include: { equipment: true } } },
    }),
  ]);

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="srow" style={{ border: "none", padding: "7px 0" }}><dt>{label}</dt><dd>{value}</dd></div>
  );

  return (
    <>
      <div className="page-head"><div><h1>Settings</h1><p>How this system is configured, and the rules it enforces.</p></div></div>
      <div className="grid-2">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card">
            <div className="card-head"><h3>Booking rules in force</h3></div>
            <div className="card-pad">
              <Row label="Equipment double-booking" value="Blocked" />
              <Row label="Room double-booking" value="Blocked" />
              <Row label="Back-to-back slots" value="Allowed (9–11 then 11–1)" />
              <Row label="Shortest reservation" value={`${MIN_RESERVATION_MINUTES} minutes`} />
              <Row label="Booking in the past" value="Blocked" />
              <Row label="Items under maintenance" value="Cannot be selected" />
              <p className="hint" style={{ marginTop: 12 }}>
                Every check re-runs against the database inside a Postgres SERIALIZABLE transaction at the moment of
                saving — not only in the browser — so two teachers submitting at once cannot both win the same slot.
                See <code>lib/conflicts.ts</code>.
              </p>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Notifications</h3></div>
            <div className="card-pad">
              <p className="tiny muted" style={{ margin: "0 0 10px" }}>
                In-app toasts fire on every booking change. Email delivery is the one piece a school would wire up
                against its own mail server — see the comment in <code>app/api/auth/reset/route.ts</code> for where
                that would plug in.
              </p>
              <Row label="Reservation created" value={<span className="badge badge-ok badge-plain">In-app</span>} />
              <Row label="Reservation edited" value={<span className="badge badge-ok badge-plain">In-app</span>} />
              <Row label="Reservation cancelled" value={<span className="badge badge-ok badge-plain">In-app</span>} />
              <Row label="Conflict blocked" value={<span className="badge badge-ok badge-plain">In-app</span>} />
              <Row label="Email delivery" value={<span className="badge badge-off badge-plain">Not configured</span>} />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card">
            <div className="card-head"><h3>Data</h3></div>
            <div className="card-pad">
              <Row label="Storage" value="PostgreSQL (via Prisma)" />
              <Row label="Accounts" value={userCount} />
              <Row label="Equipment" value={equipmentCount} />
              <Row label="Rooms" value={roomCount} />
              <Row label="Reservations" value={<>{reservationCount} <span className="muted tiny">({activeCount} active)</span></>} />
              <p className="tiny muted" style={{ margin: "12px 0 0" }}>
                Passwords are stored as bcrypt hashes (12 rounds). No plaintext password is ever written to the database.
              </p>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Usage history</h3></div>
            <div className="card-pad">
              {recentPast.length ? recentPast.map((r) => {
                const { event } = splitPurpose(r.purpose);
                return (
                  <div key={r.id} style={{ padding: "7px 0", borderBottom: "1px solid var(--line)", fontSize: 13.5 }}>
                    <b>{r.equipment.map((e) => e.equipment.name).join(" + ") || event}</b><br />
                    <span className="muted tiny">
                      {fmtDate(toDateStr(r.startDateTime))} · {fmtRange(toTimeStr(r.startDateTime), toTimeStr(r.endDateTime))} · {r.room.name} · {r.user.name}
                    </span>
                  </div>
                );
              }) : <p className="tiny muted" style={{ margin: 0 }}>No completed bookings recorded yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
