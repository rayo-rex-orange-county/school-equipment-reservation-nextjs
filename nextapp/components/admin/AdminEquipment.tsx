"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ToastProvider";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/Badges";
import { EQUIPMENT_TYPES } from "@/lib/constants";
import type { ApiEquipment, EquipmentStatus, EquipmentType } from "@/lib/types";

const STATUSES: { value: EquipmentStatus; label: string }[] = [
  { value: "AVAILABLE", label: "Available" }, { value: "MAINTENANCE", label: "Maintenance" },
  { value: "UNAVAILABLE", label: "Unavailable" }, { value: "RETIRED", label: "Retired" },
];

type FormState = { name: string; type: EquipmentType; status: EquipmentStatus; location: string; condition: string; description: string };
const BLANK: FormState = { name: "", type: "PROJECTOR", status: "AVAILABLE", location: "", condition: "", description: "" };

export function AdminEquipment() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ApiEquipment[]>([]);
  const [filters, setFilters] = useState({ q: "", type: "", status: "" });
  const [editing, setEditing] = useState<ApiEquipment | null | "new">(null);
  const [form, setForm] = useState<FormState>(BLANK);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiEquipment | null>(null);

  async function load() { const r = await api.get("/api/equipment"); setItems(r.equipment); setLoading(false); }
  useEffect(() => { load(); }, []);

  const list = useMemo(() => {
    let l = items;
    if (filters.type) l = l.filter((e) => e.type === filters.type);
    if (filters.status) l = l.filter((e) => e.status === filters.status);
    if (filters.q) { const q = filters.q.toLowerCase(); l = l.filter((e) => (e.name + " " + e.type + " " + (e.location || "")).toLowerCase().includes(q)); }
    return l;
  }, [items, filters]);

  function openNew() { setForm(BLANK); setFormError(""); setEditing("new"); }
  function openEdit(e: ApiEquipment) { setForm({ name: e.name, type: e.type, status: e.status, location: e.location || "", condition: e.condition || "", description: e.description || "" }); setFormError(""); setEditing(e); }

  async function save() {
    setBusy(true); setFormError("");
    try {
      if (editing === "new") { await api.post("/api/equipment", form); toast("Equipment added", `${form.name} · ${form.status}`, "ok"); }
      else if (editing) { await api.patch(`/api/equipment/${editing.id}`, form); toast("Equipment updated", `${form.name} · ${form.status}`, "ok"); }
      setEditing(null); await load();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : "Could not save."); }
    finally { setBusy(false); }
  }
  async function doDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try { await api.delete(`/api/equipment/${deleteTarget.id}`); toast("Equipment deleted", `${deleteTarget.name} has been removed.`, "warn"); setDeleteTarget(null); await load(); }
    catch (err) { toast("Could not delete", err instanceof ApiError ? err.message : "", "bad"); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="card card-pad"><p className="muted" style={{ margin: 0 }}>Loading equipment…</p></div>;

  return (
    <>
      <div className="page-head">
        <div><h1>Equipment</h1><p>{items.length} items on the register</p></div>
        <button className="btn btn-primary" onClick={openNew}>+ Add equipment</button>
      </div>
      <div className="filters" style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
        <div className="field"><label>Search</label><input className="inp" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="Name or location" /></div>
        <div className="field"><label>Type</label><select className="inp" value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
          <option value="">All types</option>{EQUIPMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
        <div className="field"><label>Status</label><select className="inp" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">All statuses</option>{STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
      </div>

      {list.length ? (
        <div className="card scroll-x">
          <table className="tbl">
            <thead><tr><th>Item</th><th>Type</th><th>Status</th><th>Kept in</th><th>Condition</th><th>Actions</th></tr></thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id}>
                  <td><b>{e.name}</b></td>
                  <td>{EQUIPMENT_TYPES.find((t) => t.value === e.type)?.label}</td>
                  <td><StatusBadge status={e.status} /></td>
                  <td>{e.location || "—"}</td>
                  <td>{e.condition || "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "nowrap" }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => openEdit(e)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => setDeleteTarget(e)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="card"><div className="empty"><strong>No equipment matches</strong>Add an item or clear the filters.</div></div>}

      {editing && (
        <Modal
          title={editing === "new" ? "Add equipment" : `Edit ${(editing as ApiEquipment).name}`}
          onClose={() => setEditing(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : editing === "new" ? "Add equipment" : "Save changes"}</button>
          </>}
        >
          <div className="field"><label htmlFor="eq-name">Item name or ID</label>
            <input className="inp" id="eq-name" autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Projector 04" />
            <div className="hint">Give every item a unique label, such as "Projector 04".</div></div>
          <div className="row2">
            <div className="field"><label htmlFor="eq-type">Type</label>
              <select className="inp" id="eq-type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as EquipmentType }))}>
                {EQUIPMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
            <div className="field"><label htmlFor="eq-status">Status</label>
              <select className="inp" id="eq-status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as EquipmentStatus }))}>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
          </div>
          <div className="row2">
            <div className="field"><label htmlFor="eq-loc">Kept in</label><input className="inp" id="eq-loc" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Equipment Room" /></div>
            <div className="field"><label htmlFor="eq-cond">Condition</label><input className="inp" id="eq-cond" value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))} placeholder="Good" /></div>
          </div>
          <div className="field"><label htmlFor="eq-desc">Description</label>
            <textarea className="inp" id="eq-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Model, accessories, anything a teacher should know." /></div>
          {formError && <div className="err">{formError}</div>}
        </Modal>
      )}
      {deleteTarget && (
        <ConfirmDialog title={`Delete ${deleteTarget.name}?`} body="If it appears in upcoming reservations, marking it Retired instead preserves those records."
          confirmLabel="Delete item" danger busy={busy} onConfirm={doDelete} onClose={() => setDeleteTarget(null)} />
      )}
    </>
  );
}
