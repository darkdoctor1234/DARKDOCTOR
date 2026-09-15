"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import UserShell from "@/components/UserShell";
import { profileApi, STATUS_OPTIONS, type StatusValue } from "@/lib/profileApi";
import { collegeApi, type Review } from "@/lib/collegeApi";
import { questionsApi, type Question } from "@/lib/questionsApi";
import { communitiesApi, type MyCommunity } from "@/lib/communitiesApi";
import ReviewCard from "@/components/colleges/ReviewCard";
import { isAuthenticated } from "@/lib/auth";
import { useQuickActions, QuickActionsModals, QuickActionsSidebar, FEED_GRID_CSS } from "@/components/QuickActionsSidebar";

type Tab = "reviews" | "qna" | "discussions";

const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.label]));

function ActivityRow({ q, onClick }: { q: Question; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ padding: "14px 16px", borderRadius: "14px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)", cursor: "pointer" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "4px" }}>
        <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--dd-text1)" }}>{q.title}</span>
        <span style={{ flexShrink: 0, fontSize: "0.72rem", color: "var(--dd-text3)" }}>
          {q.answer_count} {q.answer_count === 1 ? "answer" : "answers"}
        </span>
      </div>
      {q.content && (
        <p style={{ fontSize: "0.8125rem", color: "var(--dd-text2)", margin: "0 0 4px", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {q.content}
        </p>
      )}
      {q.college_name && <div style={{ fontSize: "0.78rem", color: "var(--dd-text3)" }}>{q.college_name}</div>}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [mounted,         setMounted]         = useState(false);
  const [loading,         setLoading]         = useState(true);
  const [fullName,        setFullName]        = useState("");
  const [username,        setUsername]        = useState("");
  const [status,          setStatus]          = useState<StatusValue>("");
  const [pgDepartment,    setPgDepartment]    = useState("");
  const [myReviews,       setMyReviews]       = useState<Review[]>([]);
  const [myQuestions,     setMyQuestions]     = useState<Question[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [myCommunities,      setMyCommunities]      = useState<MyCommunity[]>([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("reviews");
  const { askState, setAskState, reviewTarget, setReviewTarget, checking, checkError, handleAction } = useQuickActions();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated()) { setLoading(false); return; }
    Promise.allSettled([profileApi.get(), collegeApi.myReviews(), questionsApi.mine(), communitiesApi.mine()])
      .then(([profileResult, reviewsResult, questionsResult, communitiesResult]) => {
        if (profileResult.status === "fulfilled") {
          const p = profileResult.value;
          setFullName(p.full_name ?? ""); setUsername(p.username ?? "");
          setStatus((p.current_status as StatusValue) ?? ""); setPgDepartment(p.pg_department ?? "");
        }
        if (reviewsResult.status === "fulfilled")   setMyReviews(reviewsResult.value);
        if (questionsResult.status === "fulfilled") setMyQuestions(questionsResult.value);
        if (communitiesResult.status === "fulfilled") setMyCommunities(communitiesResult.value);
      })
      .finally(() => { setLoading(false); setActivityLoading(false); setCommunitiesLoading(false); });
  }, [mounted]);

  const questionsOnly   = myQuestions.filter((q) => q.kind === "question");
  const discussionsOnly = myQuestions.filter((q) => q.kind === "discussion");

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: "reviews",     label: "Reviews",     count: myReviews.length },
    { id: "qna",         label: "Q&A",         count: questionsOnly.length },
    { id: "discussions", label: "Discussions", count: discussionsOnly.length },
  ];

  /* Guest wall */
  if (mounted && !isAuthenticated()) {
    return (
      <UserShell>
        <div style={{ position: "fixed", top: "-180px", left: "50%", transform: "translateX(-50%)", width: "700px", height: "700px", background: "radial-gradient(circle,rgba(21,128,61,0.05) 0%,transparent 65%)", filter: "blur(60px)", pointerEvents: "none", zIndex: 0 }} />
        <main style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "calc(100svh - 60px - 64px)", padding: "40px 20px" }}>
          <div style={{ width: "100%", maxWidth: "400px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", borderRadius: "24px", padding: "40px 32px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand-icon.png" alt="Darkdoctor" draggable={false} style={{ width: "88px", height: "88px", objectFit: "contain", marginBottom: "22px" }} />
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--dd-text1)", letterSpacing: "-0.03em", marginBottom: "10px" }}>Your Profile</h1>
            <p style={{ fontSize: "0.9rem", color: "var(--dd-text3)", lineHeight: 1.6, marginBottom: "28px", maxWidth: "280px" }}>
              Sign in to manage your profile, track your progress, and connect with the Darkdoctor community.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
              <button onClick={() => router.push("/login")} style={{ padding: "12px", borderRadius: "13px", background: "linear-gradient(135deg,#0d9488 0%,#7c3aed 100%)", border: "none", color: "#fff", fontSize: "0.9375rem", fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 20px rgba(13,148,136,0.24)" }}>Sign In</button>
              <button onClick={() => router.push("/signup")} style={{ padding: "12px", borderRadius: "13px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text1)", fontSize: "0.9375rem", fontWeight: 500, cursor: "pointer" }}>Create Free Account</button>
            </div>
          </div>
        </main>
      </UserShell>
    );
  }

  if (loading) {
    return (
      <UserShell>
        <main style={{ maxWidth: "640px", margin: "0 auto", padding: "52px 20px 80px" }}>
          <div style={{ height: "140px", borderRadius: "20px", background: "var(--dd-surface2)", marginBottom: "20px", animation: "pulse 1.4s ease-in-out infinite" }} />
          <div style={{ height: "44px", borderRadius: "12px", background: "var(--dd-surface2)", marginBottom: "16px", animation: "pulse 1.4s ease-in-out infinite" }} />
          {[1, 2].map((i) => <div key={i} style={{ height: "100px", borderRadius: "16px", background: "var(--dd-surface2)", marginBottom: "12px", animation: "pulse 1.4s ease-in-out infinite" }} />)}
          <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.7} }`}</style>
        </main>
      </UserShell>
    );
  }

  const initials = fullName ? fullName.trim().split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() : null;
  const statusLabel = status ? STATUS_LABEL[status] : null;

  return (
    <UserShell>
      <div style={{ position: "fixed", top: "-180px", left: "50%", transform: "translateX(-50%)", width: "700px", height: "700px", background: "radial-gradient(circle,rgba(21,128,61,0.06) 0%,transparent 65%)", filter: "blur(60px)", pointerEvents: "none", zIndex: 0 }} />

      <main className="feed-main feed-main--wide" style={{ position: "relative", zIndex: 1, padding: "36px 20px 100px" }}>
        <div className="feed-grid">
          <div className="feed-grid-main">

            {/* ── Instagram-style header ── */}
            <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "24px" }}>
              <div style={{ flexShrink: 0, width: "76px", height: "76px", borderRadius: "50%", background: "linear-gradient(135deg,var(--dd-success) 0%,#25a244 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 32px rgba(21,128,61,0.22)", fontSize: "1.7rem", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
                {initials ?? (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: "clamp(1.3rem,4vw,1.55rem)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--dd-text1)", lineHeight: 1.2, marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {fullName || "My Profile"}
                </h1>
                <div style={{ fontSize: "0.875rem", color: "var(--dd-text3)", marginBottom: "8px" }}>
                  {username ? `@${username}` : "No username set"}
                </div>
                {statusLabel && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 11px", borderRadius: "20px", background: "rgba(21,128,61,0.1)", border: "1px solid rgba(21,128,61,0.22)", fontSize: "0.75rem", fontWeight: 500, color: "var(--dd-success)" }}>
                    {statusLabel}{pgDepartment ? ` · ${pgDepartment}` : ""}
                  </span>
                )}
              </div>
              <button
                onClick={() => router.push("/settings")}
                title="Settings"
                aria-label="Settings"
                style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: "38px", height: "38px", borderRadius: "11px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text2)", cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-border)"; e.currentTarget.style.color = "var(--dd-text1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text2)"; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09A1.65 1.65 0 0015 4.6a1.65 1.65 0 001.82.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.14.31.4.56.72.7"/>
                </svg>
              </button>
            </div>

            {/* ── Stats row ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "24px" }}>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{ padding: "12px", borderRadius: "14px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)", cursor: "pointer", textAlign: "center" }}
                >
                  <div className="num" style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--dd-text1)" }}>{t.count}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--dd-text3)", marginTop: "1px" }}>{t.label}</div>
                </button>
              ))}
            </div>

            {/* ── Tab switcher — one consistent active treatment (teal underline) everywhere ── */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--dd-border)", marginBottom: "20px" }}>
              {TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    style={{
                      flex: 1, padding: "10px 8px", background: "none", border: "none", cursor: "pointer",
                      fontSize: "0.875rem", fontWeight: active ? 600 : 500,
                      color: active ? "var(--dd-teal)" : "var(--dd-text3)",
                      borderBottom: active ? "2px solid var(--dd-teal)" : "2px solid transparent",
                      marginBottom: "-1px", transition: "color 0.15s, border-color 0.15s",
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* ── Tab content ── */}
            {tab === "reviews" && (
              activityLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {[1, 2].map((i) => <div key={i} style={{ height: "120px", borderRadius: "16px", background: "var(--dd-surface2)", animation: "pulse 1.4s ease-in-out infinite" }} />)}
                </div>
              ) : myReviews.length === 0 ? (
                <div style={{ padding: "32px", borderRadius: "18px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)", textAlign: "center" }}>
                  <p style={{ color: "var(--dd-text3)", fontSize: "0.875rem" }}>
                    You haven&apos;t written any reviews yet.{" "}
                    <button onClick={() => router.push("/colleges?all=1")} style={{ background: "none", border: "none", color: "var(--dd-teal)", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500 }}>
                      Browse colleges
                    </button>{" "}
                    to share your experience.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {myReviews.map((review) => (
                    <div key={review.id}>
                      <div style={{ marginBottom: "6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <button onClick={() => router.push(`/colleges/${review.college}`)} style={{ background: "none", border: "none", color: "var(--dd-teal)", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", padding: 0 }}>
                          {review.college_name || `College #${review.college}`} →
                        </button>
                        {review.status === "flagged" && <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "8px", background: "rgba(180,83,9,0.1)", border: "1px solid rgba(180,83,9,0.25)", color: "var(--dd-warning)" }}>Under review</span>}
                        {review.status === "removed" && <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "8px", background: "rgba(185,28,28,0.1)", border: "1px solid rgba(185,28,28,0.25)", color: "var(--dd-danger)" }}>Removed</span>}
                      </div>
                      <ReviewCard review={review} />
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === "qna" && (
              activityLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {[1, 2].map((i) => <div key={i} style={{ height: "72px", borderRadius: "14px", background: "var(--dd-surface2)", animation: "pulse 1.4s ease-in-out infinite" }} />)}
                </div>
              ) : questionsOnly.length === 0 ? (
                <div style={{ padding: "32px", borderRadius: "18px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)", textAlign: "center" }}>
                  <p style={{ color: "var(--dd-text3)", fontSize: "0.875rem" }}>No questions asked yet.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {questionsOnly.map((q) => <ActivityRow key={q.id} q={q} onClick={() => router.push(`/colleges/${q.college}/questions/${q.id}`)} />)}
                </div>
              )
            )}

            {tab === "discussions" && (
              activityLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {[1, 2].map((i) => <div key={i} style={{ height: "72px", borderRadius: "14px", background: "var(--dd-surface2)", animation: "pulse 1.4s ease-in-out infinite" }} />)}
                </div>
              ) : discussionsOnly.length === 0 ? (
                <div style={{ padding: "32px", borderRadius: "18px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)", textAlign: "center" }}>
                  <p style={{ color: "var(--dd-text3)", fontSize: "0.875rem" }}>No discussions started yet.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {discussionsOnly.map((q) => <ActivityRow key={q.id} q={q} onClick={() => router.push(`/colleges/${q.college}/questions/${q.id}`)} />)}
                </div>
              )
            )}

          </div>

          <QuickActionsSidebar
            myCommunities={myCommunities}
            communitiesLoading={communitiesLoading}
            checking={checking}
            checkError={checkError}
            onAction={handleAction}
          />
        </div>
      </main>

      <QuickActionsModals askState={askState} setAskState={setAskState} reviewTarget={reviewTarget} setReviewTarget={setReviewTarget} />

      <style>{`
        .feed-main { max-width: 640px; margin: 0 auto; }
        .feed-main.feed-main--wide { max-width: 640px; }
        @media (min-width: 1100px) {
          .feed-main.feed-main--wide { max-width: 1040px; }
        }
        ${FEED_GRID_CSS}
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.7} }
      `}</style>
    </UserShell>
  );
}
