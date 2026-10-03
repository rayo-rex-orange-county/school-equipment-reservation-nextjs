"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ToastProvider";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import type { ApiUser, Role, UserStatus } from "@/lib/types";

type FormState = { name: string; email: string; role: Role; status: UserStatus; password: string };
const BLANK: FormState = { name: "", email: "", role: "TEACHER", status: "ACTIVE", password: "" };

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function AdminUsers() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [meId, setMeId] = useState<string>("");
  const [filters, setFilters] = useState({ q: "", role: "" });
  const [editing, setEditing] = useState<ApiUser | null | "new">(null);
  const [form, setForm] = useState<FormState>(BLANK);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiUser | null>(null);

  async function load() {
    const [r, me] = await Promise.all([api.get("/api/users"), api.get("/api/auth/me")]);
    setUsers(r.users); setMeId(me.user?.id || ""); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const list = useMemo(() => {
    let l = users;
    if (filters.role) l = l.filter((u) => u.role === filters.role);
    if (filters.q) { const q = filters.q.toLowerCase(); l = l.filter((u) => (u.name + " " + u.email).toLowerCase().includes(q)); }
    return l;
  }, [users, filters]);

  function openNew() { setForm(BLANK); setFormError(""); setEditing("new"); }
  function openEdit(u: ApiUser) { setForm({ name: u.name, email: u.email, role: u.role, status: u.status, password: "" }); setFormError(""); setEditing(u); }

  async function save() {
    setBusy(true); setFormError("");
    try {
      if (editing === "new") {
        if (form.password.length < 8) throw new ApiError("Set a temporary password of at least 8 characters.", 400);
        await api.post("/api/users", form);
        toast("Account created", `${form.name} · ${form.role === "ADMIN" ? "Administrator" : "Teacher"}`, "ok");
      } else if (editing) {
        await api.patch(`/api/users/${editing.id}`, form);
        toast("Account updated", form.name, "ok");
      }
      setEditing(null); await load();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : "Could not save."); }
    finally { setBusy(false); }
  }

  async function toggleStatus(u: ApiUser) {
    try {
      await api.patch(`/api/users/${u.id}`, { name: u.name, email: u.email, role: u.role, status: u.status === "DISABLED" ? "ACTIVE" : "DISABLED", password: "" });
      toast(u.status === "DISABLED" ? "Account enabled" : "Account disabled", u.status === "DISABLED" ? `${u.name} can sign in again.` : `${u.name} can no longer sign in.`, "warn");
      await load();
    } catch (err) { toast("Could not update account", err instanceof ApiError ? err.message : "", "bad"); }
  }

  async function doDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try { await api.delete(`/api/users/${deleteTarget.id}`); toast("Account deleted", `${deleteTarget.name} has been removed.`, "warn"); setDeleteTarget(null); await load(); }
    catch (err) { toast("Could not delete", err instanceof ApiError ? err.message : "", "bad"); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="card card-pad"><p className="muted" style={{ margin: 0 }}>Loading accounts…</p></div>;

  return (
    <>
      <div className="page-head">
        <div><h1>Accounts</h1><p>{users.length} accounts · {users.filter((u) => u.role === "TEACHER").length} teachers</p></div>
        <button className="btn btn-primary" onClick={openNew}>+ Add account</button>
      </div>
      <div className="filters" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <div className="field"><label>Search</label><input className="inp" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="Name or email" /></div>
        <div className="field"><label>Role</label>
          <select className="inp" value={filters.role} onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}>
            <option value="">All roles</option><option value="TEACHER">Teachers</option><option value="ADMIN">Administrators</option>
          </select></div>
      </div>

      {list.length ? (
        <div className="card scroll-x">
          <table className="tbl">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {list.map((u) => {
                const self = u.id === meId;
                return (
                  <tr key={u.id}>
                    <td><span style={{ display: "flex", gap: 9, alignItems: "center" }}>
                      <span className="avatar" style={{ width: 30, height: 30, fontSize: 11.5 }}>{initials(u.name)}</span>
                      <b>{u.name}{self && <span className="tiny muted"> (you)</span>}</b>
                    </span></td>
                    <td>{u.email}</td>
                    <td><span className={`badge badge-plain ${u.role === "ADMIN" ? "badge-blue" : "badge-off"}`}>{u.role === "ADMIN" ? "Administrator" : "Teacher"}</span></td>
                    <td>{u.status === "DISABLED" ? <span className="badge badge-busy">Disabled</span> : <span className="badge badge-ok">Active</span>}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "nowrap" }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => openEdit(u)}>Edit</button>
                        {!self && (
                          <>
                            <button className="btn btn-sm btn-ghost" onClick={() => toggleStatus(u)}>{u.status === "DISABLED" ? "Enable" : "Disable"}</button>
                            <button className="btn btn-sm btn-danger" onClick={() => setDeleteTarget(u)}>Delete</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <div className="card"><div className="empty"><strong>No accounts match</strong>Clear the filters to see everyone.</div></div>}

      {editing && (
        <Modal
          title={editing === "new" ? "Add an account" : `Edit ${(editing as ApiUser).name}`}
          onClose={() => setEditing(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : editing === "new" ? "Create account" : "Save changes"}</button>
          </>}
        >
          <div className="field"><label htmlFor="u-name">Full name</label>
            <input className="inp" id="u-name" autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
          <div className="field"><label htmlFor="u-email">School email</label>
            <input className="inp" id="u-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
          <div className="row2">
            <div className="field"><label htmlFor="u-role">Role</label>
              <select className="inp" id="u-role" value={form.role} disabled={editing !== "new" && (editing as ApiUser).id === meId}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}>
                <option value="TEACHER">Teacher</option><option value="ADMIN">Administrator</option>
              </select></div>
            <div className="field"><label htmlFor="u-status">Account status</label>
              <select className="inp" id="u-status" value={form.status} disabled={editing !== "new" && (editing as ApiUser).id === meId}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as UserStatus }))}>
                <option value="ACTIVE">Active</option><option value="DISABLED">Disabled</option>
              </select></div>
          </div>
          <div className="field"><label htmlFor="u-pw">{editing === "new" ? "Temporary password" : "Reset password"}</label>
            <input className="inp" id="u-pw" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            <div className="hint">{editing === "new" ? "At least 8 characters. Ask the teacher to change it after signing in." : "Leave blank to keep the current password."}</div></div>
          {formError && <div className="err">{formError}</div>}
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog title={`Delete ${deleteTarget.name}'s account?`}
          body="Their reservation history stays on the calendar but shows no owner. Disabling the account instead keeps everything intact and reversible."
          confirmLabel="Delete account" danger busy={busy} onConfirm={doDelete} onClose={() => setDeleteTarget(null)} />
      )}
    </>
  );
}
