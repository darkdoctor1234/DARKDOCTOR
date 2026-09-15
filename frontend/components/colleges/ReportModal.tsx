"use client";

import { useState } from "react";
import { REPORT_REASONS, type ReportReason } from "@/lib/questionsApi";

interface Props {
  title: string;
  thankYouText: string;
  onSubmit: (reason: ReportReason, detail: string) => Promise<void>;
  onClose: () => void;
}

export default function ReportModal({ title, thankYouText, onSubmit, onClose }: Props) {
  const [reason,  setReason]  = useState<ReportReason | "">("");
  const [detail,  setDetail]  = useState("");
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [err,     setErr]     = useState("");

  async function submit() {
    if (!reason) return setErr("Please select a reason.");
    setLoading(true); setErr("");
    try {
      await onSubmit(reason, detail);
      setDone(true);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to report.");
    } finally { setLoading(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--dd-bg2)", borderRadius: "18px", border: "1px solid var(--dd-border2)", width: "100%", maxWidth: "420px", padding: "24px", boxShadow: "var(--dd-shadow-lg)" }}>
        {done ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ color: "var(--dd-success)", marginBottom: "12px", display: "flex", justifyContent: "center" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M8 12.5l2.5 2.5L16 9"/>
              </svg>
            </div>
            <p style={{ color: "var(--dd-text1)", fontWeight: 600, marginBottom: "6px" }}>Report submitted</p>
            <p style={{ color: "var(--dd-text3)", fontSize: "0.85rem", marginBottom: "20px" }}>{thankYouText}</p>
            <button onClick={onClose} style={{ padding: "10px 24px", borderRadius: "10px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text1)", cursor: "pointer", fontSize: "0.875rem" }}>Close</button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--dd-text1)" }}>{title}</h3>
              <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dd-text3)", fontSize: "16px" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
              {REPORT_REASONS.map((r) => (
                <label key={r.value} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", cursor: "pointer", background: reason === r.value ? "rgba(185,28,28,0.08)" : "var(--dd-surface)", border: `1px solid ${reason === r.value ? "rgba(185,28,28,0.3)" : "var(--dd-border)"}`, transition: "all 0.15s" }}>
                  <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} style={{ accentColor: "var(--dd-danger)" }} />
                  <span style={{ fontSize: "0.875rem", color: reason === r.value ? "var(--dd-danger)" : "var(--dd-text2)" }}>{r.label}</span>
                </label>
              ))}
            </div>
            <textarea id="report-detail" name="detail" value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Additional details (optional)" rows={2}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text1)", fontSize: "0.875rem", resize: "none", boxSizing: "border-box", marginBottom: "14px", outline: "none" }}
            />
            {err && <p style={{ color: "var(--dd-danger)", fontSize: "0.8125rem", marginBottom: "10px" }}>{err}</p>}
            <button onClick={submit} disabled={loading}
              style={{ width: "100%", padding: "11px", borderRadius: "10px", background: loading ? "rgba(185,28,28,0.3)" : "var(--dd-danger)", border: "none", color: "#fff", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", fontSize: "0.9rem" }}
            >{loading ? "Reporting…" : "Submit Report"}</button>
          </>
        )}
      </div>
    </div>
  );
}
