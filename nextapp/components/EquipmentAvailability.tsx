"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { EQUIPMENT_TYPES, EQUIPMENT_COLORS, EQUIPMENT_STATUS_LABEL } from "@/lib/constants";
import { combineDateTime, fmtDate, fmtDateLong, fmtRange, overlaps, todayStr, toDateStr, toTimeStr } from "@/lib/datetime";
import { splitPurpose, type ApiEquipment, type ApiReservation, type ApiRoom } from "@/lib/types";

export function EquipmentAvailability() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState<ApiEquipment[]>([]);
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [reservations, setReservations] = useState<ApiReservation[]>([]);
  const [f, setF] = useState({ q: "", type: "", item: "", date: todayStr(), start: "07:00", end: "18:00", room: "", status: "" });

  useEffect(() => {
    (async () => {
      const [eq, rm, res] = await Promise.all([api.get("/api/equipment"), api.get("/api/rooms"), api.get("/api/reservations?status=CONFIRMED")]);
      setEquipment(eq.equipment); setRooms(rm.rooms); setReservations(res.reservations); setLoading(false);
    })();
  }, []);

  const windowOk = f.end > f.start;

  function bookingFor(equipId: string) {
    if (!windowOk) return null;
    const s = combineDateTime(f.date, f.start), e = combineDateTime(f.date, f.end);
    return reservations.find((r) => r.equipment.some((x) => x.equipmentId === equipId) && overlaps(s, e, new Date(r.startDateTime), new Date(r.endDateTime))) || null;
  }

  const cards = useMemo(() => {
    let list = equipment.filter((e) => e.status !== "RETIRED");
    if (f.type) list = list.filter((e) => e.type === f.type);
    if (f.item) list = list.filter((e) => e.id === f.item);
    if (f.q) { const q = f.q.toLowerCase(); list = list.filter((e) => (e.name + " " + e.type + " " + (e.location || "") + " " + (e.description || "")).toLowerCase().includes(q)); }
    return list;
  }, [equipment, f]);

  if (loading) return <div className="card card-pad"><p className="muted" style={{ margin: 0 }}>Loading equipment…</p></div>;

  return (
    <>
      <div className="page-head">
        <div><h1>Equipment availability</h1><p>Pick a date and a time window to see exactly what is free.</p></div>
        <button className="btn btn-primary" onClick={() => router.push("/reserve")}>+ Make a reservation</button>
      </div>

      {!windowOk && <div className="banner">The end time must be later than the start time — showing everything for now.</div>}

      <div className="filters">
        <div className="field"><label>Search</label><input className="inp" value={f.q} onChange={(e) => setF((s) => ({ ...s, q: e.target.value }))} placeholder="Name or keyword" /></div>
        <div className="field"><label>Type</label><select className="inp" value={f.type} onChange={(e) => setF((s) => ({ ...s, type: e.target.value }))}>
          <option value="">All types</option>{EQUIPMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
        <div className="field"><label>Specific item</label><select className="inp" value={f.item} onChange={(e) => setF((s) => ({ ...s, item: e.target.value }))}>
          <option value="">Any item</option>{equipment.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
        <div className="field"><label>Date</label><input className="inp" type="date" value={f.date} onChange={(e) => setF((s) => ({ ...s, date: e.target.value }))} /></div>
        <div className="field"><label>From</label><input className="inp" type="time" step={900} value={f.start} onChange={(e) => setF((s) => ({ ...s, start: e.target.value }))} /></div>
        <div className="field"><label>To</label><input className="inp" type="time" step={900} value={f.end} onChange={(e) => setF((s) => ({ ...s, end: e.target.value }))} /></div>
        <div className="field"><label>Room in use</label><select className="inp" value={f.room} onChange={(e) => setF((s) => ({ ...s, room: e.target.value }))}>
          <option value="">Any room</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
        <div className="field"><label>Status</label><select className="inp" value={f.status} onChange={(e) => setF((s) => ({ ...s, status: e.target.value }))}>
          <option value="">All statuses</option><option value="available">Available</option><option value="reserved">Reserved</option>
          <option value="maintenance">Maintenance</option><option value="unavailable">Unavailable</option></select></div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <span className="tiny muted">Showing availability for {fmtDateLong(f.date)}, {fmtRange(f.start, f.end)}</span>
        <button className="btn btn-sm btn-ghost" onClick={() => setF({ q: "", type: "", item: "", date: todayStr(), start: "07:00", end: "18:00", room: "", status: "" })}>Reset filters</button>
      </div>

      <div className="eq-grid">
        {cards.map((e) => {
          const booking = bookingFor(e.id);
          if (f.room && (!booking || booking.roomId !== f.room)) return null;
          const shownStatus = e.status !== "AVAILABLE" ? e.status.toLowerCase() : booking ? "reserved" : "available";
          if (f.status && shownStatus !== f.status) return null;

          let badge: React.ReactNode, panel: React.ReactNode;
          if (e.status !== "AVAILABLE") {
            badge = <span className={`badge ${e.status === "MAINTENANCE" ? "badge-warn" : "badge-off"}`}>{EQUIPMENT_STATUS_LABEL[e.status]}</span>;
            panel = <div className="eq-busy" style={e.status !== "MAINTENANCE" ? { background: "var(--off-bg)", borderColor: "var(--off-line)", color: "var(--off)" } : undefined}>
              {e.status === "MAINTENANCE" ? <><b>Out for maintenance.</b> {e.condition}</> : (e.description || "Not available for reservation.")}
            </div>;
          } else if (booking) {
            const { event } = splitPurpose(booking.purpose);
            badge = <span className="badge badge-busy">Reserved</span>;
            panel = <div className="eq-busy"><b>{fmtDate(toDateStr(new Date(booking.startDateTime)))} · {fmtRange(toTimeStr(new Date(booking.startDateTime)), toTimeStr(new Date(booking.endDateTime)))}</b>
              {booking.room.name} · reserved by {booking.user.name}<br />{event}</div>;
          } else {
            badge = <span className="badge badge-ok">Available</span>;
            panel = <div className="eq-free">Free {windowOk ? `on ${fmtDate(f.date)}, ${fmtRange(f.start, f.end)}` : `all day ${fmtDate(f.date)}`}</div>;
          }

          return (
            <div className="eq-card" key={e.id} style={{ borderTopColor: EQUIPMENT_COLORS[e.type].fg }}>
              <div className="eq-top">
                <div><div className="eq-name">{e.name}</div><div className="eq-type">{EQUIPMENT_TYPES.find((t) => t.value === e.type)?.label}</div></div>
                {badge}
              </div>
              <div className="eq-body"><b>Kept in</b> {e.location || "—"}{e.condition ? <> · <b>Condition</b> {e.condition}</> : ""}{e.description ? <><br />{e.description}</> : ""}</div>
              {panel}
              {e.status === "AVAILABLE" && !booking && (
                <div style={{ marginTop: 11 }}>
                  <button className="btn btn-sm btn-primary" onClick={() => router.push(`/reserve?equip=${e.id}&date=${f.date}&start=${f.start}&end=${f.end}`)}>Reserve this</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
