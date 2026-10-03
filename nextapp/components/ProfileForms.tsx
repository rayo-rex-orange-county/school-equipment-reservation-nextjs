"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ToastProvider";
import { fmtDate, toDateStr } from "@/lib/datetime";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function ProfileForms({
  user,
  stats,
}: {
  user: { id: string; name: string; email: string; role: "TEACHER" | "ADMIN"; createdAt: string };
  stats: { reservationCount: number; hours: number };
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [profileError, setProfileError] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);

  const [current, setCurrent] = useState("");
  const [nextPw, setNextPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(""); setProfileBusy(true);
    try {
      await api.patch("/api/profile", { name, email });
      toast("Profile saved", "Your details are up to date.", "ok");
      router.refresh();
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : "Could not save.");
    } finally { setProfileBusy(false); }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(""); setPwBusy(true);
    try {
      await api.post("/api/profile/password", { current, next: nextPw });
      toast("Password updated", "Use it the next time you sign in.", "ok");
      setCurrent(""); setNextPw("");
    } catch (err) {
      setPwError(err instanceof ApiError ? err.message : "Could not update password.");
    } finally { setPwBusy(false); }
  }

  return (
    <>
      <div className="page-head"><div><h1>Profile</h1><p>Your account details and sign-in security.</p></div></div>
      <div className="grid-2">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card"><div className="card-head"><h3>Account details</h3></div>
            <div className="card-pad">
              <form onSubmit={saveProfile}>
                <div className="field"><label htmlFor="p-name">Full name</label><input className="inp" id="p-name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
                <div className="field"><label htmlFor="p-email">School email</label><input className="inp" id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                {profileError && <div className="err">{profileError}</div>}
                <button className="btn btn-primary" type="submit" disabled={profileBusy}>{profileBusy ? "Saving…" : "Save changes"}</button>
              </form>
            </div></div>
          <div className="card"><div className="card-head"><h3>Change password</h3></div>
            <div className="card-pad">
              <form onSubmit={changePassword}>
                <div className="field"><label htmlFor="p-cur">Current password</label><input className="inp" id="p-cur" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></div>
                <div className="field"><label htmlFor="p-new">New password</label><input className="inp" id="p-new" type="password" value={nextPw} onChange={(e) => setNextPw(e.target.value)} required /><div className="hint">At least 8 characters.</div></div>
                {pwError && <div className="err">{pwError}</div>}
                <button className="btn btn-primary" type="submit" disabled={pwBusy}>{pwBusy ? "Updating…" : "Update password"}</button>
              </form>
            </div></div>
        </div>
        <div className="card card-pad">
          <div style={{ display: "flex", gap: 13, marginBottom: 14, alignItems: "center" }}>
            <span className="avatar" style={{ width: 46, height: 46, fontSize: 16 }}>{initials(user.name)}</span>
            <div><div style={{ fontWeight: 700, fontSize: 16 }}>{user.name}</div><div className="tiny muted">{user.email}</div></div>
          </div>
          <div className="srow" style={{ border: "none", padding: "6px 0" }}><dt>Role</dt><dd><span className="badge badge-blue">{user.role === "ADMIN" ? "Administrator" : "Teacher"}</span></dd></div>
          <div className="srow" style={{ border: "none", padding: "6px 0" }}><dt>Member since</dt><dd>{fmtDate(toDateStr(new Date(user.createdAt)))}</dd></div>
          <div className="srow" style={{ border: "none", padding: "6px 0" }}><dt>Reservations</dt><dd>{stats.reservationCount}</dd></div>
          <div className="srow" style={{ border: "none", padding: "6px 0" }}><dt>Hours booked</dt><dd>{stats.hours.toFixed(1)}</dd></div>
        </div>
      </div>
    </>
  );
}
