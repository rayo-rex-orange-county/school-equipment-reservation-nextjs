"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

export default function ResetPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Use a password of at least 8 characters.");
    setBusy(true);
    try {
      await api.post("/api/auth/reset", { email, password });
      router.push("/login");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 34 }}>
            <span className="brand-mark" style={{ background: "rgba(255,255,255,.18)" }}>🎓</span>
            <b style={{ fontSize: 14.5 }}>Central Visayan Institute Foundation</b>
          </div>
          <h1>Every projector, booked once.</h1>
        </div>
      </div>
      <div className="auth-panel">
        <div className="auth-form">
          <h2 style={{ margin: "0 0 4px", fontSize: 23 }}>Reset your password</h2>
          <p className="auth-sub">Confirm your email and set a new password.</p>
          <form onSubmit={onSubmit} noValidate>
            <div className="field">
              <label htmlFor="email">School email</label>
              <input className="inp" id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="password">New password</label>
              <input className="inp" id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              <div className="hint">At least 8 characters.</div>
            </div>
            {error && <div className="err">{error}</div>}
            <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>
              {busy ? "Working…" : "Set new password"}
            </button>
          </form>
          <p className="hint" style={{ marginTop: 14 }}>
            This demo resets the password straight away. A production deployment would email a signed, expiring
            link instead — see the comment in app/api/auth/reset/route.ts.
          </p>
          <div className="auth-switch"><Link href="/login">Back to sign in</Link></div>
        </div>
      </div>
    </div>
  );
}
