"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getUser, clearSession, getRefreshToken, getAccessToken, isAuthenticated } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { collegeChangeApi, type CollegeChangeRequestItem } from "@/lib/collegeChangeApi";

export default function AdminCollegeRequestsPage() {
  const router = useRouter();
  const [user, setUser]         = useState<{ email: string; full_name: string; role: string } | null>(null);
  const [requests, setRequests] = useState<CollegeChangeRequestItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason]     = useState("");
  const [toast, setToast]       = useState("");

  useEffect(() => {
    if (!isAuthenticated()) { router.replace("/admin"); return; }
    const u = getUser<{ email: string; full_name: string; role: string }>();
    if (u?.role !== "admin" && u?.role !== "super_admin") { router.replace("/admin"); return; }
    setUser(u);
  }, [router]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await collegeChangeApi.pending());
    } catch { setRequests([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleApprove(id: number) {
    setActing(id);
    try {
      await collegeChangeApi.act(id, "approve");
      showToast("Request approved.");
      await loadAll();
    } catch { showToast("Action failed."); }
    finally { setActing(null); }
  }

  async function handleReject(id: number) {
    if (!reason.trim()) return;
    setActing(id);
    try {
      await collegeChangeApi.act(id, "reject", reason.trim());
      showToast("Request rejected.");
      setRejecting(null); setReason("");
      await loadAll();
    } catch { showToast("Action failed."); }
    finally { setActing(null); }
  }

  async function handleLogout() {
    try { await authApi.logout(getRefreshToken()!, getAccessToken()!); } catch {}
    finally { clearSession(); router.replace("/admin"); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--dd-bg)", color: "var(--dd-text1)" }}>

      {toast && (
        <div style={{ position: "fixed", top: "72px", left: "50%", transform: "translateX(-50%)", zIndex: 100, padding: "10px 20px", borderRadius: "12px", background: "var(--dd-bg2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text1)", fontSize: "0.875rem", fontWeight: 500, boxShadow: "var(--dd-shadow-lg)", backdropFilter: "blur(12px)" }}>
          {toast}
        </div>
      )}

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
          <span style={{ fontSize: "0.875rem", color: "var(--dd-text1)", fontWeight: 600 }}>College Change Requests</span>
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

      <main style={{ maxWidth: "780px", margin: "0 auto", padding: "40px 20px 80px" }}>
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.5rem,4vw,2rem)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--dd-text1)", marginBottom: "6px" }}>
            College Change Requests
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--dd-text3)" }}>
            A user's UG/PG college locks after their first review or a short grace window. Changing it after that needs proof, reviewed here.
          </p>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {[1, 2].map((i) => (
              <div key={i} style={{ height: "160px", borderRadius: "18px", background: "var(--dd-surface2)", animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />
            ))}
            <style>{`@keyframes pulse{0%,100%{opacity:.25}50%{opacity:.55}}`}</style>
          </div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px 0" }}>
            <div style={{ color: "var(--dd-success)", marginBottom: "14px", display: "flex", justifyContent: "center" }}>
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M8 12.5l2.5 2.5L16 9"/>
              </svg>
            </div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.1rem", fontWeight: 600, color: "var(--dd-text1)", marginBottom: "6px" }}>All caught up</h2>
            <p style={{ color: "var(--dd-text3)", fontSize: "0.875rem" }}>No college change requests awaiting review.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {requests.map((r) => (
              <div key={r.id} style={{ borderRadius: "18px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)", padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "12px" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--dd-text1)" }}>{r.user_full_name || r.user_email}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--dd-text3)" }}>{r.user_email}</div>
                  </div>
                  <span style={{ fontSize: "0.6875rem", padding: "3px 9px", borderRadius: "20px", background: "var(--dd-teal-bg2)", border: "1px solid var(--dd-teal-border)", color: "var(--dd-teal)", fontWeight: 600, flexShrink: 0 }}>
                    {r.field_display}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.875rem", color: "var(--dd-text1)", marginBottom: "14px", flexWrap: "wrap" }}>
                  <span style={{ color: "var(--dd-text3)" }}>{r.current_college_name ?? "Not set"}</span>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: "var(--dd-text4)", flexShrink: 0 }}><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                  <span style={{ fontWeight: 600 }}>{r.requested_college_name}</span>
                </div>

                <a href={r.proof} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.8125rem", color: "var(--dd-teal)", fontWeight: 600, marginBottom: "16px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>
                  View proof document
                </a>

                {rejecting === r.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <textarea
                      value={reason} onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason for rejecting…" rows={2}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)", color: "var(--dd-text1)", fontSize: "0.8125rem", resize: "vertical", boxSizing: "border-box" }}
                    />
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => handleReject(r.id)} disabled={acting === r.id || !reason.trim()} style={{ flex: 1, padding: "9px", borderRadius: "10px", background: "var(--dd-danger)", border: "none", color: "#fff", fontSize: "0.8125rem", fontWeight: 600, cursor: acting === r.id ? "wait" : "pointer" }}>
                        Confirm Reject
                      </button>
                      <button onClick={() => { setRejecting(null); setReason(""); }} style={{ padding: "9px 14px", borderRadius: "10px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text2)", fontSize: "0.8125rem", cursor: "pointer" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => handleApprove(r.id)} disabled={acting === r.id} style={{ flex: 1, padding: "9px", borderRadius: "10px", background: "var(--dd-success)", border: "none", color: "#fff", fontSize: "0.8125rem", fontWeight: 600, cursor: acting === r.id ? "wait" : "pointer" }}>
                      Approve
                    </button>
                    <button onClick={() => setRejecting(r.id)} disabled={acting === r.id} style={{ flex: 1, padding: "9px", borderRadius: "10px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", color: "var(--dd-danger)", fontSize: "0.8125rem", fontWeight: 600, cursor: acting === r.id ? "wait" : "pointer" }}>
                      Reject
                    </button>
                  </div>
                )}
              </div>
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
