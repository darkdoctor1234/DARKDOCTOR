"use client";

import { useState, useRef, useEffect } from "react";
import { collegeApi, ReviewPayload, Review } from "@/lib/collegeApi";
import { profileApi } from "@/lib/profileApi";
import { DEPARTMENT_GROUPS } from "@/lib/departments";

function DeptSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  const filtered = DEPARTMENT_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => item.toLowerCase().includes(search.toLowerCase())),
  })).filter((g) => g.items.length > 0);

  const label = value || "Select department…";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          ...inputStyle,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{ color: value ? "var(--dd-text1)" : "var(--dd-text4)", fontSize: "0.9rem" }}>{label}</span>
        <svg
          width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="var(--dd-text3)" strokeWidth="2" strokeLinecap="round"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 500,
          background: "var(--dd-bg2)", border: "1px solid var(--dd-border2)",
          borderRadius: "12px", boxShadow: "var(--dd-shadow-lg)",
          maxHeight: "280px", display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* Search */}
          <div style={{ padding: "10px 10px 6px", borderBottom: "1px solid var(--dd-border)" }}>
            <input
              id="review-department-search" name="department-search"
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search department…"
              style={{
                width: "100%", padding: "7px 10px", borderRadius: "8px",
                background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)",
                color: "var(--dd-text1)", fontSize: "0.8125rem", outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Grouped list */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtered.length === 0 ? (
              <p style={{ padding: "14px", color: "var(--dd-text4)", fontSize: "0.8125rem", textAlign: "center" }}>No match</p>
            ) : filtered.map((group) => (
              <div key={group.group}>
                <div style={{
                  padding: "7px 14px 4px", fontSize: "0.68rem", fontWeight: 700,
                  color: "var(--dd-text4)", letterSpacing: "0.08em", textTransform: "uppercase",
                  background: "var(--dd-surface)",
                }}>
                  {group.group}
                </div>
                {group.items.map((item) => {
                  const selected = value === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => { onChange(item); setOpen(false); setSearch(""); }}
                      style={{
                        width: "100%", padding: "9px 14px 9px 22px", textAlign: "left",
                        background: selected ? "var(--dd-teal-bg2)" : "none",
                        border: "none", color: selected ? "var(--dd-teal-hover)" : "var(--dd-text2)",
                        fontSize: "0.875rem", cursor: "pointer", transition: "background 0.1s",
                        display: "flex", alignItems: "center", gap: "8px",
                      }}
                      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = "var(--dd-surface2)"; }}
                      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = "none"; }}
                    >
                      {selected && <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="var(--dd-teal)" strokeWidth="2.5" strokeLinecap="round"><path d="M3 8l4 4 6-7"/></svg>}
                      {item}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  collegeId: number;
  collegeName: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const RATING_CATEGORIES = [
  { key: "rating_infrastructure",  label: "Infrastructure"    },
  { key: "rating_clinical",        label: "Clinical Exposure" },
  { key: "rating_hostel",          label: "Hostel & Mess"     },
  { key: "rating_administration",  label: "Administration"    },
  { key: "rating_overall",         label: "Overall Experience"},
] as const;

type RatingKey = (typeof RATING_CATEGORIES)[number]["key"];

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display: "flex", gap: "4px" }}>
      {[1,2,3,4,5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", fontSize: "22px", lineHeight: 1, transition: "transform 0.1s" }}
        >
          <span style={{ color: star <= (hovered || value) ? "#b45309" : "var(--dd-border2)", transition: "color 0.15s" }}>★</span>
        </button>
      ))}
    </div>
  );
}

/** Reviewer identity is derived from the signed-in user's profile — not re-asked per review. */
type ReviewerRole = "student" | "alumni";

const ROLE_META: Record<ReviewerRole, { label: string; icon: React.ReactNode }> = {
  student: {
    label: "Current Student",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
      </svg>
    ),
  },
  alumni: {
    label: "Alumni",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
      </svg>
    ),
  },
};

function deriveRole(status: string): ReviewerRole | null {
  if (status === "ug_student" || status === "pg_student") return "student";
  if (status === "alumni") return "alumni";
  return null;
}

export default function WriteReviewModal({ collegeId, collegeName, onClose, onSubmitted }: Props) {
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [role,           setRole]           = useState<ReviewerRole | null>(null);
  const [batchYear,       setBatchYear]      = useState("");

  const [scope,      setScope]      = useState<"college" | "department">("college");
  const [dept,        setDept]        = useState("");
  const [title,      setTitle]      = useState("");
  const [content,    setContent]    = useState("");
  const [ratings,    setRatings]    = useState<Record<RatingKey, number>>({
    rating_infrastructure: 0,
    rating_clinical:       0,
    rating_hostel:         0,
    rating_administration: 0,
    rating_overall:        0,
  });
  const [images,     setImages]     = useState<File[]>([]);
  const [previews,   setPreviews]   = useState<string[]>([]);
  const [consent,    setConsent]    = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Non-editable states for an already-existing review on this college —
  // "pending"/"visible" just show a message; "rejected" pre-fills the form
  // below into an edit-and-resubmit flow instead of a fresh submission.
  const [existingReview, setExistingReview] = useState<Review | null>(null);

  useEffect(() => {
    Promise.all([
      profileApi.get(),
      collegeApi.myReviews().catch(() => []),
    ])
      .then(([p, myReviews]) => {
        setRole(deriveRole(p.current_status));
        setBatchYear(p.batch || "");

        const existing = myReviews.find((r) => r.college === collegeId) ?? null;
        setExistingReview(existing);
        if (existing?.status === "rejected") {
          setScope(existing.department ? "department" : "college");
          setDept(existing.department);
          setTitle(existing.title);
          setContent(existing.content);
          setRatings({
            rating_infrastructure: existing.rating_infrastructure,
            rating_clinical:       existing.rating_clinical,
            rating_hostel:         existing.rating_hostel,
            rating_administration: existing.rating_administration,
            rating_overall:        existing.rating_overall,
          });
        }
      })
      .catch(() => setRole(null))
      .finally(() => setLoadingProfile(false));
  }, [collegeId]);

  const isResubmit = existingReview?.status === "rejected";

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const combined = [...images, ...files].slice(0, 2);
    setImages(combined);
    setPreviews(combined.map((f) => URL.createObjectURL(f)));
    e.target.value = "";
  }

  function removeImage(idx: number) {
    const newImgs = images.filter((_, i) => i !== idx);
    const newPrev = previews.filter((_, i) => i !== idx);
    setImages(newImgs);
    setPreviews(newPrev);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!role) return setError("Please complete your profile status before writing a review.");
    if (scope === "department" && !dept) return setError("Please select a department, or switch to Whole College.");
    if (!title.trim())   return setError("Please enter a title.");
    if (!content.trim()) return setError("Please write your review.");
    for (const cat of RATING_CATEGORIES) {
      if (!ratings[cat.key]) return setError(`Please rate ${cat.label}.`);
    }
    if (!consent) return setError("Please confirm the reviewer agreement before submitting.");

    setSubmitting(true);
    try {
      const payload: ReviewPayload = {
        role, department: scope === "department" ? dept : "", batch_year: batchYear,
        title: title.trim(), content, ...ratings,
        images: images.length > 0 ? images : undefined,
      };
      if (isResubmit && existingReview) {
        await collegeApi.reviews.resubmit(existingReview.id, payload);
      } else {
        await collegeApi.reviews.create(collegeId, payload);
      }
      onSubmitted();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px",
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--dd-bg2)", borderRadius: "22px",
        border: "1px solid var(--dd-border)",
        width: "100%", maxWidth: "580px",
        maxHeight: "90vh", overflowY: "auto",
        padding: "28px",
        boxShadow: "var(--dd-shadow-lg)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "22px" }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.2rem", fontWeight: 600, color: "var(--dd-text1)", letterSpacing: "-0.01em", marginBottom: "4px" }}>
              {isResubmit ? "Resubmit Your Review" : "Write a Review"}
            </h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--dd-text3)" }}>{collegeName}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dd-text3)", padding: "4px" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-text1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)"; }}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8"/>
            </svg>
          </button>
        </div>

        {loadingProfile ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--dd-text3)", fontSize: "0.875rem" }}>
            Loading…
          </div>
        ) : existingReview && existingReview.status === "pending" ? (
          <div style={{ textAlign: "center", padding: "12px 0 4px" }}>
            <div style={{ color: "var(--dd-warning)", marginBottom: "14px", display: "flex", justifyContent: "center" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <p style={{ color: "var(--dd-text2)", fontSize: "0.9rem", lineHeight: 1.6 }}>
              Your review for this college is awaiting admin approval. You&apos;ll be able to see it here once it&apos;s reviewed.
            </p>
          </div>
        ) : existingReview && existingReview.status === "visible" ? (
          <div style={{ textAlign: "center", padding: "12px 0 4px" }}>
            <p style={{ color: "var(--dd-text2)", fontSize: "0.9rem", lineHeight: 1.6 }}>
              You&apos;ve already submitted a review for this college.
            </p>
          </div>
        ) : !role ? (
          <div style={{ textAlign: "center", padding: "12px 0 4px" }}>
            <p style={{ color: "var(--dd-text2)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "20px" }}>
              To write a review, set your current status to <strong style={{ color: "var(--dd-text1)" }}>Student</strong> or{" "}
              <strong style={{ color: "var(--dd-text1)" }}>Alumni</strong> in your profile first.
            </p>
            <a
              href="/profile"
              style={{ display: "inline-block", padding: "11px 24px", borderRadius: "12px", background: "linear-gradient(135deg,var(--dd-teal),var(--dd-teal-hover))", color: "#fff", fontSize: "0.9rem", fontWeight: 600, textDecoration: "none", boxShadow: "0 4px 20px var(--dd-teal-border)" }}
            >
              Go to Profile
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

            {/* Rejection reason — only shown when editing a rejected review */}
            {isResubmit && existingReview?.rejection_reason && (
              <div style={{ padding: "12px 14px", borderRadius: "10px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)" }}>
                <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--dd-danger)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "4px" }}>
                  Rejected by admin
                </p>
                <p style={{ fontSize: "0.8125rem", color: "var(--dd-text2)", lineHeight: 1.5 }}>{existingReview.rejection_reason}</p>
              </div>
            )}

            {/* Reviewer identity — derived from profile, not re-asked */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "11px 14px", borderRadius: "10px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)" }}>
              <span style={{ color: "var(--dd-text2)", lineHeight: 1, display: "flex" }}>{ROLE_META[role].icon}</span>
              <span style={{ fontSize: "0.8125rem", color: "var(--dd-text2)" }}>
                Reviewing as <strong style={{ color: "var(--dd-text1)" }}>{ROLE_META[role].label}</strong>
                {batchYear && <> · Batch <span className="num">{batchYear}</span></>}
              </span>
            </div>

            {/* What are you reviewing? */}
            <div>
              <label style={labelStyle}>What are you reviewing?</label>
              <div style={{ display: "flex", gap: "8px", marginBottom: scope === "department" ? "12px" : 0 }}>
                {([
                  { value: "college" as const,    label: "Whole College" },
                  { value: "department" as const, label: "Specific Department" },
                ]).map((opt) => (
                  <button key={opt.value} type="button" onClick={() => { setScope(opt.value); if (opt.value === "college") setDept(""); }}
                    style={{
                      flex: 1, padding: "9px 14px", borderRadius: "10px", cursor: "pointer",
                      fontSize: "0.875rem", fontWeight: 500, transition: "all 0.15s",
                      background: scope === opt.value ? "var(--dd-teal-bg2)" : "var(--dd-surface)",
                      border: `1px solid ${scope === opt.value ? "var(--dd-teal-border)" : "var(--dd-border2)"}`,
                      color: scope === opt.value ? "var(--dd-teal-hover)" : "var(--dd-text2)",
                    }}
                  >{opt.label}</button>
                ))}
              </div>
              {scope === "department" && <DeptSelect value={dept} onChange={setDept} />}
            </div>

            {/* Title */}
            <div>
              <label style={labelStyle}>Review Title</label>
              <input id="review-title" name="title" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Great clinical exposure, average hostel"
                style={inputStyle}
              />
            </div>

            {/* Content */}
            <div>
              <label style={labelStyle}>Your Review *</label>
              <textarea
                id="review-content" name="content"
                value={content} onChange={(e) => setContent(e.target.value)}
                placeholder="Share your honest experience about this college..."
                rows={5}
                style={{ ...inputStyle, resize: "vertical", minHeight: "110px" }}
              />
            </div>

            {/* Ratings */}
            <div>
              <label style={labelStyle}>Ratings *</label>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "14px 16px", borderRadius: "12px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)" }}>
                {RATING_CATEGORIES.map((cat) => (
                  <div key={cat.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                    <span style={{ fontSize: "0.875rem", color: "var(--dd-text2)", minWidth: "140px" }}>{cat.label}</span>
                    <StarRating value={ratings[cat.key]} onChange={(v) => setRatings((r) => ({ ...r, [cat.key]: v }))} />
                  </div>
                ))}
              </div>
            </div>

            {/* Image upload */}
            <div>
              <label style={labelStyle}>Photos (up to 2)</label>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                {previews.map((src, idx) => (
                  <div key={idx} style={{ position: "relative", width: "80px", height: "80px" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "10px", border: "1px solid var(--dd-border2)" }} />
                    <button type="button" onClick={() => removeImage(idx)}
                      style={{ position: "absolute", top: "-6px", right: "-6px", width: "20px", height: "20px", borderRadius: "50%", background: "var(--dd-danger)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "11px", fontWeight: 700 }}
                    >✕</button>
                  </div>
                ))}
                {images.length < 2 && (
                  <button type="button" onClick={() => fileRef.current?.click()}
                    style={{
                      width: "80px", height: "80px", borderRadius: "10px",
                      border: "1px dashed var(--dd-border2)",
                      background: "var(--dd-surface)",
                      cursor: "pointer", display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center", gap: "4px",
                      color: "var(--dd-text3)", fontSize: "0.7rem", transition: "border-color 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--dd-teal-border)"; e.currentTarget.style.color = "var(--dd-teal)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--dd-border2)"; e.currentTarget.style.color = "var(--dd-text3)"; }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Add photo
                  </button>
                )}
                <input id="review-images" name="images" ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleImageChange} />
              </div>
            </div>

            {/* Reviewer consent */}
            <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px 14px", borderRadius: "10px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)", cursor: "pointer" }}>
              <input
                id="review-consent" name="consent"
                type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
                style={{ marginTop: "2px", width: "16px", height: "16px", flexShrink: 0, accentColor: "var(--dd-teal)", cursor: "pointer" }}
              />
              <span style={{ fontSize: "0.78125rem", color: "var(--dd-text2)", lineHeight: 1.55 }}>
                I confirm this review reflects my genuine experience, contains no personal attacks or names of individuals, and I take responsibility for its accuracy.
                Your identity stays private to other users. Only Darkdoctor retains it for accountability.
              </span>
            </label>

            {/* Error */}
            {error && (
              <div style={{ padding: "10px 14px", borderRadius: "10px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", color: "var(--dd-danger)", fontSize: "0.8125rem" }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={submitting || !consent}
              style={{
                padding: "13px", borderRadius: "12px",
                background: submitting || !consent ? "var(--dd-border2)" : "linear-gradient(135deg,var(--dd-teal),var(--dd-teal-hover))",
                border: "none", color: submitting || !consent ? "var(--dd-text4)" : "#fff", fontSize: "0.9375rem", fontWeight: 600,
                cursor: submitting || !consent ? "not-allowed" : "pointer",
                boxShadow: consent ? "0 4px 20px var(--dd-teal-border)" : "none",
                transition: "opacity 0.15s",
              }}
            >
              {submitting ? "Submitting…" : isResubmit ? "Resubmit Review" : "Submit Review"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.75rem", fontWeight: 600,
  color: "var(--dd-text3)", letterSpacing: "0.06em", textTransform: "uppercase",
  marginBottom: "8px",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 13px", borderRadius: "10px",
  background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)",
  color: "var(--dd-text1)", fontSize: "0.9rem", outline: "none",
  boxSizing: "border-box", transition: "border-color 0.15s",
};
