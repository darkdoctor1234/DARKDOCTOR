"use client";

import { useState, useEffect } from "react";
import { superAdminApi, AdminUser } from "@/lib/adminApi";

interface Props {
  admin: AdminUser | null;
  onClose: () => void;
  onDeleted: (id: number) => void;
}

export default function DeleteAdminModal({ admin, onClose, onDeleted }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (admin) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [admin, onClose]);

  if (!admin) return null;

  async function handleDelete() {
    if (!admin) return;
    setLoading(true);
    setError(null);
    try {
      await superAdminApi.deleteAdmin(admin.id);
      onDeleted(admin.id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete admin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(15,23,42,0.45)",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
        }}
      />
      <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", pointerEvents: "none" }}>
        <div style={{
          width: "100%", maxWidth: "380px",
          background: "var(--dd-bg2)",
          border: "1px solid var(--dd-border)",
          borderRadius: "20px",
          boxShadow: "var(--dd-shadow-lg)",
          padding: "28px 24px",
          pointerEvents: "auto",
          animation: "slideUp 0.18s ease",
        }}>
          {/* Warning icon */}
          <div style={{
            width: "44px", height: "44px", borderRadius: "12px",
            background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: "16px",
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L18.66 17H1.34L10 2z" stroke="var(--dd-danger)" strokeWidth="1.6" strokeLinejoin="round" fill="none"/>
              <line x1="10" y1="8" x2="10" y2="12" stroke="var(--dd-danger)" strokeWidth="1.6" strokeLinecap="round"/>
              <circle cx="10" cy="14.5" r="0.7" fill="var(--dd-danger)"/>
            </svg>
          </div>

          <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.0625rem", fontWeight: 600, color: "var(--dd-text1)", letterSpacing: "-0.01em", marginBottom: "6px" }}>
            Delete Admin?
          </h3>
          <p style={{ fontSize: "0.875rem", color: "var(--dd-text2)", lineHeight: "1.5", marginBottom: "20px" }}>
            <strong style={{ color: "var(--dd-text1)" }}>{admin.full_name || admin.email}</strong> will lose access immediately. This action cannot be undone.
          </p>

          {error && (
            <div style={{ marginBottom: "14px", padding: "9px 12px", borderRadius: "8px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)" }}>
              <span style={{ fontSize: "0.8125rem", color: "var(--dd-danger)" }}>{error}</span>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: "10px",
                borderRadius: "10px", background: "var(--dd-surface2)",
                border: "1px solid var(--dd-border2)", color: "var(--dd-text2)",
                fontSize: "0.9375rem", fontWeight: 500, cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              style={{
                flex: 1, padding: "10px",
                borderRadius: "10px",
                background: loading ? "rgba(185,28,28,0.3)" : "var(--dd-danger)",
                border: "none", color: "white",
                fontSize: "0.9375rem", fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 4px 16px var(--dd-danger-border)",
                opacity: loading ? 0.7 : 1,
                transition: "all 0.2s",
              }}
            >
              {loading ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(12px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }`}</style>
    </>
  );
}
