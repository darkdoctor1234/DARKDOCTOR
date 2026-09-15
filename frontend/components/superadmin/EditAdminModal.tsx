"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { superAdminApi, AdminUser } from "@/lib/adminApi";

interface Props {
  admin: AdminUser | null;
  onClose: () => void;
  onUpdated: (admin: AdminUser) => void;
}

export default function EditAdminModal({ admin, onClose, onUpdated }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Populate fields when admin changes
  useEffect(() => {
    if (admin) {
      setName(admin.full_name ?? "");
      setEmail(admin.email ?? "");
      setPassword("");
      setError(null);
      setShowPassword(false);
      setTimeout(() => nameRef.current?.focus(), 80);
    }
  }, [admin]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (admin) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [admin, onClose]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!admin) return;
    setError(null);
    setLoading(true);
    try {
      const payload: { full_name: string; email: string; password?: string } = {
        full_name: name.trim(),
        email: email.trim(),
      };
      if (password) payload.password = password;
      const updated = await superAdminApi.updateAdmin(admin.id, payload);
      onUpdated(updated);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update admin.");
    } finally {
      setLoading(false);
    }
  }

  if (!admin) return null;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: "10px",
    background: "var(--dd-input-bg)",
    border: "1px solid var(--dd-border2)",
    color: "var(--dd-text1)",
    fontSize: "0.9375rem",
    letterSpacing: "-0.01em",
    outline: "none",
    transition: "border-color 0.15s, background 0.15s",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "0.8125rem",
    color: "var(--dd-text2)",
    letterSpacing: "-0.01em",
    marginBottom: "6px",
    display: "block",
  };

  const focusIn = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "#0d9488";
    e.currentTarget.style.background = "var(--dd-surface2)";
  };
  const focusOut = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "var(--dd-border2)";
    e.currentTarget.style.background = "var(--dd-input-bg)";
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(15,23,42,0.48)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          animation: "fadeIn 0.15s ease",
        }}
      />

      {/* Modal */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px", pointerEvents: "none",
      }}>
        <div style={{
          width: "100%", maxWidth: "440px",
          background: "var(--dd-bg2)",
          border: "1px solid var(--dd-border)",
          borderRadius: "20px",
          boxShadow: "var(--dd-shadow-lg)",
          padding: "32px 28px",
          pointerEvents: "auto",
          animation: "slideUp 0.2s ease",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {/* Edit icon badge */}
              <div style={{
                width: "40px", height: "40px", borderRadius: "11px",
                background: "var(--dd-teal-bg2)", border: "1px solid var(--dd-teal-border)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="var(--dd-teal)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-9 9L3 17l1.586-4.414 9-9z"/>
                </svg>
              </div>
              <div>
                <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.125rem", fontWeight: 600, color: "var(--dd-text1)", letterSpacing: "-0.02em" }}>
                  Edit Admin
                </h2>
                <p style={{ fontSize: "0.8rem", color: "var(--dd-text3)", marginTop: "2px" }}>
                  {admin.email}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "var(--dd-surface2)", border: "none", borderRadius: "8px",
                width: "30px", height: "30px", cursor: "pointer", color: "var(--dd-text2)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Name */}
            <div>
              <label htmlFor="edit-name" style={labelStyle}>Name</label>
              <input
                ref={nameRef}
                id="edit-name"
                type="text"
                required
                autoComplete="off"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
                onFocus={focusIn}
                onBlur={focusOut}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="edit-email" style={labelStyle}>Email</label>
              <input
                id="edit-email"
                type="email"
                required
                autoComplete="off"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                onFocus={focusIn}
                onBlur={focusOut}
              />
            </div>

            {/* Password (optional) */}
            <div>
              <label htmlFor="edit-password" style={labelStyle}>
                New Password
                <span style={{ color: "var(--dd-text3)", marginLeft: "6px", fontSize: "0.75rem" }}>
                  (leave blank to keep current)
                </span>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="edit-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={6}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ ...inputStyle, paddingRight: "44px" }}
                  onFocus={focusIn}
                  onBlur={focusOut}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "var(--dd-text3)",
                    padding: "4px", display: "flex", alignItems: "center",
                  }}
                  aria-label={showPassword ? "Hide" : "Show"}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20C7 20 2.73 16.39 1 12c.79-1.96 2.07-3.67 3.67-5M9.9 4.24A9.12 9.12 0 0112 4c5 0 9.27 3.61 11 8-.43 1.07-1.01 2.06-1.71 2.94M1 1l22 22"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12C2.73 7.61 7 4 12 4s9.27 3.61 11 8c-1.73 4.39-6 8-11 8S2.73 16.39 1 12z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 12px", borderRadius: "10px",
                background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)",
              }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="var(--dd-danger)" strokeWidth="1.5"/>
                  <line x1="8" y1="5" x2="8" y2="9" stroke="var(--dd-danger)" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="8" cy="11.5" r="0.75" fill="var(--dd-danger)"/>
                </svg>
                <span style={{ fontSize: "0.8125rem", color: "var(--dd-danger)" }}>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1, padding: "11px", borderRadius: "10px",
                  background: "var(--dd-surface2)",
                  border: "1px solid var(--dd-border2)",
                  color: "var(--dd-text2)", fontSize: "0.9375rem", fontWeight: 500,
                  cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-border2)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 2, padding: "11px", borderRadius: "10px",
                  background: loading ? "rgba(13,148,136,0.4)" : "linear-gradient(135deg, #0d9488 0%, #7c3aed 100%)",
                  border: "none", color: "white",
                  fontSize: "0.9375rem", fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: loading ? "none" : "0 4px 20px rgba(13,148,136,0.3)",
                  transition: "all 0.2s",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </>
  );
}
