"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { superAdminApi, AdminUser } from "@/lib/adminApi";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (admin: AdminUser) => void;
}

export default function CreateAdminModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "super_admin">("admin");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(""); setEmail(""); setPassword(""); setRole("admin"); setError(null); setShowPassword(false);
      setTimeout(() => nameRef.current?.focus(), 80);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const admin = await superAdminApi.createAdmin({ full_name: name.trim(), email: email.trim(), password, role });
      onCreated(admin);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create admin.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

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

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(15,23,42,0.45)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          animation: "fadeIn 0.15s ease",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "16px",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: "100%", maxWidth: "440px",
            background: "var(--dd-bg2)",
            border: "1px solid var(--dd-border)",
            borderRadius: "20px",
            boxShadow: "var(--dd-shadow-lg)",
            padding: "32px 28px",
            pointerEvents: "auto",
            animation: "slideUp 0.2s ease",
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.25rem", fontWeight: 600, color: "var(--dd-text1)", letterSpacing: "-0.02em" }}>
                {role === "super_admin" ? "Create Super Admin" : "Create Admin"}
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "var(--dd-text3)", marginTop: "3px" }}>
                New account can log in at <span style={{ color: "var(--dd-text2)" }}>{role === "super_admin" ? "/superadmin" : "/admin"}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "var(--dd-surface2)", border: "none", borderRadius: "8px",
                width: "30px", height: "30px", cursor: "pointer", color: "var(--dd-text2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="1" y1="1" x2="13" y2="13" /><line x1="13" y1="1" x2="1" y2="13" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Role */}
            <div>
              <label style={labelStyle}>Role</label>
              <div style={{ display: "flex", gap: "8px" }}>
                {(["admin", "super_admin"] as const).map((r) => (
                  <button key={r} type="button" onClick={() => setRole(r)}
                    style={{
                      flex: 1, padding: "9px", borderRadius: "10px",
                      background: role === r ? "var(--dd-teal-bg2)" : "var(--dd-surface2)",
                      border: `1px solid ${role === r ? "var(--dd-teal-border)" : "var(--dd-border2)"}`,
                      color: role === r ? "var(--dd-teal)" : "var(--dd-text2)",
                      fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                    }}
                  >
                    {r === "admin" ? "Admin" : "Super Admin"}
                  </button>
                ))}
              </div>
              {role === "super_admin" && (
                <p style={{ fontSize: "0.75rem", color: "var(--dd-warning)", marginTop: "8px", lineHeight: 1.5 }}>
                  Full platform access, including creating and managing other admins. Only create one for someone you fully trust.
                </p>
              )}
            </div>

            {/* Name */}
            <div>
              <label htmlFor="admin-name" style={labelStyle}>Name</label>
              <input
                ref={nameRef}
                id="admin-name"
                type="text"
                required
                autoComplete="off"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#7c3aed"; e.currentTarget.style.background = "var(--dd-surface2)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--dd-border2)"; e.currentTarget.style.background = "var(--dd-input-bg)"; }}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="admin-email" style={labelStyle}>Email</label>
              <input
                id="admin-email"
                type="email"
                required
                autoComplete="off"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#7c3aed"; e.currentTarget.style.background = "var(--dd-surface2)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--dd-border2)"; e.currentTarget.style.background = "var(--dd-input-bg)"; }}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="admin-password" style={labelStyle}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ ...inputStyle, paddingRight: "44px" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#7c3aed"; e.currentTarget.style.background = "var(--dd-surface2)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--dd-border2)"; e.currentTarget.style.background = "var(--dd-input-bg)"; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "var(--dd-text3)", padding: "4px",
                    display: "flex", alignItems: "center",
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
            <div className="flex gap-3 mt-1">
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1, padding: "11px",
                  borderRadius: "10px",
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
                  flex: 2, padding: "11px",
                  borderRadius: "10px",
                  background: loading ? "rgba(124,58,237,0.4)" : "linear-gradient(135deg, #7c3aed 0%, #0d9488 100%)",
                  border: "none",
                  color: "white", fontSize: "0.9375rem", fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: loading ? "none" : "0 4px 20px rgba(124,58,237,0.3)",
                  transition: "all 0.2s",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Creating…" : role === "super_admin" ? "Create Super Admin" : "Create Admin"}
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
