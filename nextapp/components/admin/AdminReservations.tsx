"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ToastProvider";
import { ReservationDetailModal } from "@/components/ReservationDetailModal";
import { ConfirmDialog } from "@/components/ui/Modal";
import { EquipmentChip } from "@/components/ui/Badges";
import { fmtDate, fmtRange, todayStr, toDateStr, toTimeStr } from "@/lib/datetime";
import { splitPurpose, type ApiReservation, type ApiRoom, type ApiUser } from "@/lib/types";

type Tab = "upcoming" | "past" | "cancelled" | "all";

export function AdminReservations() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<ApiReservation[]>([]);
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [filters, setFilters] = useState({ q: "", user: "", room: "", date: "" });
  const [detail, setDetail] = useState<ApiReservation | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ApiReservation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiReservation | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [res, rm, us] = await Promise.all([api.get("/api/reservations"), api.get("/api/rooms"), api.get("/api/users")]);
    setReservations(res.reservations); setRooms(rm.rooms); setUsers(us.users); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const today = todayStr();
  const list = useMemo(() => {
    let l = reservations;
    if (tab === "upcoming") l = l.filter((r) => r.status === "CONFIRMED" && toDateStr(new Date(r.startDateTime)) >= today);
    else if (tab === "past") l = l.filter((r) => r.status === "CONFIRMED" && toDateStr(new Date(r.startDateTime)) < today);
    else if (tab === "cancelled") l = l.filter((r) => r.status === "CANCELLED");
    if (filters.user) l = l.filter((r) => r.userId === filters.user);
    if (filters.room) l = l.filter((r) => r.roomId === filters.room);
    if (filters.date) l = l.filter((r) => toDateStr(new Date(r.startDateTime)) === filters.date);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      l = l.filter((r) => {
        const { event, purpose } = splitPurpose(r.purpose);
        return (event + " " + purpose + " " + r.room.name + " " + r.user.name + " " + r.equipment.map((e) => e.equipment.name).join(" ")).toLowerCase().includes(q);
      });
    }
    return [...l].sort((a, b) => (tab === "past" ? -1 : 1) * a.startDateTime.localeCompare(b.startDateTime));
  }, [reservations, tab, filters, today]);

  async function doCancel() {
    if (!cancelTarget) return;
    setBusy(true);
    try { await api.delete(`/api/reservations/${cancelTarget.id}`); toast("Reservation cancelled", "", "warn"); setCancelTarget(null); setDetail(null); await load(); }
    catch (err) { toast("Could not cancel", err instanceof ApiError ? err.message : "", "bad"); }
    finally { setBusy(false); }
  }
  async function doDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try { await api.delete(`/api/reservations/${deleteTarget.id}?hard=1`); toast("Reservation deleted", "The record has been removed.", "warn"); setDeleteTarget(null); setDetail(null); await load(); }
    catch (err) { toast("Could not delete", err instanceof ApiError ? err.message : "", "bad"); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="card card-pad"><p className="muted" style={{ margin: 0 }}>Loading reservations…</p></div>;

  return (
    <>
      <div className="page-head">
        <div><h1>All reservations</h1><p>{list.length} shown · {reservations.filter((r) => r.status === "CONFIRMED").length} active in the system</p></div>
        <button className="btn btn-primary" onClick={() => router.push("/reserve")}>+ New reservation</button>
      </div>
      <div className="tabs">
        {([["upcoming", "Upcoming"], ["past", "Past"], ["cancelled", "Cancelled"], ["all", "All"]] as const).map(([k, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <div className="filters">
        <div className="field"><label>Search</label><input className="inp" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="Activity, teacher, item" /></div>
        <div className="field"><label>Teacher</label><select className="inp" value={filters.user} onChange={(e) => setFilters((f) => ({ ...f, user: e.target.value }))}>
          <option value="">Everyone</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
        <div className="field"><label>Room</label><select className="inp" value={filters.room} onChange={(e) => setFilters((f) => ({ ...f, room: e.target.value }))}>
          <option value="">All rooms</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
        <div className="field"><label>Date</label><input className="inp" type="date" value={filters.date} onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))} /></div>
      </div>

      {list.length ? (
        <div className="card scroll-x">
          <table className="tbl">
            <thead><tr><th>When</th><th>Equipment</th><th>Room</th><th>Teacher</th><th>Activity</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {list.map((r) => {
                const { event } = splitPurpose(r.purpose);
                const start = new Date(r.startDateTime), end = new Date(r.endDateTime);
                return (
                  <tr key={r.id}>
                    <td><b>{fmtDate(toDateStr(start)).replace(/, \d{4}$/, "")}</b><br /><span className="tiny muted">{fmtRange(toTimeStr(start), toTimeStr(end))}</span></td>
                    <td style={{ minWidth: 180 }}>{r.equipment.map((e) => <EquipmentChip key={e.equipmentId} name={e.equipment.name} type={e.equipment.type} />)}</td>
                    <td>{r.room.name}</td>
                    <td>{r.user.name}</td>
                    <td>{event}</td>
                    <td>{r.status === "CONFIRMED" ? <span className="badge badge-ok">Confirmed</span> : <span className="badge badge-busy">Cancelled</span>}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "nowrap" }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => setDetail(r)}>View</button>
                        {r.status === "CONFIRMED" && <>
                          <button className="btn btn-sm btn-ghost" onClick={() => router.push(`/reserve?edit=${r.id}`)}>Edit</button>
                          <button className="btn btn-sm btn-ghost" onClick={() => setCancelTarget(r)}>Cancel</button>
                        </>}
                        <button className="btn btn-sm btn-danger" onClick={() => setDeleteTarget(r)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <div className="card"><div className="empty"><strong>No reservations match</strong>Adjust the filters above.</div></div>}

      {detail && (
        <ReservationDetailModal reservation={detail} canManage
          onClose={() => setDetail(null)}
          onEdit={() => router.push(`/reserve?edit=${detail.id}`)}
          onCancel={() => setCancelTarget(detail)} />
      )}
      {cancelTarget && (
        <ConfirmDialog title="Cancel this reservation?" body={<>This frees <b>{cancelTarget.equipment.map((e) => e.equipment.name).join(" + ")}</b> and keeps the record in history.</>}
          confirmLabel="Cancel reservation" danger busy={busy} onConfirm={doCancel} onClose={() => setCancelTarget(null)} />
      )}
      {deleteTarget && (
        <ConfirmDialog title="Delete this reservation permanently?" body="This removes it from the records entirely. Cancelling instead keeps it in the history."
          confirmLabel="Delete permanently" danger busy={busy} onConfirm={doDelete} onClose={() => setDeleteTarget(null)} />
      )}
    </>
  );
}
