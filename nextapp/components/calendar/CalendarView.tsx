"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ToastProvider";
import { ReservationDetailModal } from "@/components/ReservationDetailModal";
import { ConfirmDialog } from "@/components/ui/Modal";
import { EQUIPMENT_COLORS, EQUIPMENT_TYPES } from "@/lib/constants";
import { addDaysStr, fmtDate, fmtDateLong, fmtTime, todayStr, toDateStr, toTimeStr } from "@/lib/datetime";
import { splitPurpose, type ApiEquipment, type ApiReservation, type ApiRoom } from "@/lib/types";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_START = 6, DAY_END = 19, HOUR_PX = 46;

// Calendar-grid pagination deals only in bare calendar dates (walking
// months/weeks, finding which weekday a date falls on) — never in absolute
// instants — so these stay on plain UTC-anchored scratch Dates, deliberately
// separate from toDateStr/toTimeStr (which read real timestamps back in the
// school's fixed timezone, see lib/datetime.ts). Mixing the two up is
// exactly the bug that made calendar day-buckets drift when a viewer's
// browser timezone didn't match the server's.
function fromISO(iso: string) { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); }
function toISO(d: Date) { return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0"); }
function addD(d: Date, n: number) { const c = new Date(d); c.setUTCDate(c.getUTCDate() + n); return c; }
function weekStart(iso: string) { const d = fromISO(iso); const s = addD(d, -d.getUTCDay()); return toISO(s); }

export function CalendarView({ currentUserId, isAdmin }: { currentUserId: string; isAdmin: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<ApiReservation[]>([]);
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [view, setView] = useState<"month" | "week" | "day" | "agenda">("month");
  const [anchor, setAnchor] = useState(todayStr());
  const [filters, setFilters] = useState({ q: "", type: "", room: "", mine: false });
  const [detail, setDetail] = useState<ApiReservation | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ApiReservation | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [res, rm] = await Promise.all([api.get("/api/reservations"), api.get("/api/rooms")]);
    setReservations(res.reservations); setRooms(rm.rooms); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const events = useMemo(() => {
    let list = reservations;
    if (filters.mine) list = list.filter((r) => r.userId === currentUserId);
    if (filters.type) list = list.filter((r) => r.equipment.some((e) => e.equipment.type === filters.type));
    if (filters.room) list = list.filter((r) => r.roomId === filters.room);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      list = list.filter((r) => {
        const { event } = splitPurpose(r.purpose);
        return (event + " " + r.room.name + " " + r.user.name + " " + r.equipment.map((e) => e.equipment.name).join(" ")).toLowerCase().includes(q);
      });
    }
    return list;
  }, [reservations, filters, currentUserId]);

  function onDate(list: ApiReservation[], iso: string) {
    return list.filter((r) => toDateStr(new Date(r.startDateTime)) === iso).sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
  }

  const title = useMemo(() => {
    const a = fromISO(anchor);
    if (view === "day") return fmtDateLong(anchor);
    if (view === "week") {
      const s = weekStart(anchor), e = addDaysStr(s, 6);
      const sd = fromISO(s), ed = fromISO(e);
      return sd.getUTCMonth() === ed.getUTCMonth() ? `${MONTHS[sd.getUTCMonth()]} ${sd.getUTCDate()}\u2013${ed.getUTCDate()}, ${ed.getUTCFullYear()}` : `${fmtDate(s)} \u2013 ${fmtDate(e)}`;
    }
    if (view === "agenda") return "Next 21 days";
    return `${MONTHS[a.getUTCMonth()]} ${a.getUTCFullYear()}`;
  }, [anchor, view]);

  function step(n: number) {
    if (view === "month") { const d = fromISO(anchor); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); setAnchor(toISO(d)); }
    else if (view === "week") setAnchor(addDaysStr(anchor, 7 * n));
    else setAnchor(addDaysStr(anchor, n));
  }

  function evColor(r: ApiReservation) {
    const t = r.equipment[0]?.equipment.type;
    return t ? EQUIPMENT_COLORS[t] : EQUIPMENT_COLORS.OTHER;
  }

  const canManage = (r: ApiReservation) => isAdmin || r.userId === currentUserId;

  async function doCancel() {
    if (!cancelTarget) return;
    setBusy(true);
    try {
      await api.delete(`/api/reservations/${cancelTarget.id}`);
      const { event } = splitPurpose(cancelTarget.purpose);
      toast("Reservation cancelled", `${cancelTarget.equipment.map((e) => e.equipment.name).join(" + ")} is free again.`, "warn");
      setCancelTarget(null); setDetail(null);
      await load();
    } catch (err) {
      toast("Could not cancel", err instanceof ApiError ? err.message : "Try again.", "bad");
    } finally { setBusy(false); }
  }

  if (loading) return <div className="card card-pad"><p className="muted" style={{ margin: 0 }}>Loading the calendar…</p></div>;

  return (
    <>
      <div className="page-head">
        <div><h1>Equipment calendar</h1><p>Every booking in the school, colour-coded by equipment type.</p></div>
        <button className="btn btn-primary" onClick={() => router.push("/reserve")}>+ Make a reservation</button>
      </div>

      <div className="cal-bar">
        <button className="btn btn-sm btn-ghost" onClick={() => step(-1)} aria-label="Previous">←</button>
        <button className="btn btn-sm btn-ghost" onClick={() => setAnchor(todayStr())}>Today</button>
        <button className="btn btn-sm btn-ghost" onClick={() => step(1)} aria-label="Next">→</button>
        <span className="cal-title">{title}</span>
        <span style={{ flex: 1 }} />
        <div className="seg">
          {(["month", "week", "day", "agenda"] as const).map((k) => (
            <button key={k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{k[0].toUpperCase() + k.slice(1)}</button>
          ))}
        </div>
      </div>

      <div className="filters" style={{ gridTemplateColumns: "2fr 1fr 1fr auto" }}>
        <div className="field"><label>Search</label><input className="inp" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="Activity, teacher, room or item" /></div>
        <div className="field"><label>Equipment type</label>
          <select className="inp" value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
            <option value="">All types</option>{EQUIPMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select></div>
        <div className="field"><label>Room</label>
          <select className="inp" value={filters.room} onChange={(e) => setFilters((f) => ({ ...f, room: e.target.value }))}>
            <option value="">All rooms</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select></div>
        <div className="field"><label>Show</label>
          <select className="inp" value={filters.mine ? "1" : ""} onChange={(e) => setFilters((f) => ({ ...f, mine: e.target.value === "1" }))}>
            <option value="">Everyone</option><option value="1">Only mine</option>
          </select></div>
      </div>

      <div className="legend">
        {EQUIPMENT_TYPES.filter((t) => t.value !== "EXTENSION_CORD").map((t) => (
          <span key={t.value} className="chip"><span className="chip-dot" style={{ background: EQUIPMENT_COLORS[t.value].fg }} />{t.label}</span>
        ))}
      </div>

      {view === "month" && <MonthGrid anchor={anchor} events={events} onDay={(iso) => { setAnchor(iso); setView("day"); }} onEvent={setDetail} evColor={evColor} />}
      {(view === "week" || view === "day") && <TimeGrid anchor={anchor} days={view === "week" ? 7 : 1} events={events} onEvent={setDetail} evColor={evColor} />}
      {view === "agenda" && <Agenda events={events} onEvent={setDetail} evColor={evColor} />}

      {detail && (
        <ReservationDetailModal
          reservation={detail}
          canManage={canManage(detail)}
          onClose={() => setDetail(null)}
          onEdit={() => router.push(`/reserve?edit=${detail.id}`)}
          onCancel={() => setCancelTarget(detail)}
        />
      )}
      {cancelTarget && (
        <ConfirmDialog
          title="Cancel this reservation?"
          body={<>This releases <b>{cancelTarget.equipment.map((e) => e.equipment.name).join(" + ")}</b> in {cancelTarget.room.name}, making it available to other teachers.</>}
          confirmLabel="Cancel reservation" danger busy={busy}
          onConfirm={doCancel} onClose={() => setCancelTarget(null)}
        />
      )}
    </>
  );
}

function MonthGrid({ anchor, events, onDay, onEvent, evColor }: {
  anchor: string; events: ApiReservation[]; onDay: (iso: string) => void; onEvent: (r: ApiReservation) => void;
  evColor: (r: ApiReservation) => { fg: string; bg: string };
}) {
  const a = fromISO(anchor);
  const first = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1));
  const start = addD(first, -first.getUTCDay());
  const today = todayStr();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = addD(start, i), iso = toISO(d);
    const out = d.getUTCMonth() !== a.getUTCMonth();
    const day = events.filter((r) => toDateStr(new Date(r.startDateTime)) === iso).sort((x, y) => x.startDateTime.localeCompare(y.startDateTime));
    cells.push(
      <div key={iso} className={`mcell ${out ? "out" : ""} ${iso === today ? "today" : ""}`}>
        <button className="dnum" style={{ background: iso === today ? "var(--blue)" : "transparent" }} onClick={() => onDay(iso)}>{d.getUTCDate()}</button>
        {day.slice(0, 3).map((r) => {
          const { event } = splitPurpose(r.purpose);
          const c = evColor(r);
          return (
            <button key={r.id} className={`ev ${r.status === "CANCELLED" ? "cancelled" : ""}`}
              style={{ background: c.bg, borderLeftColor: c.fg, color: c.fg }} onClick={() => onEvent(r)}>
              {fmtTime(toTimeStr(new Date(r.startDateTime))).replace(":00", "")} {r.equipment[0]?.equipment.name || event}
            </button>
          );
        })}
        {day.length > 3 && <button className="more-link" onClick={() => onDay(iso)}>+{day.length - 3} more</button>}
      </div>
    );
  }
  return (
    <div className="month">
      <div className="month-dows">{DOW.map((d) => <div key={d}>{d}</div>)}</div>
      <div className="month-grid">{cells}</div>
    </div>
  );
}

function TimeGrid({ anchor, days, events, onEvent, evColor }: {
  anchor: string; days: number; events: ApiReservation[]; onEvent: (r: ApiReservation) => void;
  evColor: (r: ApiReservation) => { fg: string; bg: string };
}) {
  const today = todayStr();
  const startIso = days === 7 ? weekStart(anchor) : anchor;
  const cols = Array.from({ length: days }, (_, i) => addDaysStr(startIso, i));
  const tmpl = `68px repeat(${days}, minmax(0,1fr))`;
  const mins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

  return (
    <div className="tgrid">
      <div className="tgrid-head" style={{ gridTemplateColumns: tmpl }}>
        <div className="th" />
        {cols.map((iso) => {
          const d = fromISO(iso);
          return <div key={iso} className={`th ${iso === today ? "is-today" : ""}`}>{DOW[d.getUTCDay()]}<small>{fmtDate(iso).split(",")[0] || fmtDate(iso)}</small></div>;
        })}
      </div>
      <div className="tgrid-body" style={{ gridTemplateColumns: tmpl, position: "relative" }}>
        <div className="tcol gutter">
          {Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => DAY_START + i).map((h) => (
            <div key={h} className="thour"><span>{fmtTime(String(h).padStart(2, "0") + ":00")}</span></div>
          ))}
        </div>
        {cols.map((iso) => {
          const day = events.filter((r) => toDateStr(new Date(r.startDateTime)) === iso).sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
          const lanes: number[] = [];
          const placed = day.map((r) => {
            const s = mins(toTimeStr(new Date(r.startDateTime)));
            let lane = lanes.findIndex((end) => s >= end);
            if (lane === -1) { lane = lanes.length; lanes.push(0); }
            lanes[lane] = mins(toTimeStr(new Date(r.endDateTime)));
            return { r, lane };
          });
          const laneCount = Math.max(1, lanes.length);
          return (
            <div key={iso} className="tcol" style={{ position: "relative" }}>
              {Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => <div key={i} className="thour" />)}
              {placed.map(({ r, lane }) => {
                const s = mins(toTimeStr(new Date(r.startDateTime))), e = mins(toTimeStr(new Date(r.endDateTime)));
                const top = ((s - DAY_START * 60) / 60) * HOUR_PX;
                const h = Math.max(20, ((e - s) / 60) * HOUR_PX - 2);
                const w = 100 / laneCount;
                const c = evColor(r);
                return (
                  <button key={r.id} className={`tev ${r.status === "CANCELLED" ? "cancelled" : ""}`}
                    style={{ top, height: h, left: `calc(${lane * w}% + 2px)`, width: `calc(${w}% - 4px)`, background: c.bg, borderLeftColor: c.fg, color: c.fg }}
                    onClick={() => onEvent(r)}>
                    <b>{r.equipment.map((x) => x.equipment.name).join(" + ") || "—"}</b>
                    {fmtTime(toTimeStr(new Date(r.startDateTime)))}–{fmtTime(toTimeStr(new Date(r.endDateTime)))}<br />{r.room.name}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Agenda({ events, onEvent, evColor }: {
  events: ApiReservation[]; onEvent: (r: ApiReservation) => void; evColor: (r: ApiReservation) => { fg: string; bg: string };
}) {
  const today = todayStr();
  const days = Array.from({ length: 21 }, (_, i) => addDaysStr(today, i));
  const blocks = days.map((iso) => ({ iso, day: events.filter((r) => toDateStr(new Date(r.startDateTime)) === iso) })).filter((b) => b.day.length);

  if (!blocks.length) return <div className="card"><div className="empty"><strong>Nothing booked in the next three weeks</strong>Filters may be hiding results, or the calendar really is clear.</div></div>;

  return (
    <>
      {blocks.map(({ iso, day }) => (
        <div key={iso} className="agenda-day">
          <div className={`agenda-date ${iso === today ? "is-today" : ""}`}>{iso === today ? "Today" : fmtDateLong(iso)}</div>
          <div className="card">
            {day.sort((a, b) => a.startDateTime.localeCompare(b.startDateTime)).map((r) => {
              const { event } = splitPurpose(r.purpose);
              const c = evColor(r);
              return (
                <div className="res-item" key={r.id}>
                  <span className="res-bar" style={{ background: c.fg }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="res-title">{r.equipment.map((e) => e.equipment.name).join(" + ") || "No equipment"}</div>
                    <div className="res-meta">{r.room.name} · {fmtTime(toTimeStr(new Date(r.startDateTime)))}–{fmtTime(toTimeStr(new Date(r.endDateTime)))} · {r.user.name}<br /><span style={{ color: "var(--ink3)" }}>{event}</span></div>
                  </div>
                  <button className="btn btn-sm btn-ghost" onClick={() => onEvent(r)}>View</button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
