"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await api.post("/api/auth/login", { email, password });
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function fill(em: string, pw: string) {
    setEmail(em); setPassword(pw);
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
          <p>See what is free, reserve it for a room and a time slot, and let the system refuse anything that would double-book a colleague.</p>
          <div className="auth-marks">
            <span>Live availability</span><span>Conflict checking</span><span>Shared calendar</span><span>Admin controls</span>
          </div>
        </div>
        <p style={{ fontSize: 13, opacity: 0.75, marginTop: 30 }}>Equipment desk · Room 12, Main Building · Open 7:00 AM – 5:00 PM</p>
      </div>

      <div className="auth-panel">
        <div className="auth-form">
          <h2 style={{ margin: "0 0 4px", fontSize: 23 }}>Sign in</h2>
          <p className="auth-sub">Reserve projectors, microphones, speakers and more.</p>
          <form onSubmit={onSubmit} noValidate>
            <div className="field">
              <label htmlFor="email">School email</label>
              <input className="inp" id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="santos@school.edu" />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input className="inp" id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <div className="err">{error}</div>}
            <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <div className="auth-switch"><Link href="/reset">Forgot your password?</Link></div>

          <div className="demo-box">
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Demo accounts — tap to fill</div>
            <div className="demo-row">
              <span><b>Administrator</b><br /><code>admin@school.edu</code></span>
              <button className="btn btn-sm" type="button" onClick={() => fill("admin@school.edu", "admin123")}>Use</button>
            </div>
            <div className="demo-row">
              <span><b>Teacher</b><br /><code>santos@school.edu</code></span>
              <button className="btn btn-sm" type="button" onClick={() => fill("santos@school.edu", "teacher123")}>Use</button>
            </div>
          </div>

          <div className="auth-switch">New here? <Link href="/register">Create a teacher account</Link></div>
        </div>
      </div>
    </div>
  );
}
