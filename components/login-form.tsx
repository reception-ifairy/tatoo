"use client";

import { ArrowRight, LockKeyhole } from "lucide-react";
import { FormEvent, useState } from "react";

export function LoginForm() {
  const [login, setLogin] = useState("owner");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Login failed.");
      window.location.assign("/studio");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="owner-login-form" onSubmit={submit}>
      <label><span>Owner login</span><input autoComplete="username" value={login} onChange={(event) => setLogin(event.target.value)} /></label>
      <label><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus /></label>
      {error && <p className="login-error" role="alert">{error}</p>}
      <button disabled={loading || !login || !password}>{loading ? "Opening the studio…" : "Enter private studio"}<ArrowRight size={17} /></button>
      <small><LockKeyhole size={13} /> Owner-only access · 8-hour secure session</small>
    </form>
  );
}
