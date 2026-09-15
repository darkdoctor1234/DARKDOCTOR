"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Review } from "@/lib/collegeApi";

const ROLE_LABELS: Record<string, string> = { student: "Student", alumni: "Alumni", faculty: "Faculty" };

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  visible:  { label: "Approved", color: "var(--dd-success)", bg: "var(--dd-success-bg)", border: "var(--dd-success-border)" },
  rejected: { label: "Rejected", color: "var(--dd-danger)",  bg: "var(--dd-danger-bg)",  border: "var(--dd-danger-border)" },
  removed:  { label: "Removed",  color: "var(--dd-danger)",  bg: "var(--dd-danger-bg)",  border: "var(--dd-danger-border)" },
};

interface Props {
  review: Review;
  mode: "pending" | "reported" | "history";
  acting: boolean;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onRemove: () => void;
}

export default function AdminReviewCard({ review, mode, acting, onApprove, onReject, onRemove }: Props) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const accent = mode === "reported" ? "var(--dd-warning)" : mode === "pending" ? "#7c3aed" : "var(--dd-text3)";
  const accentBg = mode === "reported" ? "var(--dd-warning-bg)" : mode === "pending" ? "rgba(124,58,237,0.06)" : "var(--dd-surface)";
  const accentBorder = mode === "reported" ? "var(--dd-warning-border)" : mode === "pending" ? "rgba(124,58,237,0.22)" : "var(--dd-border)";

  function confirmReject() {
    if (!reason.trim()) return;
    onReject(reason.trim());
    setRejecting(false);
    setReason("");
  }

  return (
    <div style={{ background: accentBg, borderRadius: "18px", border: `1px solid ${accentBorder}`, padding: "20px 22px" }}>

      {/* Header */}
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "12px" }}>
        <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: `linear-gradient(135deg, ${accent}, var(--dd-teal))`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8125rem", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
          {(review.user_name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, color: "var(--dd-text1)", fontSize: "0.9rem" }}>{review.user_name}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--dd-text2)", background: "var(--dd-surface2)", borderRadius: "6px", padding: "2px 8px" }}>{ROLE_LABELS[review.role] ?? review.role}</span>
            {review.department && <span style={{ fontSize: "0.75rem", color: "var(--dd-text3)" }}>· {review.department}</span>}
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--dd-text4)", marginTop: "2px" }}>
            {review.user_email} · {new Date(review.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            {" · "}College #{review.college}
          </p>
        </div>
        {mode === "reported" && (
          <div style={{ background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", borderRadius: "10px", padding: "6px 12px", textAlign: "center", flexShrink: 0 }}>
            <div className="num" style={{ fontSize: "1rem", fontWeight: 700, color: "var(--dd-danger)", lineHeight: 1 }}>{review.report_count}</div>
            <div style={{ fontSize: "0.6rem", color: "var(--dd-danger)", opacity: 0.7 }}>reports</div>
          </div>
        )}
        {mode === "history" && STATUS_META[review.status] && (
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: STATUS_META[review.status].color, background: STATUS_META[review.status].bg, border: `1px solid ${STATUS_META[review.status].border}`, borderRadius: "8px", padding: "4px 10px", flexShrink: 0 }}>
            {STATUS_META[review.status].label}
          </span>
        )}
      </div>

      {/* Title & content */}
      <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "0.9375rem", fontWeight: 700, color: "var(--dd-text1)", marginBottom: "6px" }}>{review.title}</h3>
      <p style={{ fontSize: "0.875rem", color: "var(--dd-text2)", lineHeight: 1.6, marginBottom: "14px" }}>{review.content}</p>

      {/* Ratings row */}
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", padding: "10px 14px", borderRadius: "10px", background: "var(--dd-surface)", marginBottom: "14px", fontSize: "0.75rem" }}>
        {[
          ["Infra", review.rating_infrastructure],
          ["Clinical", review.rating_clinical],
          ["Hostel", review.rating_hostel],
          ["Admin", review.rating_administration],
          ["Overall", review.rating_overall],
        ].map(([label, val]) => (
          <div key={label as string}>
            <span style={{ color: "var(--dd-text3)" }}>{label}: </span>
            <span style={{ color: "var(--dd-warning)", fontWeight: 600 }}>{"★".repeat(val as number)}{"☆".repeat(5 - (val as number))}</span>
          </div>
        ))}
        <div><span style={{ color: "var(--dd-text3)" }}>Avg: </span><span className="num" style={{ color: "var(--dd-text1)", fontWeight: 700 }}>{review.average_rating.toFixed(1)}</span></div>
      </div>

      {/* History mode: show the resolution info instead of action buttons */}
      {mode === "history" ? (
        <div style={{ paddingTop: "12px", borderTop: "1px solid var(--dd-border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <p style={{ fontSize: "0.8125rem", color: "var(--dd-text3)" }}>
            {review.status === "rejected" && review.rejection_reason && (
              <>Rejected: &ldquo;{review.rejection_reason}&rdquo; · </>
            )}
            Handled by <strong style={{ color: "var(--dd-text2)" }}>{review.resolved_by_email ?? "-"}</strong>
            {" · "}{new Date(review.updated_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </p>
          <button
            onClick={() => router.push(`/colleges/${review.college}`)}
            style={{ padding: "7px 14px", borderRadius: "10px", background: "transparent", border: "1px solid var(--dd-border)", color: "var(--dd-text3)", fontSize: "0.8125rem", cursor: "pointer" }}
          >
            View College →
          </button>
        </div>
      ) : rejecting ? (
        <div style={{ paddingTop: "14px", borderTop: "1px solid var(--dd-border)" }}>
          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "8px" }}>
            Reason for rejection (shown to the reviewer)
          </label>
          <textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. This reads like it's about a different department, please clarify or correct."
            rows={2}
            style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)", color: "var(--dd-text1)", fontSize: "0.875rem", resize: "vertical", boxSizing: "border-box", marginBottom: "10px" }}
          />
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={confirmReject}
              disabled={!reason.trim() || acting}
              style={{ padding: "8px 16px", borderRadius: "10px", background: "var(--dd-danger)", border: "none", color: "#fff", fontSize: "0.8125rem", fontWeight: 600, cursor: reason.trim() ? "pointer" : "not-allowed", opacity: reason.trim() ? 1 : 0.5 }}
            >
              Confirm Rejection
            </button>
            <button
              onClick={() => { setRejecting(false); setReason(""); }}
              style={{ padding: "8px 16px", borderRadius: "10px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text2)", fontSize: "0.8125rem", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "10px", alignItems: "center", paddingTop: "14px", borderTop: "1px solid var(--dd-border)", flexWrap: "wrap" }}>
          <button
            onClick={onApprove}
            disabled={acting}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 18px", borderRadius: "10px", background: "var(--dd-success-bg)", border: "1px solid var(--dd-success-border)", color: "var(--dd-success)", fontSize: "0.875rem", fontWeight: 600, cursor: acting ? "not-allowed" : "pointer", transition: "all 0.15s" }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="3 8 6 11 13 4"/></svg>
            {acting ? "Processing…" : mode === "pending" ? "Approve & Publish" : "Approve & Restore"}
          </button>

          {mode === "pending" && (
            <button
              onClick={() => setRejecting(true)}
              disabled={acting}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 18px", borderRadius: "10px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", color: "var(--dd-danger)", fontSize: "0.875rem", fontWeight: 600, cursor: acting ? "not-allowed" : "pointer" }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
              Reject
            </button>
          )}

          {mode === "reported" && (
            <button
              onClick={onRemove}
              disabled={acting}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 18px", borderRadius: "10px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", color: "var(--dd-danger)", fontSize: "0.875rem", fontWeight: 600, cursor: acting ? "not-allowed" : "pointer" }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
              Remove
            </button>
          )}

          <button
            onClick={() => router.push(`/colleges/${review.college}`)}
            style={{ marginLeft: "auto", padding: "9px 14px", borderRadius: "10px", background: "transparent", border: "1px solid var(--dd-border)", color: "var(--dd-text3)", fontSize: "0.8125rem", cursor: "pointer", transition: "all 0.15s" }}
          >
            View College →
          </button>
        </div>
      )}
    </div>
  );
}
