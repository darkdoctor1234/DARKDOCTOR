"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser, clearSession, getRefreshToken, getAccessToken } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { collegeApi } from "@/lib/collegeApi";
import { collegeChangeApi } from "@/lib/collegeChangeApi";
import { questionsApi } from "@/lib/questionsApi";

interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [collegeRequestCount, setCollegeRequestCount] = useState<number | null>(null);
  const [qaFlaggedCount, setQaFlaggedCount] = useState<number | null>(null);

  useEffect(() => {
    setUser(getUser<AdminUser>());
    collegeApi.reviews.admin.pending()
      .then((r) => setPendingCount(r.length))
      .catch(() => setPendingCount(null));
    collegeChangeApi.pending()
      .then((r) => setCollegeRequestCount(r.length))
      .catch(() => setCollegeRequestCount(null));
    Promise.all([questionsApi.admin.questionsFlagged(), questionsApi.admin.answersFlagged()])
      .then(([q, a]) => setQaFlaggedCount(q.length + a.length))
      .catch(() => setQaFlaggedCount(null));
  }, []);

  async function handleLogout() {
    try {
      const refresh = getRefreshToken();
      const access  = getAccessToken();
      if (refresh && access) await authApi.logout(refresh, access);
    } catch {
      // silent — always proceed
    } finally {
      clearSession();
      router.replace("/admin");
    }
  }

  const firstName = user?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "Admin";

  return (
    <div style={{ minHeight: "100vh", background: "var(--dd-bg)", color: "var(--dd-text1)" }}>

      {/* ── Navbar ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 30,
        background: "var(--dd-nav-bg)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid var(--dd-border)",
        padding: "0 24px", height: "60px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button onClick={() => router.push("/about")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Darkdoctor" draggable={false}
              style={{ height: "28px", width: "auto", objectFit: "contain" }} />
          </button>
          <span style={{
            fontSize: "0.6875rem", padding: "2px 8px", borderRadius: "20px",
            background: "var(--dd-teal-bg2)", border: "1px solid var(--dd-teal-border)",
            color: "var(--dd-teal)", fontWeight: 500, letterSpacing: "0.02em",
          }}>
            ADMIN
          </span>
        </div>

        {/* User info + Sign out */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
          <span className="dd-admin-nav-email" style={{ fontSize: "0.8125rem", color: "var(--dd-text3)" }}>
            {user?.email}
          </span>
          <button
            onClick={handleLogout}
            style={{
              padding: "7px 14px", borderRadius: "8px",
              background: "var(--dd-surface2)",
              border: "1px solid var(--dd-border2)",
              color: "var(--dd-text2)", fontSize: "0.8125rem", fontWeight: 500,
              cursor: "pointer", transition: "all 0.15s", flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-border2)"; e.currentTarget.style.color = "var(--dd-text1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text2)"; }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* ── Main ── */}
      <main style={{ maxWidth: "960px", margin: "0 auto", padding: "48px 20px 64px" }}>

        {/* Welcome hero */}
        <div style={{
          borderRadius: "24px",
          background: "linear-gradient(135deg, rgba(13,148,136,0.08) 0%, rgba(124,58,237,0.06) 100%)",
          border: "1px solid rgba(13,148,136,0.16)",
          padding: "clamp(28px, 5vw, 48px) clamp(24px, 5vw, 48px)",
          marginBottom: "28px",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Background glow */}
          <div style={{
            position: "absolute", top: "-60px", right: "-60px", pointerEvents: "none",
            width: "300px", height: "300px", borderRadius: "50%",
            background: "radial-gradient(circle, rgba(13,148,136,0.1) 0%, transparent 70%)",
            filter: "blur(40px)",
          }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            {/* Greeting */}
            <p style={{ fontSize: "0.9rem", color: "var(--dd-teal)", fontWeight: 500, marginBottom: "8px", letterSpacing: "-0.01em" }}>
              {getGreeting()},
            </p>
            <h1 style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(1.75rem, 5vw, 2.5rem)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              marginBottom: "12px",
              background: "linear-gradient(135deg, var(--dd-text1) 0%, var(--dd-text3) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              Welcome to the Admin Portal
            </h1>
            <p style={{ fontSize: "1rem", color: "var(--dd-text2)", maxWidth: "480px", lineHeight: "1.6", letterSpacing: "-0.01em" }}>
              You are signed in as <strong style={{ color: "var(--dd-text1)" }}>{user?.full_name || firstName}</strong>.
              Use this portal to manage your assigned responsibilities on the Darkdoctor platform.
            </p>
          </div>
        </div>

        {/* Info cards row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", marginBottom: "28px" }}>
          {[
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              ),
              label: "Signed in as",
              value: user?.full_name || "-",
              color: "#0d9488",
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <polyline points="2,9 12,15 22,9"/>
                </svg>
              ),
              label: "Email",
              value: user?.email || "-",
              color: "#7c3aed",
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              ),
              label: "Role",
              value: "Admin",
              color: "#15803d",
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                </svg>
              ),
              label: "Session",
              value: "Active",
              color: "#15803d",
            },
          ].map((card) => (
            <div key={card.label} style={{
              padding: "20px",
              borderRadius: "16px",
              background: "var(--dd-bg2)",
              border: "1px solid var(--dd-border)",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}>
              <div style={{
                width: "38px", height: "38px", borderRadius: "10px",
                background: `${card.color}18`,
                border: `1px solid ${card.color}28`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: card.color,
              }}>
                {card.icon}
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--dd-text3)", marginBottom: "3px", letterSpacing: "0.01em" }}>
                  {card.label}
                </div>
                <div className="num" style={{
                  fontSize: "0.9rem", fontWeight: 500, color: "var(--dd-text1)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {card.value}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div style={{ marginBottom: "14px" }}>
          <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "14px" }}>
            Quick Actions
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
            {[
              {
                title: "Review Approvals",
                desc: pendingCount ? `${pendingCount} review${pendingCount === 1 ? "" : "s"} waiting on your decision.` : "Approve or reject newly submitted reviews.",
                color: "#7c3aed",
                bg: "rgba(124,58,237,0.08)",
                border: "rgba(124,58,237,0.22)",
                href: "/admin/reviews",
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                  </svg>
                ),
              },
              {
                title: "Q&A Moderation",
                desc: qaFlaggedCount ? `${qaFlaggedCount} item${qaFlaggedCount === 1 ? "" : "s"} waiting on your decision.` : "Review reported questions and answers.",
                color: "#0d9488",
                bg: "rgba(13,148,136,0.08)",
                border: "rgba(13,148,136,0.22)",
                href: "/admin/qa",
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
                  </svg>
                ),
              },
              {
                title: "College Change Requests",
                desc: collegeRequestCount ? `${collegeRequestCount} request${collegeRequestCount === 1 ? "" : "s"} waiting for proof review.` : "Approve or reject locked UG/PG college changes.",
                color: "#b45309",
                bg: "rgba(180,83,9,0.08)",
                border: "rgba(180,83,9,0.22)",
                href: "/admin/college-requests",
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                ),
              },
              {
                title: "Browse Colleges",
                desc: "View all medical colleges registered on the platform.",
                color: "#0d9488",
                bg: "rgba(13,148,136,0.08)",
                border: "rgba(13,148,136,0.22)",
                href: "/colleges",
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                ),
              },
            ].map((item) => (
              <button
                key={item.title}
                onClick={() => router.push(item.href)}
                style={{
                  textAlign: "left", padding: "20px", borderRadius: "16px",
                  background: item.bg, border: `1px solid ${item.border}`,
                  cursor: "pointer", transition: "all 0.15s", width: "100%",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${item.bg}`; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ marginBottom: "12px" }}>{item.icon}</div>
                <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--dd-text1)", marginBottom: "4px" }}>{item.title}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--dd-text3)", lineHeight: 1.4 }}>{item.desc}</div>
              </button>
            ))}
          </div>
        </div>

      </main>

      <style>{`
        @media (max-width: 560px) {
          .dd-admin-nav-email { display: none; }
        }
      `}</style>
    </div>
  );
}
