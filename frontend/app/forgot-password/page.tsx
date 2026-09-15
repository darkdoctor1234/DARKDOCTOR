"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";

type Step = "email" | "otp" | "reset" | "done";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step,        setStep]        = useState<Step>("email");
  const [email,       setEmail]       = useState("");
  const [otp,         setOtp]         = useState("");
  const [devOtp,      setDevOtp]      = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [showPwd,     setShowPwd]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim()) return setError("Please enter your email.");
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email.trim().toLowerCase());
      if (res.dev_otp) setDevOtp(res.dev_otp);
      setStep("otp");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally { setLoading(false); }
  }

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (otp.length !== 6) return setError("Enter the 6-digit code.");
    if (newPassword.length < 6) return setError("Password must be at least 6 characters.");
    if (newPassword !== confirm) return setError("Passwords don't match.");
    setLoading(true);
    try {
      await authApi.resetPassword(email.trim().toLowerCase(), otp, newPassword);
      setStep("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100svh", background: "var(--dd-bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ position: "fixed", top: "-200px", left: "50%", transform: "translateX(-50%)", width: "600px", height: "600px", background: "radial-gradient(circle,rgba(13,148,136,0.07) 0%,transparent 65%)", filter: "blur(50px)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "400px" }}>
        {/* Back */}
        <button onClick={() => router.push("/login")}
          style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)", borderRadius: "10px", padding: "8px 14px", color: "var(--dd-text2)", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", marginBottom: "24px", transition: "all 0.15s" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface)"; e.currentTarget.style.color = "var(--dd-text2)"; }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 12L6 8l4-4"/></svg>
          Back to login
        </button>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <button onClick={() => router.push("/")} style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Darkdoctor" draggable={false} style={{ height: "38px", width: "auto", objectFit: "contain" }} />
          </button>
        </div>

        {/* ── STEP: Email ── */}
        {step === "email" && (
          <>
            <div style={{ textAlign: "center", marginBottom: "28px" }}>
              <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "rgba(13,148,136,0.1)", border: "1px solid rgba(13,148,136,0.22)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,9 12,15 22,9"/></svg>
              </div>
              <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--dd-text1)", letterSpacing: "-0.03em", marginBottom: "6px" }}>Forgot password?</h1>
              <p style={{ fontSize: "0.875rem", color: "var(--dd-text3)", lineHeight: 1.5 }}>Enter your email and we&apos;ll send you a reset code.</p>
            </div>
            <form onSubmit={handleEmailSubmit} style={{ background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", borderRadius: "20px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={labelStyle}>Email Address</label>
                <input id="forgot-password-email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(13,148,136,0.5)"; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--dd-border2)"; }}
                />
              </div>
              {error && <ErrorBox msg={error} />}
              <button type="submit" disabled={loading} style={submitBtnStyle(loading)}>
                {loading ? "Sending…" : "Send Reset Code"}
              </button>
            </form>
          </>
        )}

        {/* ── STEP: OTP + New password ── */}
        {step === "otp" && (
          <>
            <div style={{ textAlign: "center", marginBottom: "28px" }}>
              <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "var(--dd-success-bg)", border: "1px solid var(--dd-success-border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--dd-success)" }} strokeWidth="1.8" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--dd-text1)", letterSpacing: "-0.03em", marginBottom: "6px" }}>Enter reset code</h1>
              <p style={{ fontSize: "0.875rem", color: "var(--dd-text3)", lineHeight: 1.5 }}>We sent a 6-digit code to <strong style={{ color: "var(--dd-text1)" }}>{email}</strong></p>
              {devOtp && (
                <div style={{ marginTop: "10px", padding: "8px 14px", borderRadius: "10px", background: "var(--dd-warning-bg)", border: "1px solid var(--dd-warning-border)", display: "inline-block" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--dd-warning)", fontWeight: 600 }}>Dev mode, your code:</span>
                  <span className="num" style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--dd-warning)", letterSpacing: "0.1em" }}>{devOtp}</span>
                </div>
              )}
            </div>

            <form onSubmit={handleResetSubmit} style={{ background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", borderRadius: "20px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={labelStyle}>6-Digit Code</label>
                <input
                  id="forgot-password-otp" name="otp"
                  value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456" inputMode="numeric" autoFocus maxLength={6}
                  style={{ ...inputStyle, letterSpacing: "0.25em", fontSize: "1.2rem", textAlign: "center" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(13,148,136,0.5)"; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--dd-border2)"; }}
                />
              </div>

              <div>
                <label style={labelStyle}>New Password</label>
                <div style={{ position: "relative" }}>
                  <input id="forgot-password-new-password" name="new-password" type={showPwd ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    style={{ ...inputStyle, paddingRight: "42px" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(13,148,136,0.5)"; }}
                    onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--dd-border2)"; }}
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--dd-text3)" }}>
                    {showPwd
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Confirm Password</label>
                <input id="forgot-password-confirm" name="confirm-password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password"
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(13,148,136,0.5)"; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--dd-border2)"; }}
                />
              </div>

              {error && <ErrorBox msg={error} />}
              <button type="submit" disabled={loading} style={submitBtnStyle(loading)}>
                {loading ? "Resetting…" : "Reset Password"}
              </button>

              <button type="button" onClick={() => { setStep("email"); setOtp(""); setError(""); }}
                style={{ background: "none", border: "none", color: "var(--dd-text3)", fontSize: "0.8125rem", cursor: "pointer", textAlign: "center" }}>
                ← Use a different email
              </button>
            </form>
          </>
        )}

        {/* ── STEP: Done ── */}
        {step === "done" && (
          <div style={{ textAlign: "center", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", borderRadius: "20px", padding: "40px 24px" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "var(--dd-success-bg)", border: "1px solid var(--dd-success-border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--dd-success)" }} strokeWidth="2.2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--dd-text1)", letterSpacing: "-0.03em", marginBottom: "8px" }}>Password reset!</h2>
            <p style={{ fontSize: "0.875rem", color: "var(--dd-text3)", marginBottom: "28px", lineHeight: 1.5 }}>Your password has been updated. You can now sign in with your new password.</p>
            <button onClick={() => router.push("/login")} style={{ ...submitBtnStyle(false), width: "auto", padding: "12px 32px" }}>
              Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{ padding: "10px 14px", borderRadius: "10px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", color: "var(--dd-danger)", fontSize: "0.8125rem" }}>
      {msg}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.72rem", fontWeight: 600,
  color: "var(--dd-text3)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "8px",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: "12px",
  background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)",
  color: "var(--dd-text1)", fontSize: "0.9375rem", outline: "none",
  boxSizing: "border-box", transition: "border-color 0.15s",
};

function submitBtnStyle(loading: boolean): React.CSSProperties {
  return {
    width: "100%", padding: "12px", borderRadius: "12px",
    background: "linear-gradient(135deg,#0d9488 0%,#7c3aed 100%)",
    border: "none", color: "#fff", fontSize: "0.9375rem", fontWeight: 600,
    cursor: loading ? "wait" : "pointer", opacity: loading ? 0.75 : 1,
    transition: "opacity 0.15s", boxShadow: "0 4px 20px rgba(13,148,136,0.24)",
  };
}
