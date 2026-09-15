"use client";

import { useState } from "react";
import { Review, collegeApi } from "@/lib/collegeApi";
import { getUser } from "@/lib/auth";

interface Props {
  review: Review;
  onReport?: () => void;
}

const RATING_LABELS = [
  { key: "rating_infrastructure",  label: "Infrastructure"    },
  { key: "rating_clinical",        label: "Clinical"          },
  { key: "rating_hostel",          label: "Hostel"            },
  { key: "rating_administration",  label: "Admin"             },
  { key: "rating_overall",         label: "Overall"           },
] as const;

const ROLE_LABELS: Record<string, string> = {
  student: "Student",
  alumni:  "Alumni",
  faculty: "Faculty",
};

function MiniStars({ value }: { value: number }) {
  return (
    <span style={{ display: "inline-flex", gap: "1px" }}>
      {[1,2,3,4,5].map((s) => (
        <span key={s} style={{ fontSize: "11px", color: s <= value ? "#b45309" : "var(--dd-text4)" }}>★</span>
      ))}
    </span>
  );
}

function ReportModal({ reviewId, onClose }: { reviewId: number; onClose: () => void }) {
  const [reason,  setReason]  = useState("");
  const [detail,  setDetail]  = useState("");
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [err,     setErr]     = useState("");

  const REASONS = [
    { value: "fake",       label: "Fake / Not a real student"   },
    { value: "spam",       label: "Spam or advertisement"        },
    { value: "offensive",  label: "Offensive or inappropriate"   },
    { value: "irrelevant", label: "Not relevant to this college" },
    { value: "other",      label: "Other"                        },
  ];

  async function submit() {
    if (!reason) return setErr("Please select a reason.");
    setLoading(true); setErr("");
    try {
      await collegeApi.reviews.report(reviewId, reason, detail);
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
            <p style={{ color: "var(--dd-text3)", fontSize: "0.85rem", marginBottom: "20px" }}>Thank you for helping keep reviews honest.</p>
            <button onClick={onClose} style={{ padding: "10px 24px", borderRadius: "10px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text1)", cursor: "pointer", fontSize: "0.875rem" }}>Close</button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--dd-text1)" }}>Report Review</h3>
              <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dd-text3)", fontSize: "16px" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
              {REASONS.map((r) => (
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

export default function ReviewCard({ review, onReport }: Props) {
  const [helpfulCount, setHelpfulCount] = useState(review.helpful_count);
  const [isHelpful,    setIsHelpful]    = useState(false);
  const [reporting,    setReporting]    = useState(false);
  const [lightbox,     setLightbox]     = useState<string | null>(null);
  const user = typeof window !== "undefined" ? getUser() : null;

  async function toggleHelpful() {
    if (!user) return;
    try {
      const res = await collegeApi.reviews.helpful(review.id);
      setIsHelpful(res.helpful);
      setHelpfulCount(res.helpful_count);
    } catch { /* silent */ }
  }

  return (
    <>
      {lightbox && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: "12px" }} />
        </div>
      )}

      {reporting && (
        <ReportModal reviewId={review.id} onClose={() => { setReporting(false); onReport?.(); }} />
      )}

      <div style={{
        background: "var(--dd-surface)", borderRadius: "18px",
        border: "1px solid var(--dd-border)",
        padding: "20px 22px",
        transition: "border-color 0.2s",
      }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--dd-border2)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--dd-border)"; }}
      >
        {/* Header */}
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "14px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--dd-text3)", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 600, color: "var(--dd-text1)", fontSize: "0.9rem" }}>Anonymous</span>
              {review.is_mine && (
                <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "#0d9488", background: "rgba(13,148,136,0.1)", border: "1px solid rgba(13,148,136,0.25)", borderRadius: "6px", padding: "2px 7px" }}>You</span>
              )}
              {review.is_verified && (
                <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--dd-success)", background: "var(--dd-success-bg)", border: "1px solid var(--dd-success-border)", borderRadius: "6px", padding: "2px 7px" }}>✓ Verified</span>
              )}
              {review.status === "pending" && (
                <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--dd-warning)", background: "var(--dd-warning-bg)", border: "1px solid var(--dd-warning-border)", borderRadius: "6px", padding: "2px 7px" }}>Pending approval</span>
              )}
              {review.status === "rejected" && (
                <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--dd-danger)", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", borderRadius: "6px", padding: "2px 7px" }}>Rejected</span>
              )}
              <span style={{ fontSize: "0.75rem", color: "var(--dd-text3)", background: "var(--dd-surface2)", borderRadius: "6px", padding: "2px 8px" }}>{ROLE_LABELS[review.role] ?? review.role}</span>
              {review.department && (
                <span style={{ fontSize: "0.75rem", color: "var(--dd-text3)" }}>· {review.department}</span>
              )}
              {review.batch_year && (
                <span style={{ fontSize: "0.75rem", color: "var(--dd-text3)" }}>· {review.batch_year}</span>
              )}
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--dd-text4)", marginTop: "2px" }}>
              {new Date(review.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>

          <div style={{ background: "rgba(180,83,9,0.1)", border: "1px solid rgba(180,83,9,0.25)", borderRadius: "10px", padding: "6px 12px", display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
            <span className="num" style={{ fontSize: "1.1rem", fontWeight: 700, color: "#b45309", lineHeight: 1 }}>{review.average_rating.toFixed(1)}</span>
            <span className="num" style={{ fontSize: "0.6rem", color: "#b45309", opacity: 0.7 }}>/ 5.0</span>
          </div>
        </div>

        {review.status === "rejected" && review.rejection_reason && (
          <div style={{ padding: "10px 12px", borderRadius: "10px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", marginBottom: "12px" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--dd-danger)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "3px" }}>Rejected by admin</p>
            <p style={{ fontSize: "0.8125rem", color: "var(--dd-text2)", lineHeight: 1.5 }}>{review.rejection_reason}</p>
          </div>
        )}

        <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.0625rem", fontWeight: 600, color: "var(--dd-text1)", marginBottom: "8px", letterSpacing: "-0.01em", lineHeight: 1.35 }}>{review.title}</h3>

        <p style={{ fontSize: "0.875rem", color: "var(--dd-text2)", lineHeight: 1.65, marginBottom: "16px", whiteSpace: "pre-wrap" }}>{review.content}</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "8px", padding: "12px 14px", borderRadius: "12px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)", marginBottom: review.images.length > 0 ? "16px" : "14px" }}>
          {RATING_LABELS.map(({ key, label }) => (
            <div key={key} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--dd-text3)", fontWeight: 500 }}>{label}</span>
              <MiniStars value={review[key]} />
            </div>
          ))}
        </div>

        {review.images.length > 0 && (
          <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
            {review.images.map((img) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={img.id}
                src={img.image_url}
                alt=""
                onClick={() => setLightbox(img.image_url)}
                style={{ width: "90px", height: "90px", objectFit: "cover", borderRadius: "10px", border: "1px solid var(--dd-border2)", cursor: "pointer", transition: "transform 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.04)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              />
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingTop: "12px", borderTop: "1px solid var(--dd-border)" }}>
          <button
            onClick={toggleHelpful}
            disabled={!user}
            title={user ? "Mark as helpful" : "Log in to mark as helpful"}
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              padding: "6px 12px", borderRadius: "8px", cursor: user ? "pointer" : "default",
              background: isHelpful ? "rgba(21,128,61,0.08)" : "var(--dd-surface2)",
              border: `1px solid ${isHelpful ? "rgba(21,128,61,0.25)" : "var(--dd-border)"}`,
              color: isHelpful ? "var(--dd-success)" : "var(--dd-text3)",
              fontSize: "0.8125rem", fontWeight: 500, transition: "all 0.15s",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={isHelpful ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 22V11M2 13v7a2 2 0 002 2h13.4a2 2 0 002-1.6l1.4-7a2 2 0 00-2-2.4H14V5a3 3 0 00-3-3l-4 8v10"/>
            </svg>
            <span>Helpful{helpfulCount > 0 ? ` (${helpfulCount})` : ""}</span>
          </button>

          <div style={{ flex: 1 }} />

          <button
            onClick={() => setReporting(true)}
            disabled={!user}
            title={user ? "Report this review" : "Log in to report"}
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              padding: "6px 10px", borderRadius: "8px", cursor: user ? "pointer" : "default",
              background: "transparent", border: "1px solid transparent",
              color: "var(--dd-text4)", fontSize: "0.75rem", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { if (user) { e.currentTarget.style.color = "var(--dd-danger)"; e.currentTarget.style.borderColor = "rgba(185,28,28,0.2)"; } }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text4)"; e.currentTarget.style.borderColor = "transparent"; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3h18v13H3zM12 16v5M8 21h8"/>
            </svg>
            Report
          </button>
        </div>
      </div>
    </>
  );
}
