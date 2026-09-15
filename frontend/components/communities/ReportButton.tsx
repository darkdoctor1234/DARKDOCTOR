"use client";

import { useState } from "react";

const REASONS = [
  { value: "spam",       label: "Spam or advertisement" },
  { value: "offensive",  label: "Offensive or inappropriate" },
  { value: "misleading", label: "Medically misleading" },
  { value: "harassment", label: "Harassment of another member" },
  { value: "other",      label: "Other" },
];

export default function ReportButton({ onReport }: { onReport: (reason: string, detail: string) => Promise<void> }) {
  const [open,       setOpen]       = useState(false);
  const [reason,     setReason]     = useState("spam");
  const [detail,     setDetail]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done,        setDone]       = useState(false);
  const [error,        setError]      = useState("");

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      await onReport(reason, detail);
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to report.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return <span style={{ fontSize: "0.72rem", color: "var(--dd-text4)" }}>Reported</span>;
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dd-text4)", fontSize: "0.72rem", padding: 0, display: "flex", alignItems: "center", gap: "4px" }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-danger)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text4)"; }}
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 2v12M3 2h8l-1.5 2.5L11 7H3"/>
        </svg>
        Report
      </button>
    );
  }

  return (
    <div style={{ marginTop: "8px", padding: "12px", borderRadius: "10px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "8px" }}>
        {REASONS.map((r) => (
          <label key={r.value} style={{ display: "flex", alignItems: "center", gap: "7px", cursor: "pointer" }}>
            <input type="radio" name="report-reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} style={{ accentColor: "var(--dd-danger)" }} />
            <span style={{ fontSize: "0.8125rem", color: reason === r.value ? "var(--dd-danger)" : "var(--dd-text2)" }}>{r.label}</span>
          </label>
        ))}
      </div>
      <textarea
        id="report-detail" name="detail"
        value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Additional details (optional)" rows={2}
        style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text1)", fontSize: "0.8125rem", resize: "none", boxSizing: "border-box", marginBottom: "10px", outline: "none" }}
      />
      {error && <p style={{ fontSize: "0.75rem", color: "var(--dd-danger)", marginBottom: "8px" }}>{error}</p>}
      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={submit} disabled={submitting} style={{ padding: "6px 16px", borderRadius: "8px", background: "var(--dd-danger)", border: "none", color: "#fff", fontSize: "0.78125rem", fontWeight: 600, cursor: submitting ? "wait" : "pointer" }}>
          {submitting ? "Sending…" : "Submit Report"}
        </button>
        <button onClick={() => setOpen(false)} disabled={submitting} style={{ padding: "6px 16px", borderRadius: "8px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text2)", fontSize: "0.78125rem", cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
