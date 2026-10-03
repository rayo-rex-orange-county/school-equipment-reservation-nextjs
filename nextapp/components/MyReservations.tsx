"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ToastProvider";
import { ReservationDetailModal } from "@/components/ReservationDetailModal";
import { ConfirmDialog } from "@/components/ui/Modal";
import { EquipmentChip } from "@/components/ui/Badges";
import { fmtDate, fmtRange, todayStr, toDateStr, toTimeStr } from "@/lib/datetime";
import { splitPurpose, type ApiReservation } from "@/lib/types";

export function MyReservations({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<ApiReservation[]>([]);
  const [tab, setTab] = useState<"upcoming" | "past" | "cancelled">("upcoming");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<ApiReservation | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ApiReservation | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await api.get("/api/reservations?mine=1");
    setReservations(res.reservations); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const today = todayStr();
  const list = useMemo(() => {
    let l = reservations;
    if (tab === "upcoming") l = l.filter((r) => r.status === "CONFIRMED" && toDateStr(new Date(r.startDateTime)) >= today);
    else if (tab === "past") l = l.filter((r) => r.status === "CONFIRMED" && toDateStr(new Date(r.startDateTime)) < today);
    else l = l.filter((r) => r.status === "CANCELLED");
    if (q) {
      const needle = q.toLowerCase();
      l = l.filter((r) => {
        const { event } = splitPurpose(r.purpose);
        return (event + " " + r.room.name + " " + r.equipment.map((e) => e.equipment.name).join(" ")).toLowerCase().includes(needle);
      });
    }
    return [...l].sort((a, b) => (tab === "past" ? -1 : 1) * a.startDateTime.localeCompare(b.startDateTime));
  }, [reservations, tab, q, today]);

  async function doCancel() {
    if (!cancelTarget) return;
    setBusy(true);
    try {
      await api.delete(`/api/reservations/${cancelTarget.id}`);
      toast("Reservation cancelled", `${cancelTarget.equipment.map((e) => e.equipment.name).join(" + ")} is free again.`, "warn");
      setCancelTarget(null); setDetail(null);
      await load();
    } catch (err) {
      toast("Could not cancel", err instanceof ApiError ? err.message : "Try again.", "bad");
    } finally { setBusy(false); }
  }

  if (loading) return <div className="card card-pad"><p className="muted" style={{ margin: 0 }}>Loading your reservations…</p></div>;

  return (
    <>
      <div className="page-head">
        <div><h1>My reservations</h1><p>Everything you have booked, past and upcoming.</p></div>
        <button className="btn btn-primary" onClick={() => router.push("/reserve")}>+ Make a reservation</button>
      </div>
      <div className="tabs">
        {([["upcoming", "Upcoming"], ["past", "Past"], ["cancelled", "Cancelled"]] as const).map(([k, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <div className="filters" style={{ gridTemplateColumns: "1fr" }}>
        <div className="field"><label>Search your reservations</label><input className="inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Activity, room or equipment" /></div>
      </div>

      {list.length ? (
        <div className="card scroll-x">
          <table className="tbl">
            <thead><tr><th>Date</th><th>Time</th><th>Equipment</th><th>Room</th><th>Activity</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {list.map((r) => {
                const { event, purpose } = splitPurpose(r.purpose);
                const start = new Date(r.startDateTime), end = new Date(r.endDateTime);
                const dStr = toDateStr(start);
                const canEdit = r.status === "CONFIRMED" && (dStr > today || (dStr === today && end.getTime() > Date.now()));
                return (
                  <tr key={r.id}>
                    <td><b>{fmtDate(dStr).replace(/, \d{4}$/, "")}</b><br /><span className="tiny muted">{dStr.slice(0, 4)}</span></td>
                    <td>{fmtRange(toTimeStr(start), toTimeStr(end))}</td>
                    <td style={{ minWidth: 190 }}>{r.equipment.map((e) => <EquipmentChip key={e.equipmentId} name={e.equipment.name} type={e.equipment.type} />)}</td>
                    <td>{r.room.name}</td>
                    <td>{event}{purpose && <><br /><span className="tiny muted">{purpose}</span></>}</td>
                    <td>{r.status === "CONFIRMED"
                      ? (dStr < today ? <span className="badge badge-off">Completed</span> : <span className="badge badge-ok">Confirmed</span>)
                      : <span className="badge badge-busy">Cancelled</span>}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "nowrap" }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => setDetail(r)}>View</button>
                        {canEdit && <>
                          <button className="btn btn-sm btn-ghost" onClick={() => router.push(`/reserve?edit=${r.id}`)}>Edit</button>
                          <button className="btn btn-sm btn-danger" onClick={() => setCancelTarget(r)}>Cancel</button>
                        </>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card"><div className="empty">
          <strong>Nothing here</strong>{tab === "upcoming" ? "Book equipment and it will show up on this page." : "No reservations in this list."}
          {tab === "upcoming" && <div style={{ marginTop: 14 }}><button className="btn btn-primary" onClick={() => router.push("/reserve")}>Make a reservation</button></div>}
        </div></div>
      )}

      {detail && (
        <ReservationDetailModal
          reservation={detail} canManage={detail.userId === currentUserId}
          onClose={() => setDetail(null)}
          onEdit={() => router.push(`/reserve?edit=${detail.id}`)}
          onCancel={() => setCancelTarget(detail)}
        />
      )}
      {cancelTarget && (
        <ConfirmDialog
          title="Cancel this reservation?"
          body={<>This releases <b>{cancelTarget.equipment.map((e) => e.equipment.name).join(" + ")}</b> in {cancelTarget.room.name}.</>}
          confirmLabel="Cancel reservation" danger busy={busy}
          onConfirm={doCancel} onClose={() => setCancelTarget(null)}
        />
      )}
    </>
  );
}
