"use client";

import { useState } from "react";
import type { College } from "@/lib/collegeApi";
import { collegeChangeApi, type CollegeField } from "@/lib/collegeChangeApi";

interface Props {
  field: CollegeField;
  fieldLabel: string;
  colleges: College[];
  onClose: () => void;
  onSubmitted: () => void;
}

export default function CollegeChangeRequestModal({ field, fieldLabel, colleges, onClose, onSubmitted }: Props) {
  const [query, setQuery]         = useState("");
  const [selected, setSelected]   = useState<College | null>(null);
  const [file, setFile]           = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState("");

  const filtered = query.trim()
    ? colleges.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || (c.state ?? "").toLowerCase().includes(query.toLowerCase()))
    : colleges;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > 5 * 1024 * 1024) { setError("File must be 5MB or smaller."); return; }
    setError("");
    setFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return setError("Select a college.");
    if (!file) return setError("Upload a proof document.");
    setSubmitting(true);
    setError("");
    try {
      await collegeChangeApi.submit(field, selected.id, file);
      onSubmitted();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--dd-bg2)", borderRadius: "22px", border: "1px solid var(--dd-border)",
        width: "100%", maxWidth: "460px", padding: "28px", boxShadow: "var(--dd-shadow-lg)",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px" }}>
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.15rem", fontWeight: 600, color: "var(--dd-text1)", letterSpacing: "-0.01em" }}>
            Request {fieldLabel} change
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dd-text3)", padding: "4px" }}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
          </button>
        </div>

        <p style={{ fontSize: "0.8125rem", color: "var(--dd-text3)", lineHeight: 1.6, marginBottom: "20px" }}>
          To prevent misuse, changing your {fieldLabel} needs a document proving it (ID card, admission letter, bonafide certificate) and admin approval.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "8px" }}>
              New {fieldLabel}
            </label>
            <input
              id="college-change-search" name="college-search"
              type="text" value={selected ? `${selected.name}${selected.state ? `, ${selected.state}` : ""}` : query}
              onChange={(e) => { setSelected(null); setQuery(e.target.value); }}
              placeholder="Search college name or state…"
              style={{ width: "100%", padding: "11px 14px", borderRadius: "12px", background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)", color: "var(--dd-text1)", fontSize: "0.9375rem", outline: "none", boxSizing: "border-box" }}
            />
            {!selected && query.trim() && (
              <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, maxHeight: "180px", overflowY: "auto", borderRadius: "12px", border: "1px solid var(--dd-border2)" }}>
                {filtered.length === 0 ? (
                  <li style={{ padding: "10px 14px", color: "var(--dd-text3)", fontSize: "0.8125rem" }}>No colleges found</li>
                ) : filtered.slice(0, 30).map((c) => (
                  <li key={c.id} onClick={() => { setSelected(c); setQuery(""); }}
                    style={{ padding: "9px 14px", cursor: "pointer", fontSize: "0.8125rem", color: "var(--dd-text1)", borderBottom: "1px solid var(--dd-border)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                  >
                    {c.name}{c.state ? `, ${c.state}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "8px" }}>
              Proof document
            </label>
            <input
              id="college-change-proof" name="proof" type="file"
              accept="image/*,.pdf"
              onChange={handleFile}
              style={{ width: "100%", fontSize: "0.8125rem", color: "var(--dd-text2)" }}
            />
            <p style={{ fontSize: "0.6875rem", color: "var(--dd-text4)", marginTop: "6px" }}>Image or PDF, up to 5MB.</p>
          </div>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "10px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", color: "var(--dd-danger)", fontSize: "0.8125rem" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting || !selected || !file}
            style={{
              padding: "13px", borderRadius: "12px",
              background: submitting || !selected || !file ? "var(--dd-border2)" : "linear-gradient(135deg,var(--dd-teal),var(--dd-teal-hover))",
              border: "none", color: submitting || !selected || !file ? "var(--dd-text4)" : "#fff", fontSize: "0.9375rem", fontWeight: 600,
              cursor: submitting || !selected || !file ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Submitting…" : "Submit Request"}
          </button>
        </form>
      </div>
    </div>
  );
}
