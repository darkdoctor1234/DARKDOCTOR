"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { getUser, isAuthenticated, clearSession, getRefreshToken, getAccessToken, saveSession } from "@/lib/auth";
import { profileApi } from "@/lib/profileApi";
import { authApi } from "@/lib/api";
import { collegeApi, College, SeatEntry, FeeEntry, StipendEntry, Review } from "@/lib/collegeApi";
import CollegeFormModal from "@/components/colleges/CollegeFormModal";
import DeleteCollegeModal from "@/components/colleges/DeleteCollegeModal";
import SeatsBreakdownModal from "@/components/colleges/SeatsBreakdownModal";
import FinanceBreakdownModal from "@/components/colleges/FinanceBreakdownModal";
import ReviewCard from "@/components/colleges/ReviewCard";
import WriteReviewModal from "@/components/colleges/WriteReviewModal";
import QnaBoxes from "@/components/colleges/QnaBoxes";
import AskQuestionModal from "@/components/colleges/AskQuestionModal";
import { questionsApi, type Question, type QuestionKind } from "@/lib/questionsApi";
import { ALL_DEPARTMENTS } from "@/lib/departments";

interface SessionUser { id: number; email: string; full_name: string; role: string; ug_college: number | null; pg_college: number | null; }

function inr(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN");
}

function Chip({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: "100px", background: bg, border: `1px solid ${border}`, color, fontSize: "0.8125rem", fontWeight: 500, letterSpacing: "0.01em", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function InfoCard({ icon, label, value, badge, onClick }: {
  icon: React.ReactNode; label: string; value: string | number; badge?: string; onClick?: () => void;
}) {
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      style={{ padding: "18px 20px", borderRadius: "14px", position: "relative", background: "var(--dd-surface)", border: "1px solid var(--dd-border)", display: "flex", flexDirection: "column", gap: "8px", cursor: clickable ? "pointer" : "default", transition: clickable ? "border-color 0.15s, background 0.15s" : "none", userSelect: "none" }}
      onMouseEnter={(e) => { if (!clickable) return; (e.currentTarget as HTMLElement).style.borderColor = "rgba(13,148,136,0.35)"; (e.currentTarget as HTMLElement).style.background = "rgba(13,148,136,0.035)"; }}
      onMouseLeave={(e) => { if (!clickable) return; (e.currentTarget as HTMLElement).style.borderColor = "var(--dd-border)"; (e.currentTarget as HTMLElement).style.background = "var(--dd-surface)"; }}
    >
      {clickable && (
        <div style={{ position: "absolute", top: "12px", right: "13px", color: "#0d9488", opacity: 0.55 }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="8" cy="8" r="7"/><line x1="8" y1="5.5" x2="8" y2="9.5"/><circle cx="8" cy="11.5" r="0.7" fill="currentColor" stroke="none"/></svg>
        </div>
      )}
      <div style={{ color: "var(--dd-text3)" }}>{icon}</div>
      <div>
        <div style={{ fontSize: "0.75rem", color: "var(--dd-text3)", marginBottom: "3px", letterSpacing: "0.01em" }}>{label}</div>
        <div className="num" style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--dd-text1)" }}>{value}</div>
        {badge && <div style={{ marginTop: "4px", fontSize: "0.72rem", color: "#0d9488", fontWeight: 500, letterSpacing: "0.01em" }}>{badge}</div>}
      </div>
    </div>
  );
}

function RatingMeter({ label, value }: { label: string; value: number }) {
  const pct = (value / 5) * 100;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
      <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "3px" }}>
        <span className="num" style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--dd-text1)" }}>{value.toFixed(1)}</span>
        <span className="num" style={{ fontSize: "0.75rem", color: "var(--dd-text4)" }}>/5</span>
      </div>
      <div style={{ height: "6px", borderRadius: "999px", background: "var(--dd-surface2)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: "999px", background: "var(--dd-teal)" }} />
      </div>
    </div>
  );
}

export default function CollegeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id     = Number(params.id);

  const [user,          setUser]          = useState<SessionUser | null>(null);
  const [college,       setCollege]       = useState<College | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [editOpen,      setEditOpen]      = useState(false);
  const [delOpen,       setDelOpen]       = useState(false);
  const [seatsOpen,     setSeatsOpen]     = useState(false);
  const [feesOpen,      setFeesOpen]      = useState(false);
  const [stipendOpen,   setStipendOpen]   = useState(false);
  const [reviews,       setReviews]       = useState<Review[]>([]);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [reviewOpen,    setReviewOpen]    = useState(false);
  const [deptFilter,    setDeptFilter]    = useState<string>("all");
  const [deptSearch,    setDeptSearch]    = useState<string>("");
  const [questions,       setQuestions]       = useState<Question[]>([]);
  const [questionsLoaded, setQuestionsLoaded] = useState(false);
  const [askOpen,         setAskOpen]         = useState(false);
  const [askKind,         setAskKind]         = useState<QuestionKind>("question");

  useEffect(() => {
    if (!isAuthenticated()) return;
    const session = getUser<SessionUser>();
    if (!session) return;
    setUser(session);
    // If college affiliations are missing from the session (stale token), refresh from API
    if (session.ug_college == null && session.pg_college == null) {
      profileApi.get().then((p) => {
        if (p.ug_college != null || p.pg_college != null) {
          const updated = { ...session, ug_college: p.ug_college, pg_college: p.pg_college };
          setUser(updated);
          const access = getAccessToken(); const refresh = getRefreshToken();
          if (access && refresh) saveSession(access, refresh, updated);
        }
      }).catch(() => { /* silent — don't block the page */ });
    }
  }, []);

  const superAdmin = user?.role === "super_admin";

  const loadCollege = useCallback(async () => {
    setLoading(true); setError(null);
    try { setCollege(await collegeApi.get(id)); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to load."); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { if (id) loadCollege(); }, [id, loadCollege]);

  const loadReviews = useCallback(async () => {
    try { const data = await collegeApi.reviews.list(id); setReviews(data); }
    catch { /* silent */ } finally { setReviewsLoaded(true); }
  }, [id]);

  useEffect(() => { if (id) loadReviews(); }, [id, loadReviews]);

  const loadQuestions = useCallback(async () => {
    try { const data = await questionsApi.listForCollege(id); setQuestions(data); }
    catch { /* silent */ } finally { setQuestionsLoaded(true); }
  }, [id]);

  useEffect(() => { if (id) loadQuestions(); }, [id, loadQuestions]);

  // The public `reviews` list only ever contains VISIBLE reviews, so it can't
  // tell a pending/rejected submission apart from "never reviewed" — fetch the
  // user's own review (any status) separately to drive this card correctly.
  const [myReview, setMyReview] = useState<Review | null>(null);
  const loadMyReview = useCallback(async () => {
    if (!user) { setMyReview(null); return; }
    try {
      const mine = await collegeApi.myReviews();
      setMyReview(mine.find((r) => r.college === id) ?? null);
    } catch { /* silent */ }
  }, [id, user]);
  useEffect(() => { if (id && user) loadMyReview(); }, [id, user, loadMyReview]);

  const userHasReviewed = myReview?.status === "visible";
  const myReviewPending = myReview?.status === "pending";
  const myReviewRejected = myReview?.status === "rejected";

  // User can review only if this college is their UG or PG college
  const canReview = user && !superAdmin && (
    user.ug_college === id || user.pg_college === id
  );

  async function handleLogout() {
    try { await authApi.logout(getRefreshToken()!, getAccessToken()!); } catch { /* ok */ }
    finally { clearSession(); router.replace("/"); }
  }

  function handleSeatsUpdated(newEntries: SeatEntry[]) {
    setCollege((prev) => prev ? { ...prev, seat_entries: newEntries } : prev);
  }
  function handleFeesUpdated(newEntries: FeeEntry[] | StipendEntry[]) {
    setCollege((prev) => prev ? { ...prev, fee_entries: newEntries as FeeEntry[] } : prev);
  }
  function handleStipendUpdated(newEntries: FeeEntry[] | StipendEntry[]) {
    setCollege((prev) => prev ? { ...prev, stipend_entries: newEntries as StipendEntry[] } : prev);
  }

  const isGovt      = college?.college_type === "govt";
  const accentColor = isGovt ? "#0d9488" : "#7c3aed";
  const accentGlow  = isGovt ? "rgba(13,148,136,0.2)" : "rgba(124,58,237,0.2)";

  const seatEntries = college?.seat_entries ?? [];
  const seatBadge   = seatEntries.length > 0 ? `${seatEntries.length} program${seatEntries.length !== 1 ? "s" : ""} · tap for breakdown` : superAdmin ? "tap to add breakdown" : undefined;

  const feeEntries = college?.fee_entries ?? [];
  const feeTotal   = feeEntries.reduce((s, e) => s + e.amount, 0);
  const feeValue   = feeTotal > 0 ? inr(feeTotal) : "-";
  const feeBadge   = feeEntries.length > 0 ? `${feeEntries.length} program${feeEntries.length !== 1 ? "s" : ""} · tap for breakdown` : superAdmin ? "tap to add breakdown" : undefined;

  const stipendEntries = college?.stipend_entries ?? [];
  const stipendTotal   = stipendEntries.reduce((s, e) => s + e.amount, 0);
  const stipendValue   = stipendTotal > 0 ? inr(stipendTotal) : "-";
  const stipendBadge   = stipendEntries.length > 0 ? `${stipendEntries.length} program${stipendEntries.length !== 1 ? "s" : ""} · tap for breakdown` : superAdmin ? "tap to add breakdown" : undefined;

  // Aggregate rating meters — averaged live from every visible review, not editorial figures
  const RATING_KEYS = ["rating_infrastructure", "rating_clinical", "rating_hostel", "rating_administration", "rating_overall"] as const;
  const ratingAverages = RATING_KEYS.map((key) => ({
    key, label: key === "rating_infrastructure" ? "Infrastructure" : key === "rating_clinical" ? "Clinical Exposure" : key === "rating_hostel" ? "Hostel & Campus" : key === "rating_administration" ? "Administration" : "Overall Experience",
    value: reviews.length ? reviews.reduce((s, r) => s + r[key], 0) / reviews.length : 0,
  }));

  return (
    <div style={{ minHeight: "100vh", background: "var(--dd-bg)", color: "var(--dd-text1)" }}>

      {/* Navbar */}
      <nav style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--dd-nav-bg)", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)", borderBottom: "1px solid var(--dd-border)", padding: "0 24px", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button onClick={() => router.push("/colleges?all=1")} title="Browse all colleges" style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "var(--dd-text2)", cursor: "pointer", fontSize: "0.875rem", padding: "6px 10px", borderRadius: "8px", transition: "all 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--dd-text2)"; }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 12L6 8l4-4"/></svg>
            Colleges
          </button>
          <span style={{ color: "var(--dd-border2)" }}>/</span>
          <span style={{ fontSize: "0.875rem", color: "var(--dd-text3)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{college?.name ?? "Loading…"}</span>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {superAdmin && college && (
            <>
              <button onClick={() => setEditOpen(true)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", background: "rgba(13,148,136,0.1)", border: "1px solid rgba(13,148,136,0.22)", color: "#0d9488", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(13,148,136,0.18)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(13,148,136,0.1)"; }}>
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13.586 3.586a2 2 0 112.828 2.828l-9 9L3 17l1.586-4.414 9-9z"/></svg>
                Edit
              </button>
              <button onClick={() => setDelOpen(true)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", background: "rgba(185,28,28,0.08)", border: "1px solid rgba(185,28,28,0.2)", color: "var(--dd-danger)", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(185,28,28,0.16)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(185,28,28,0.08)"; }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,4 14,4"/><path d="M5 4V2h6v2"/><path d="M3 4l1 10h8l1-10"/></svg>
                Delete
              </button>
            </>
          )}
          {user && (
            <button onClick={handleLogout} style={{ padding: "7px 14px", borderRadius: "8px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text2)", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-border)"; e.currentTarget.style.color = "var(--dd-text1)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text2)"; }}>
              Sign Out
            </button>
          )}
        </div>
      </nav>

      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 20px 80px" }}>
        {loading && <div style={{ padding: "80px", textAlign: "center", color: "var(--dd-text3)" }}>Loading college…</div>}

        {!loading && error && (
          <div style={{ padding: "60px", textAlign: "center" }}>
            <p style={{ color: "var(--dd-danger)", marginBottom: "12px" }}>{error}</p>
            <button onClick={() => router.push("/colleges?all=1")} style={{ padding: "8px 16px", borderRadius: "8px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text2)", cursor: "pointer" }}>Back to Colleges</button>
          </div>
        )}

        {!loading && college && (
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>

            {/* Hero */}
            <div style={{ position: "relative", overflow: "hidden", borderRadius: "24px", background: `linear-gradient(135deg, ${accentColor}0f 0%, transparent 60%)`, border: "1px solid var(--dd-border2)", padding: "clamp(28px,5vw,44px)" }}>
              <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "280px", height: "280px", background: `radial-gradient(circle, ${accentGlow} 0%, transparent 70%)`, filter: "blur(40px)", pointerEvents: "none" }} />
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
                  <Chip label={isGovt ? "Government" : "Private"} color={accentColor} bg={`${accentColor}18`} border={`${accentColor}30`} />
                </div>
                <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)", fontWeight: 700, letterSpacing: "-0.04em", color: "var(--dd-text1)", marginBottom: "10px", lineHeight: 1.2 }}>
                  {college.name}
                </h1>
                <a
                  href={college.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(college.name + (college.state ? `, ${college.state}` : ""))}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--dd-text2)", fontSize: "0.9375rem", textDecoration: "none", transition: "color 0.15s", width: "fit-content" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#0d9488"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text2)"; }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M8 14S3 9.5 3 6a5 5 0 0110 0c0 3.5-5 8-5 8z"/><circle cx="8" cy="6" r="1.5"/></svg>
                  {college.state || college.location}
                </a>
                {college.university && (
                  <p style={{ marginTop: "8px", fontSize: "0.875rem", color: "var(--dd-text3)", display: "flex", alignItems: "center", gap: "5px" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
                    {college.university}
                  </p>
                )}
                {college.website_url && (
                  <a href={college.website_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                    style={{ marginTop: "10px", display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 14px", borderRadius: "8px", background: "rgba(13,148,136,0.08)", border: "1px solid rgba(13,148,136,0.22)", color: "#0d9488", fontSize: "0.8125rem", fontWeight: 500, textDecoration: "none", transition: "background 0.15s", width: "fit-content" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(13,148,136,0.16)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(13,148,136,0.08)"; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>
                    Visit official website
                  </a>
                )}
              </div>
            </div>

            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
              <InfoCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} label="Established" value={college.established_year} />
              <InfoCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} label="Type" value={isGovt ? "Government" : "Private"} />
              <InfoCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>} label="Intake Seats" value={college.intake_seats.toLocaleString()} badge={seatBadge} onClick={() => setSeatsOpen(true)} />
              <InfoCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M1 10h2M21 10h2M1 14h2M21 14h2"/></svg>} label="Fee" value={feeValue} badge={feeBadge} onClick={() => setFeesOpen(true)} />
              <InfoCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>} label="Stipend" value={stipendValue} badge={stipendBadge} onClick={() => setStipendOpen(true)} />
            </div>

            {/* Clinical Ratings — live average across visible reviews */}
            {reviewsLoaded && reviews.length > 0 && (
              <div style={{ borderRadius: "18px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)", padding: "24px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--dd-text1)", letterSpacing: "-0.02em", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" style={{ color: "var(--dd-text3)" }}><path d="M3 12h4l2.2 6.5L12 4l2.4 8H16l1.6-3H22"/></svg>
                    Clinical Ratings
                  </h2>
                  <span style={{ fontSize: "0.75rem", color: "var(--dd-text4)" }}>averaged across {reviews.length} review{reviews.length !== 1 ? "s" : ""}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "20px 16px" }}>
                  {ratingAverages.map((r) => <RatingMeter key={r.key} label={r.label} value={r.value} />)}
                </div>
              </div>
            )}

            {/* About */}
            {college.about && (
              <div style={{ borderRadius: "18px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)", padding: "24px" }}>
                <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--dd-text1)", letterSpacing: "-0.02em", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" style={{ color: "var(--dd-text3)" }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/></svg>
                  About
                </h2>
                <p style={{ fontSize: "0.9rem", color: "var(--dd-text2)", lineHeight: 1.75, whiteSpace: "pre-line", margin: 0 }}>
                  {college.about}
                </p>
              </div>
            )}

            {/* Q&A — Questions / Discussions / Unanswered */}
            <div style={{ borderRadius: "18px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)", padding: "24px" }}>
              <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--dd-text1)", letterSpacing: "-0.02em", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" style={{ color: "var(--dd-text3)" }}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 2-3 4"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></svg>
                Questions &amp; Discussions
              </h2>
              <QnaBoxes questions={questions} loading={!questionsLoaded} showAsker onItemClick={(q) => router.push(`/colleges/${id}/questions/${q.id}`)} />
            </div>

            {/* Ask a Question / Start a Discussion / Write a Review */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
              <div style={{ padding: "20px", borderRadius: "18px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)" }}>
                <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--dd-text1)", marginBottom: "6px" }}>Ask a Question</div>
                <p style={{ fontSize: "0.8125rem", color: "var(--dd-text3)", marginBottom: "14px", lineHeight: 1.5 }}>
                  Get answers from students and alumni of {college.name}.
                </p>
                {user ? (
                  <button
                    onClick={() => { setAskKind("question"); setAskOpen(true); }}
                    style={{ padding: "9px 18px", borderRadius: "10px", background: "linear-gradient(135deg,#0d9488,#0f766e)", border: "none", color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 16px rgba(13,148,136,0.25)" }}
                  >
                    Ask a Question
                  </button>
                ) : (
                  <span style={{ fontSize: "0.8125rem", color: "var(--dd-text3)" }}>
                    <a href="/login" style={{ color: "#0d9488", textDecoration: "none" }}>Sign in</a> to ask a question
                  </span>
                )}
              </div>

              <div style={{ padding: "20px", borderRadius: "18px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)" }}>
                <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--dd-text1)", marginBottom: "6px" }}>Start a Discussion</div>
                <p style={{ fontSize: "0.8125rem", color: "var(--dd-text3)", marginBottom: "14px", lineHeight: 1.5 }}>
                  Open up a general conversation about {college.name}.
                </p>
                {user ? (
                  <button
                    onClick={() => { setAskKind("discussion"); setAskOpen(true); }}
                    style={{ padding: "9px 18px", borderRadius: "10px", background: "linear-gradient(135deg,#7c3aed,#4b49c9)", border: "none", color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 16px rgba(124,58,237,0.25)" }}
                  >
                    Start a Discussion
                  </button>
                ) : (
                  <span style={{ fontSize: "0.8125rem", color: "var(--dd-text3)" }}>
                    <a href="/login" style={{ color: "#0d9488", textDecoration: "none" }}>Sign in</a> to start a discussion
                  </span>
                )}
              </div>

              <div style={{ padding: "20px", borderRadius: "18px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)" }}>
                <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--dd-text1)", marginBottom: "6px" }}>Write a Review</div>
                {!user && (
                  <>
                    <p style={{ fontSize: "0.8125rem", color: "var(--dd-text3)", marginBottom: "14px", lineHeight: 1.5 }}>Sign in to share your experience.</p>
                    <a href="/login" style={{ display: "inline-block", padding: "9px 18px", borderRadius: "10px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text2)", fontSize: "0.875rem", fontWeight: 500, textDecoration: "none" }}>Sign In</a>
                  </>
                )}
                {user && canReview && !userHasReviewed && !myReviewPending && !myReviewRejected && (
                  <>
                    <p style={{ fontSize: "0.8125rem", color: "var(--dd-text3)", marginBottom: "14px", lineHeight: 1.5 }}>Share your experience at this college.</p>
                    <button
                      onClick={() => setReviewOpen(true)}
                      style={{ padding: "9px 18px", borderRadius: "10px", background: "linear-gradient(135deg,#15803d,#0f6b32)", border: "none", color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 16px rgba(21,128,61,0.25)" }}
                    >
                      Write a Review
                    </button>
                  </>
                )}
                {user && canReview && myReviewPending && (
                  <p style={{ fontSize: "0.8125rem", color: "var(--dd-warning)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    Your review is awaiting admin approval.
                  </p>
                )}
                {user && canReview && myReviewRejected && (
                  <>
                    <p style={{ fontSize: "0.8125rem", color: "var(--dd-danger)", marginBottom: "10px", lineHeight: 1.5 }}>Your review was rejected: {myReview?.rejection_reason}</p>
                    <button
                      onClick={() => setReviewOpen(true)}
                      style={{ padding: "9px 18px", borderRadius: "10px", background: "linear-gradient(135deg,#15803d,#0f6b32)", border: "none", color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 16px rgba(21,128,61,0.25)" }}
                    >
                      Edit & Resubmit
                    </button>
                  </>
                )}
                {user && canReview && userHasReviewed && (
                  <p style={{ fontSize: "0.8125rem", color: "var(--dd-success)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    You&apos;ve already reviewed this college.
                  </p>
                )}
                {user && !canReview && (
                  <p style={{ fontSize: "0.8125rem", color: "var(--dd-text3)", lineHeight: 1.5 }}>
                    Only students affiliated with this college (via your profile) can write a review.
                  </p>
                )}
              </div>
            </div>

            {/* Reviews */}
            <div id="reviews-section" style={{ borderRadius: "18px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)", padding: "24px" }}>
              {/* Header row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
                <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--dd-text1)", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" style={{ color: "var(--dd-text3)" }}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                  Reviews
                  {reviews.length > 0 && (
                    <span style={{ fontSize: "0.75rem", padding: "1px 8px", borderRadius: "20px", background: "var(--dd-surface2)", color: "var(--dd-text3)", fontWeight: 400 }}>{reviews.length}</span>
                  )}
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  {/* Dept dropdown filter */}
                  {college.departments.length > 0 && (
                    <div style={{ position: "relative" }}>
                      <select
                        id="college-department-filter" name="department-filter"
                        value={deptFilter}
                        onChange={(e) => setDeptFilter(e.target.value)}
                        style={{ appearance: "none", WebkitAppearance: "none", padding: "7px 32px 7px 12px", borderRadius: "10px", background: "var(--dd-input-bg)", border: `1px solid ${deptFilter !== "all" ? "rgba(124,58,237,0.45)" : "var(--dd-border2)"}`, color: deptFilter !== "all" ? "#7c3aed" : "var(--dd-text2)", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", outline: "none", minWidth: "160px" }}
                      >
                        <option value="all">All Departments ({reviews.length})</option>
                        {college.departments.map((d) => {
                          const count = reviews.filter((r) => r.department === d.name).length;
                          return (
                            <option key={d.id} value={d.name}>
                              {d.name}{count > 0 ? ` (${count})` : ""}
                            </option>
                          );
                        })}
                      </select>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--dd-text3)", pointerEvents: "none" }}><path d="M4 6l4 4 4-4"/></svg>
                    </div>
                  )}
                  {canReview && !userHasReviewed && !myReviewPending && !myReviewRejected && (
                    <button onClick={() => setReviewOpen(true)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "10px", background: "linear-gradient(135deg,#0d9488,#0f766e)", border: "none", color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 16px rgba(13,148,136,0.25)", transition: "opacity 0.15s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Write a Review
                    </button>
                  )}
                  {canReview && myReviewPending && (
                    <span style={{ fontSize: "0.8125rem", color: "var(--dd-warning)", display: "flex", alignItems: "center", gap: "5px" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                      Pending approval
                    </span>
                  )}
                  {canReview && myReviewRejected && (
                    <button onClick={() => setReviewOpen(true)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "10px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", color: "var(--dd-danger)", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>
                      Edit & Resubmit
                    </button>
                  )}
                  {canReview && userHasReviewed && (
                    <span style={{ fontSize: "0.8125rem", color: "var(--dd-success)", display: "flex", alignItems: "center", gap: "5px" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      You reviewed this college
                    </span>
                  )}
                  {user && !canReview && (
                    <span style={{ fontSize: "0.8125rem", color: "var(--dd-text3)" }}>
                      Only students of this college can review it
                    </span>
                  )}
                  {!user && (
                    <span style={{ fontSize: "0.8125rem", color: "var(--dd-text3)" }}>
                      <a href="/login" style={{ color: "#0d9488", textDecoration: "none" }}>Sign in</a> to write a review
                    </span>
                  )}
                </div>
              </div>

              {!reviewsLoaded ? (
                <p style={{ color: "var(--dd-text4)", fontSize: "0.875rem", textAlign: "center", padding: "20px 0" }}>Loading reviews…</p>
              ) : reviews.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ color: "var(--dd-text4)", marginBottom: "10px", display: "flex", justifyContent: "center" }}>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>
                      <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
                    </svg>
                  </div>
                  <p style={{ color: "var(--dd-text3)", fontSize: "0.9rem" }}>No reviews yet. Be the first to share your experience!</p>
                </div>
              ) : (() => {
                const filtered = deptFilter === "all" ? reviews : reviews.filter((r) => r.department === deptFilter);
                return filtered.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 0", color: "var(--dd-text4)", fontSize: "0.875rem" }}>
                    No reviews for this department yet.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {filtered.map((review) => <ReviewCard key={review.id} review={review} onReport={loadReviews} />)}
                  </div>
                );
              })()}
            </div>

          </div>
        )}
      </main>

      {college && (
        <>
          <CollegeFormModal open={editOpen} onClose={() => setEditOpen(false)} initial={college} onSaved={(updated) => { setCollege(updated); setEditOpen(false); }} />
          <DeleteCollegeModal college={delOpen ? college : null} onClose={() => setDelOpen(false)} onDeleted={() => router.push("/colleges?all=1")} />
          {seatsOpen && <SeatsBreakdownModal college={college} isSuperAdmin={superAdmin} onUpdate={handleSeatsUpdated} onClose={() => setSeatsOpen(false)} />}
          {feesOpen && <FinanceBreakdownModal kind="fee" college={college} isSuperAdmin={superAdmin} onUpdate={handleFeesUpdated} onClose={() => setFeesOpen(false)} />}
          {stipendOpen && <FinanceBreakdownModal kind="stipend" college={college} isSuperAdmin={superAdmin} onUpdate={handleStipendUpdated} onClose={() => setStipendOpen(false)} />}
          {reviewOpen && <WriteReviewModal collegeId={college.id} collegeName={college.name} onClose={() => setReviewOpen(false)} onSubmitted={() => { setReviewOpen(false); loadReviews(); loadMyReview(); }} />}
          {askOpen && (
            <AskQuestionModal
              lockedCollege={{ id: college.id, name: college.name }}
              initialKind={askKind}
              onClose={() => setAskOpen(false)}
              onSubmitted={(q) => { setQuestions((prev) => [q, ...prev]); setAskOpen(false); }}
            />
          )}
        </>
      )}
    </div>
  );
}
