"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser, clearSession, getRefreshToken, getAccessToken } from "@/lib/auth";
import { authApi } from "@/lib/api";

/* ─────────────────────────────────────── helpers ── */
function greeting(name: string): string {
  const h = new Date().getHours();
  const salutation = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const first = name?.trim().split(" ")[0] || "there";
  return `${salutation}, ${first}.`;
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

/* ────────────────────────────────── module card ── */
interface ModuleCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  hoverRgb: string;
  glowRgb: string;
}

function ModuleCard({ icon, title, description, onClick, hoverRgb, glowRgb }: ModuleCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left", padding: "22px", borderRadius: "18px",
        background: "var(--dd-bg2)",
        border: "1px solid var(--dd-border)",
        cursor: "pointer", transition: "all 0.2s", width: "100%",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background  = `rgba(${hoverRgb},0.06)`;
        e.currentTarget.style.borderColor = `rgba(${hoverRgb},0.3)`;
        e.currentTarget.style.transform   = "translateY(-3px)";
        e.currentTarget.style.boxShadow   = `0 12px 40px rgba(${glowRgb},0.14)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background  = "var(--dd-bg2)";
        e.currentTarget.style.borderColor = "var(--dd-border)";
        e.currentTarget.style.transform   = "translateY(0)";
        e.currentTarget.style.boxShadow   = "none";
      }}
    >
      <div style={{ marginBottom: "16px" }}>{icon}</div>
      <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--dd-text1)", letterSpacing: "-0.02em", marginBottom: "5px" }}>
        {title}
      </div>
      <div style={{ fontSize: "0.8125rem", color: "var(--dd-text3)", lineHeight: "1.45" }}>
        {description}
      </div>
    </button>
  );
}

function ModuleIcon({ gradient, glow, children }: { gradient: string; glow: string; children: React.ReactNode }) {
  return (
    <div style={{
      width: "42px", height: "42px", borderRadius: "12px",
      background: gradient,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: `0 0 20px ${glow}`,
    }}>
      {children}
    </div>
  );
}

/* ════════════════════════════════════════ PAGE ══ */
export default function SuperAdminHomePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ email: string; full_name: string } | null>(null);

  useEffect(() => {
    setCurrentUser(getUser<{ email: string; full_name: string }>());
  }, []);

  async function handleLogout() {
    try { await authApi.logout(getRefreshToken()!, getAccessToken()!); } catch {}
    finally { clearSession(); router.replace("/superadmin"); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--dd-bg)", color: "var(--dd-text1)" }}>

      {/* ── Navbar ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 30,
        background: "var(--dd-nav-bg)",
        backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid var(--dd-border)",
        padding: "0 16px", height: "60px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, overflow: "hidden" }}>
          <button onClick={() => router.push("/about")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Darkdoctor" draggable={false}
              style={{ height: "28px", width: "auto", objectFit: "contain" }} />
          </button>
          <span style={{
            fontSize: "0.6875rem", padding: "2px 8px", borderRadius: "20px",
            background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.28)",
            color: "#7c3aed", fontWeight: 500, letterSpacing: "0.03em",
          }}>SUPER ADMIN</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <span className="dd-admin-nav-email" style={{ fontSize: "0.8125rem", color: "var(--dd-text3)" }}>
            {currentUser?.email}
          </span>
          <button onClick={handleLogout} style={{
            padding: "7px 14px", borderRadius: "8px",
            background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)",
            color: "var(--dd-text2)", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", flexShrink: 0,
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-border2)"; e.currentTarget.style.color = "var(--dd-text1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text2)"; }}
          >Sign Out</button>
        </div>
      </nav>

      {/* ── Main ── */}
      <main style={{ maxWidth: "1000px", margin: "0 auto", padding: "48px 20px 80px" }}>

        {/* Greeting */}
        <div style={{
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", gap: "16px",
          marginBottom: "40px", flexWrap: "wrap",
        }}>
          <div>
            <h1 style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(1.7rem,4vw,2.25rem)", fontWeight: 700,
              letterSpacing: "-0.03em", marginBottom: "6px", lineHeight: 1.15,
              color: "var(--dd-text1)",
            }}>
              {currentUser ? greeting(currentUser.full_name) : "Welcome back."}
            </h1>
            <p style={{ fontSize: "0.9rem", color: "var(--dd-text3)" }}>
              Super Administrator · Darkdoctor Platform
            </p>
          </div>
          <span style={{
            fontSize: "0.8125rem", color: "var(--dd-text3)", fontWeight: 400,
            paddingTop: "6px", whiteSpace: "nowrap",
          }}>
            {todayLabel()}
          </span>
        </div>

        {/* Modules */}
        <div>
          <h2 style={{
            fontSize: "0.75rem", fontWeight: 500, color: "var(--dd-text3)",
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "16px",
          }}>
            Modules
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "12px" }}>

            <ModuleCard
              title="Admin Management"
              description="Create, edit, and manage admin accounts and their access."
              onClick={() => router.push("/superadmin/admins")}
              hoverRgb="124,58,237" glowRgb="124,58,237"
              icon={
                <ModuleIcon gradient="linear-gradient(135deg,#7c3aed 0%,#8b5cf6 100%)" glow="rgba(124,58,237,0.35)">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                  </svg>
                </ModuleIcon>
              }
            />

            <ModuleCard
              title="College Information"
              description="Browse all registered colleges with UG/PG and course filters."
              onClick={() => router.push("/colleges")}
              hoverRgb="13,148,136" glowRgb="13,148,136"
              icon={
                <ModuleIcon gradient="linear-gradient(135deg,#0d9488 0%,#7c3aed 100%)" glow="rgba(13,148,136,0.35)">
                  <svg width="20" height="20" viewBox="0 0 34 34" fill="none" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 4L3 11l14 7 14-7-14-7z" fill="none"/>
                    <path d="M3 11v10l14 7 14-7V11" fill="none"/>
                  </svg>
                </ModuleIcon>
              }
            />

            <ModuleCard
              title="Add College"
              description="Register a new college and track the 10 most recent entries."
              onClick={() => router.push("/superadmin/colleges/add")}
              hoverRgb="48,209,88" glowRgb="48,209,88"
              icon={
                <ModuleIcon gradient="linear-gradient(135deg,#30d158 0%,#25a244 100%)" glow="rgba(48,209,88,0.3)">
                  <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round">
                    <line x1="7" y1="1" x2="7" y2="13"/>
                    <line x1="1" y1="7" x2="13" y2="7"/>
                  </svg>
                </ModuleIcon>
              }
            />

            <ModuleCard
              title="Leads"
              description="Track and manage incoming leads, enquiries, and prospective users."
              onClick={() => router.push("/superadmin/leads")}
              hoverRgb="255,55,95" glowRgb="255,55,95"
              icon={
                <ModuleIcon gradient="linear-gradient(135deg,#ff375f 0%,#ff2d55 100%)" glow="rgba(255,55,95,0.32)">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                  </svg>
                </ModuleIcon>
              }
            />

            <ModuleCard
              title="About Us"
              description="Edit mission, vision, about text, contact email, and social media handles."
              onClick={() => router.push("/superadmin/about")}
              hoverRgb="255,159,10" glowRgb="255,159,10"
              icon={
                <ModuleIcon gradient="linear-gradient(135deg,#ff9f0a 0%,#ff6b00 100%)" glow="rgba(255,159,10,0.32)">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </ModuleIcon>
              }
            />

            <ModuleCard
              title="Review Moderation"
              description="Review flagged content, approve genuine reviews, and remove violations."
              onClick={() => router.push("/superadmin/reviews")}
              hoverRgb="255,69,58" glowRgb="255,69,58"
              icon={
                <ModuleIcon gradient="linear-gradient(135deg,#ff453a 0%,#ff2d55 100%)" glow="rgba(255,69,58,0.32)">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </ModuleIcon>
              }
            />

            <ModuleCard
              title="Communities Moderation"
              description="Review flagged posts and comments from Specialty Communities."
              onClick={() => router.push("/superadmin/communities")}
              hoverRgb="124,58,237" glowRgb="124,58,237"
              icon={
                <ModuleIcon gradient="linear-gradient(135deg,#7c3aed 0%,#a78bfa 100%)" glow="rgba(124,58,237,0.32)">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                  </svg>
                </ModuleIcon>
              }
            />

            <ModuleCard
              title="Q&A Moderation"
              description="Review flagged questions and answers, approve genuine ones, and remove violations."
              onClick={() => router.push("/superadmin/qa")}
              hoverRgb="13,148,136" glowRgb="13,148,136"
              icon={
                <ModuleIcon gradient="linear-gradient(135deg,#0d9488 0%,#2dd4bf 100%)" glow="rgba(13,148,136,0.32)">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
                  </svg>
                </ModuleIcon>
              }
            />

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
