"use client";

import { useState, useEffect } from "react";
import { usersApi } from "@/lib/adminApi";

export interface BlockTarget {
  id: number;
  label: string;
  is_active: boolean;
}

interface Props {
  target: BlockTarget | null;
  onClose: () => void;
  onDone: (id: number, is_active: boolean, blocked_reason: string) => void;
}

/** Shared block/unblock confirm dialog — reused from the Users page and from
 * the Reviews/Q&A/Communities moderation dashboards (block the author of a
 * piece of flagged content without leaving that page). */
export default function BlockUserModal({ target, onClose, onDone }: Props) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReason("");
    setError(null);
  }, [target]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (target) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [target, onClose]);

  if (!target) return null;
  const blocking = target.is_active;

  async function handleConfirm() {
    if (!target) return;
    if (blocking && !reason.trim()) {
      setError("A reason is required to block a user.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const updated = await usersApi.toggleBlock(target.id, reason.trim());
      onDone(updated.id, updated.is_active, updated.blocked_reason);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", pointerEvents: "none" }}>
        <div style={{
          width: "100%", maxWidth: "400px",
          background: "var(--dd-bg2)", border: "1px solid var(--dd-border)", borderRadius: "20px",
          boxShadow: "var(--dd-shadow-lg)", padding: "28px 24px", pointerEvents: "auto",
          animation: "slideUp 0.18s ease",
        }}>
          <div style={{
            width: "44px", height: "44px", borderRadius: "12px",
            background: blocking ? "var(--dd-danger-bg)" : "var(--dd-success-bg)",
            border: `1px solid ${blocking ? "var(--dd-danger-border)" : "var(--dd-success-border)"}`,
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px",
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={blocking ? "var(--dd-danger)" : "var(--dd-success)"} strokeWidth="1.6" strokeLinecap="round">
              <circle cx="10" cy="10" r="8"/>
              {blocking ? <line x1="5.5" y1="5.5" x2="14.5" y2="14.5"/> : <path d="M6 10l2.5 2.5L14 7"/>}
            </svg>
          </div>

          <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.0625rem", fontWeight: 600, color: "var(--dd-text1)", letterSpacing: "-0.01em", marginBottom: "6px" }}>
            {blocking ? "Block this user?" : "Unblock this user?"}
          </h3>
          <p style={{ fontSize: "0.875rem", color: "var(--dd-text2)", lineHeight: "1.5", marginBottom: "16px" }}>
            <strong style={{ color: "var(--dd-text1)" }}>{target.label}</strong>{" "}
            {blocking
              ? "will be logged out immediately and won't be able to log back in until unblocked."
              : "will be able to log in again."}
          </p>

          {blocking && (
            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="block-reason" style={{ display: "block", fontSize: "0.8125rem", color: "var(--dd-text3)", marginBottom: "6px" }}>
                Reason (kept for your own reference only)
              </label>
              <textarea id="block-reason" name="block-reason" rows={3} value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. repeated spam in Discussions"
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: "10px",
                  background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)",
                  color: "var(--dd-text1)", fontSize: "0.875rem", outline: "none", resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </div>
          )}

          {error && (
            <div style={{ marginBottom: "14px", padding: "9px 12px", borderRadius: "8px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)" }}>
              <span style={{ fontSize: "0.8125rem", color: "var(--dd-danger)" }}>{error}</span>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onClose} style={{
              flex: 1, padding: "10px", borderRadius: "10px",
              background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)",
              color: "var(--dd-text2)", fontSize: "0.9375rem", fontWeight: 500, cursor: "pointer",
            }}>Cancel</button>
            <button onClick={handleConfirm} disabled={loading} style={{
              flex: 1, padding: "10px", borderRadius: "10px",
              background: loading ? "var(--dd-border2)" : (blocking ? "var(--dd-danger)" : "var(--dd-success)"),
              border: "none", color: "white", fontSize: "0.9375rem", fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, transition: "all 0.2s",
            }}>
              {loading ? "Working…" : blocking ? "Block" : "Unblock"}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(12px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }`}</style>
    </>
  );
}
