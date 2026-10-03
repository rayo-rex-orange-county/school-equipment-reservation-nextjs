"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ToastProvider";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import type { ApiRoom, RoomStatus } from "@/lib/types";

type FormState = { name: string; building: string; capacity: string; status: RoomStatus };
const BLANK: FormState = { name: "", building: "", capacity: "", status: "AVAILABLE" };

export function AdminRooms() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [editing, setEditing] = useState<ApiRoom | null | "new">(null);
  const [form, setForm] = useState<FormState>(BLANK);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiRoom | null>(null);
  const [deleteError, setDeleteError] = useState("");

  async function load() { const r = await api.get("/api/rooms"); setRooms(r.rooms); setLoading(false); }
  useEffect(() => { load(); }, []);

  function openNew() { setForm(BLANK); setFormError(""); setEditing("new"); }
  function openEdit(r: ApiRoom) {
    setForm({ name: r.name, building: r.building || "", capacity: r.capacity != null ? String(r.capacity) : "", status: r.status });
    setFormError(""); setEditing(r);
  }

  async function save() {
    setBusy(true); setFormError("");
    const payload = { name: form.name, building: form.building, capacity: form.capacity ? Number(form.capacity) : null, status: form.status };
    try {
      if (editing === "new") { await api.post("/api/rooms", payload); toast("Room added", form.name, "ok"); }
      else if (editing) { await api.patch(`/api/rooms/${editing.id}`, payload); toast("Room updated", form.name, "ok"); }
      setEditing(null); await load();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : "Could not save."); }
    finally { setBusy(false); }
  }

  async function doDelete() {
    if (!deleteTarget) return;
    setBusy(true); setDeleteError("");
    try { await api.delete(`/api/rooms/${deleteTarget.id}`); toast("Room deleted", `${deleteTarget.name} is no longer bookable.`, "warn"); setDeleteTarget(null); await load(); }
    catch (err) { setDeleteError(err instanceof ApiError ? err.message : "Could not delete this room."); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="card card-pad"><p className="muted" style={{ margin: 0 }}>Loading rooms…</p></div>;

  return (
    <>
      <div className="page-head">
        <div><h1>Rooms</h1><p>{rooms.length} rooms available for booking</p></div>
        <button className="btn btn-primary" onClick={openNew}>+ Add room</button>
      </div>

      {rooms.length ? (
        <div className="card scroll-x">
          <table className="tbl">
            <thead><tr><th>Room</th><th>Building</th><th>Capacity</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.name}</b></td>
                  <td>{r.building || "—"}</td>
                  <td>{r.capacity ?? "—"}</td>
                  <td>{r.status === "AVAILABLE" ? <span className="badge badge-ok">Available</span> : <span className="badge badge-off">Unavailable</span>}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => openEdit(r)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => { setDeleteTarget(r); setDeleteError(""); }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="card"><div className="empty"><strong>No rooms yet</strong>Add the first room so teachers can book one.</div></div>}

      {editing && (
        <Modal
          title={editing === "new" ? "Add room" : `Edit ${(editing as ApiRoom).name}`}
          onClose={() => setEditing(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : editing === "new" ? "Add room" : "Save changes"}</button>
          </>}
        >
          <div className="field"><label htmlFor="rm-name">Room name</label>
            <input className="inp" id="rm-name" autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Room 305" /></div>
          <div className="row2">
            <div className="field"><label htmlFor="rm-b">Building</label>
              <input className="inp" id="rm-b" value={form.building} onChange={(e) => setForm((f) => ({ ...f, building: e.target.value }))} placeholder="Main Building" /></div>
            <div className="field"><label htmlFor="rm-c">Capacity</label>
              <input className="inp" id="rm-c" type="number" min={0} value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} /></div>
          </div>
          <div className="field"><label htmlFor="rm-s">Status</label>
            <select className="inp" id="rm-s" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as RoomStatus }))}>
              <option value="AVAILABLE">Available</option>
              <option value="UNAVAILABLE">Unavailable</option>
            </select></div>
          {formError && <div className="err">{formError}</div>}
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog title={`Delete ${deleteTarget.name}?`}
          body={deleteError || "If no upcoming reservations use this room, it will be removed. Rooms with upcoming bookings cannot be deleted — mark the room unavailable instead."}
          confirmLabel="Delete room" danger busy={busy} onConfirm={doDelete} onClose={() => { setDeleteTarget(null); setDeleteError(""); }} />
      )}
    </>
  );
}
