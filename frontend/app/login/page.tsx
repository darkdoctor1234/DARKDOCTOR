"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { saveSession, isAuthenticated, FEED_PREFS_KEY } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPwd,  setShowPwd]  = useState(false);

  useEffect(() => {
    if (isAuthenticated()) router.replace("/feed");
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) { setError("Please fill in all fields."); return; }
    setLoading(true);
    try {
      const res = await authApi.userLogin({ email: email.trim().toLowerCase(), password });
      saveSession(res.access, res.refresh, res.user);
      if (res.user.current_status) {
        sessionStorage.setItem(FEED_PREFS_KEY, JSON.stringify({
          status:     res.user.current_status,
          highestEdu: res.user.highest_education || "",
          ugCollege:  res.user.ug_college ?? null,
          pgCollege:  res.user.pg_college ?? null,
        }));
      } else {
        sessionStorage.removeItem(FEED_PREFS_KEY);
      }
      router.replace("/feed");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100svh", background: "var(--dd-bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>

      <div style={{ position: "fixed", top: "-200px", left: "50%", transform: "translateX(-50%)", width: "600px", height: "600px", background: "radial-gradient(circle,rgba(13,148,136,0.07) 0%,transparent 65%)", filter: "blur(50px)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "400px" }}>

        <button
          onClick={() => router.push("/")}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "var(--dd-surface2)", border: "1px solid var(--dd-border)",
            borderRadius: "10px", padding: "8px 14px",
            color: "var(--dd-text2)", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
            transition: "all 0.15s", marginBottom: "24px",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-border)"; e.currentTarget.style.color = "var(--dd-text1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text2)"; }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8l4-4"/>
          </svg>
          Home
        </button>

        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <button onClick={() => router.push("/")} style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Darkdoctor" draggable={false}
              style={{ height: "38px", width: "auto", objectFit: "contain" }} />
          </button>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--dd-text1)", letterSpacing: "-0.03em", marginTop: "20px", marginBottom: "6px" }}>
            Welcome back
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--dd-text3)" }}>Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", borderRadius: "20px", padding: "28px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>

          <div>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "8px" }}>
              Email Address
            </label>
            <input
              id="login-email" name="email"
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" autoComplete="email" autoFocus
              style={{ width: "100%", padding: "11px 14px", borderRadius: "12px", background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)", color: "var(--dd-text1)", fontSize: "0.9375rem", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(13,148,136,0.5)"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--dd-border2)"; }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "8px" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="login-password" name="password"
                type={showPwd ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password"
                style={{ width: "100%", padding: "11px 42px 11px 14px", borderRadius: "12px", background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)", color: "var(--dd-text1)", fontSize: "0.9375rem", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(13,148,136,0.5)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--dd-border2)"; }}
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--dd-text3)", padding: "2px" }}>
                {showPwd
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>

          <div style={{ textAlign: "right", marginTop: "-8px" }}>
            <button
              type="button"
              onClick={() => router.push("/forgot-password")}
              style={{ background: "none", border: "none", color: "#0d9488", fontWeight: 500, cursor: "pointer", fontSize: "0.8125rem" }}
            >
              Forgot password?
            </button>
          </div>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "10px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", color: "var(--dd-danger)", fontSize: "0.8125rem" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ padding: "12px", borderRadius: "12px", background: "linear-gradient(135deg,#0d9488 0%,#7c3aed 100%)", border: "none", color: "#fff", fontSize: "0.9375rem", fontWeight: 600, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.75 : 1, transition: "opacity 0.15s", marginTop: "4px", boxShadow: "0 4px 20px rgba(13,148,136,0.24)" }}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "0.875rem", color: "var(--dd-text3)" }}>
          Don&apos;t have an account?{" "}
          <button onClick={() => router.push("/signup")}
            style={{ background: "none", border: "none", color: "#0d9488", fontWeight: 500, cursor: "pointer", fontSize: "0.875rem" }}>
            Create account
          </button>
        </p>
      </div>
    </div>
  );
}
