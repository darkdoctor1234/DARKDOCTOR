"use client";

import { useState, useEffect, useRef } from "react";
import { authApi } from "@/lib/api";
import { getAccessToken, getRefreshToken, getUser, saveSession } from "@/lib/auth";

const RESEND_COOLDOWN_S = 45;

interface Props {
  email: string;
  onClose: () => void;
  onVerified: () => void;
}

export default function EmailVerifyModal({ email, onClose, onVerified }: Props) {
  const [otp,         setOtp]         = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [sending,     setSending]     = useState(false);
  const [error,       setError]       = useState("");
  const [devOtp,       setDevOtp]      = useState<string | null>(null);
  const [cooldown,    setCooldown]    = useState(0);
  const sentOnce = useRef(false);

  // Send a code as soon as the modal opens, so the user doesn't have to click twice.
  useEffect(() => {
    if (sentOnce.current) return;
    sentOnce.current = true;
    sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode() {
    setSending(true);
    setError("");
    try {
      const res = await authApi.sendEmailVerification();
      setDevOtp(res.dev_otp ?? null);
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send code.");
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) return setError("Enter the 6-digit code.");
    setSubmitting(true);
    setError("");
    try {
      await authApi.verifyEmail(otp);
      const access  = getAccessToken();
      const refresh = getRefreshToken();
      const session = getUser<Record<string, unknown>>();
      if (access && refresh && session) {
        saveSession(access, refresh, { ...session, email_verified: true });
      }
      onVerified();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid or expired code.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px",
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--dd-bg2)", borderRadius: "22px",
        border: "1px solid var(--dd-border)",
        width: "100%", maxWidth: "420px",
        padding: "28px",
        boxShadow: "var(--dd-shadow-lg)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px" }}>
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.15rem", fontWeight: 600, color: "var(--dd-text1)", letterSpacing: "-0.01em" }}>
            Verify your email
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dd-text3)", padding: "4px" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-text1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)"; }}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8"/>
            </svg>
          </button>
        </div>

        <p style={{ fontSize: "0.875rem", color: "var(--dd-text3)", lineHeight: 1.6, marginBottom: "20px" }}>
          {sending && !devOtp ? "Sending a 6-digit code to " : "We sent a 6-digit code to "}
          <strong style={{ color: "var(--dd-text1)" }}>{email}</strong>.
        </p>

        {devOtp && (
          <div style={{ padding: "10px 14px", borderRadius: "10px", background: "var(--dd-warning-bg)", border: "1px solid var(--dd-warning-border)", marginBottom: "18px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--dd-warning)", fontWeight: 600 }}>Dev mode, your code:</span>{" "}
            <span className="num" style={{ fontSize: "0.875rem", color: "var(--dd-text1)", fontWeight: 700 }}>{devOtp}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "8px" }}>
              6-digit code
            </label>
            <input
              id="email-verify-otp" name="otp"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              autoFocus
              style={{
                width: "100%", padding: "12px 14px", borderRadius: "12px",
                background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)",
                color: "var(--dd-text1)", fontSize: "1.25rem", letterSpacing: "0.3em", textAlign: "center",
                outline: "none", boxSizing: "border-box", fontFamily: "var(--font-sans)",
              }}
            />
          </div>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "10px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", color: "var(--dd-danger)", fontSize: "0.8125rem" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting || otp.length !== 6}
            style={{
              padding: "13px", borderRadius: "12px",
              background: submitting || otp.length !== 6 ? "var(--dd-border2)" : "linear-gradient(135deg,var(--dd-teal),var(--dd-teal-hover))",
              border: "none", color: submitting || otp.length !== 6 ? "var(--dd-text4)" : "#fff", fontSize: "0.9375rem", fontWeight: 600,
              cursor: submitting || otp.length !== 6 ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Verifying…" : "Verify Email"}
          </button>

          <button type="button" onClick={sendCode} disabled={sending || cooldown > 0}
            style={{
              background: "none", border: "none", padding: 0,
              color: cooldown > 0 ? "var(--dd-text4)" : "var(--dd-teal)",
              fontSize: "0.8125rem", fontWeight: 500,
              cursor: cooldown > 0 ? "default" : "pointer", textAlign: "center",
            }}
          >
            {sending ? "Sending…" : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        </form>
      </div>
    </div>
  );
}
