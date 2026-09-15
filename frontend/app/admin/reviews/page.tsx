"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getUser, clearSession, getRefreshToken, getAccessToken, isAuthenticated } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { collegeApi, Review } from "@/lib/collegeApi";
import AdminReviewCard from "@/components/colleges/AdminReviewCard";

type Tab = "pending" | "reported";

const TAB_META: Record<Tab, { label: string; empty: string; emptyDesc: string }> = {
  pending:  { label: "Pending",  empty: "All caught up", emptyDesc: "No reviews awaiting approval." },
  reported: { label: "Reported", empty: "All clear",     emptyDesc: "No flagged reviews at the moment." },
};

export default function AdminReviewsPage() {
  const router = useRouter();
  const [user,    setUser]    = useState<{ email: string; full_name: string; role: string } | null>(null);
  const [tab,     setTab]     = useState<Tab>("pending");
  const [pending,  setPending]  = useState<Review[]>([]);
  const [reported, setReported] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState<number | null>(null);
  const [toast,   setToast]   = useState("");

  useEffect(() => {
    if (!isAuthenticated()) { router.replace("/admin"); return; }
    const u = getUser<{ email: string; full_name: string; role: string }>();
    if (u?.role !== "admin" && u?.role !== "super_admin") { router.replace("/admin"); return; }
    setUser(u);
  }, [router]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([
        collegeApi.reviews.admin.pending(),
        collegeApi.reviews.admin.flagged(),
      ]);
      setPending(p); setReported(r);
    } catch { setPending([]); setReported([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleApprove(review: Review) {
    setActing(review.id);
    try {
      await collegeApi.reviews.admin.action(review.id, "approve");
      showToast("Review approved.");
      await loadAll();
    } catch { showToast("Action failed."); }
    finally { setActing(null); }
  }

  async function handleReject(review: Review, reason: string) {
    setActing(review.id);
    try {
      await collegeApi.reviews.admin.action(review.id, "reject", reason);
      showToast("Review rejected. The author can edit and resubmit it.");
      await loadAll();
    } catch { showToast("Action failed."); }
    finally { setActing(null); }
  }

  async function handleRemove(review: Review) {
    setActing(review.id);
    try {
      await collegeApi.reviews.admin.action(review.id, "remove");
      showToast("Review removed.");
      await loadAll();
    } catch { showToast("Action failed."); }
    finally { setActing(null); }
  }

  async function handleLogout() {
    try { await authApi.logout(getRefreshToken()!, getAccessToken()!); } catch {}
    finally { clearSession(); router.replace("/admin"); }
  }

  const activeList = tab === "pending" ? pending : reported;

  return (
    <div style={{ minHeight: "100vh", background: "var(--dd-bg)", color: "var(--dd-text1)" }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: "72px", left: "50%", transform: "translateX(-50%)", zIndex: 100, padding: "10px 20px", borderRadius: "12px", background: "var(--dd-bg2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text1)", fontSize: "0.875rem", fontWeight: 500, boxShadow: "var(--dd-shadow-lg)", backdropFilter: "blur(12px)" }}>
          {toast}
        </div>
      )}

      {/* Navbar */}
      <nav style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--dd-nav-bg)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--dd-border)", padding: "0 16px", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, overflow: "hidden" }}>
          <button onClick={() => router.push("/admin/dashboard")}
            style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "var(--dd-text2)", cursor: "pointer", fontSize: "0.875rem", padding: "6px 10px", borderRadius: "8px" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--dd-text2)"; }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 12L6 8l4-4"/></svg>
            Home
          </button>
          <span style={{ color: "var(--dd-border2)" }}>/</span>
          <span style={{ fontSize: "0.875rem", color: "var(--dd-text1)", fontWeight: 600 }}>Review Approvals</span>
          <span style={{ fontSize: "0.6875rem", padding: "2px 8px", borderRadius: "20px", background: "var(--dd-teal-bg2)", border: "1px solid var(--dd-teal-border)", color: "var(--dd-teal)", fontWeight: 500 }}>ADMIN</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <span className="dd-admin-nav-email" style={{ fontSize: "0.8125rem", color: "var(--dd-text3)" }}>{user?.email}</span>
          <button onClick={handleLogout} style={{ padding: "7px 14px", borderRadius: "8px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text2)", fontSize: "0.8125rem", cursor: "pointer", flexShrink: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-text1)"; e.currentTarget.style.background = "var(--dd-border2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text2)"; e.currentTarget.style.background = "var(--dd-surface2)"; }}
          >Sign Out</button>
        </div>
      </nav>

      <main style={{ maxWidth: "860px", margin: "0 auto", padding: "40px 20px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.5rem,4vw,2rem)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--dd-text1)", marginBottom: "6px" }}>
            Review Approvals
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--dd-text3)" }}>
            New reviews wait here until you approve or reject them. A rejection needs a reason, which the author sees before editing and resubmitting.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
          {(["pending", "reported"] as Tab[]).map((t) => {
            const count = t === "pending" ? pending.length : reported.length;
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "8px 18px", borderRadius: "20px", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
                background: active ? "var(--dd-teal-bg2)" : "var(--dd-surface2)",
                border: `1px solid ${active ? "var(--dd-teal-border)" : "var(--dd-border2)"}`,
                color: active ? "var(--dd-teal)" : "var(--dd-text2)",
              }}>
                {TAB_META[t].label} <span className="num">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {[1,2,3].map((i) => (
              <div key={i} style={{ height: "180px", borderRadius: "18px", background: "var(--dd-surface2)", animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i*0.15}s` }} />
            ))}
            <style>{`@keyframes pulse{0%,100%{opacity:.25}50%{opacity:.55}}`}</style>
          </div>
        ) : activeList.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px 0" }}>
            <div style={{ color: "var(--dd-success)", marginBottom: "14px", display: "flex", justifyContent: "center" }}>
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M8 12.5l2.5 2.5L16 9"/>
              </svg>
            </div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.1rem", fontWeight: 600, color: "var(--dd-text1)", marginBottom: "6px" }}>{TAB_META[tab].empty}</h2>
            <p style={{ color: "var(--dd-text3)", fontSize: "0.875rem" }}>{TAB_META[tab].emptyDesc}</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {activeList.map((review) => (
              <AdminReviewCard
                key={review.id}
                review={review}
                mode={tab}
                acting={acting === review.id}
                onApprove={() => handleApprove(review)}
                onReject={(reason) => handleReject(review, reason)}
                onRemove={() => handleRemove(review)}
              />
            ))}
          </div>
        )}
      </main>

      <style>{`
        @media (max-width: 560px) {
          .dd-admin-nav-email { display: none; }
        }
      `}</style>
    </div>
  );
}
