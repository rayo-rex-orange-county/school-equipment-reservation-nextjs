"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Use a password of at least 8 characters.");
    if (password !== password2) return setError("The two passwords do not match.");
    setBusy(true);
    try {
      await api.post("/api/auth/register", { name, email, password });
      router.push("/dashboard");
      router.refresh();
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
          <p>Create your teacher account to start reserving equipment in under a minute.</p>
        </div>
      </div>
      <div className="auth-panel">
        <div className="auth-form">
          <h2 style={{ margin: "0 0 4px", fontSize: 23 }}>Create your teacher account</h2>
          <p className="auth-sub">Use your school email. Your account starts with teacher access.</p>
          <form onSubmit={onSubmit} noValidate>
            <div className="field">
              <label htmlFor="name">Full name</label>
              <input className="inp" id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Mr. Santos" />
            </div>
            <div className="field">
              <label htmlFor="email">School email</label>
              <input className="inp" id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="santos@school.edu" />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input className="inp" id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              <div className="hint">At least 8 characters.</div>
            </div>
            <div className="field">
              <label htmlFor="password2">Confirm password</label>
              <input className="inp" id="password2" type="password" required value={password2} onChange={(e) => setPassword2(e.target.value)} />
            </div>
            {error && <div className="err">{error}</div>}
            <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>
          <div className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></div>
        </div>
      </div>
    </div>
  );
}
