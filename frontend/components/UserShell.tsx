"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isAuthenticated, getUser, clearSession, getRefreshToken, getAccessToken } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { useTheme } from "@/lib/themeContext";
import CreateMenu from "@/components/CreateMenu";
import EmailVerifyModal from "@/components/EmailVerifyModal";
import NotificationBell from "@/components/NotificationBell";

interface SessionUser { id: number; email: string; email_verified?: boolean; full_name: string; role: string; }
type TabId = "feed" | "colleges" | "communities" | "profile";

interface TabDef {
  id: TabId;
  label: string;
  href: string;
  color: string;
  icon: (color: string, size: number) => React.ReactNode;
}

const TABS: TabDef[] = [
  {
    id: "feed",
    label: "Feed",
    href: "/feed",
    color: "#0d9488",
    icon: (c, s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
        stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11a9 9 0 0 1 9 9"/>
        <path d="M4 4a16 16 0 0 1 16 16"/>
        <circle cx="5" cy="19" r="1.5" fill={c} stroke="none"/>
      </svg>
    ),
  },
  {
    id: "colleges",
    label: "Colleges",
    href: "/colleges",
    color: "#0d9488",
    icon: (c, s) => (
      <svg width={s} height={s} viewBox="0 0 34 34" fill="none"
        stroke={c} strokeWidth="2.83" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 4L3 11l14 7 14-7-14-7z"/>
        <path d="M3 11v10l14 7 14-7V11"/>
      </svg>
    ),
  },
  {
    id: "communities",
    label: "Communities",
    href: "/communities",
    color: "#7c3aed",
    icon: (c, s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
        stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
  {
    id: "profile",
    label: "Profile",
    href: "/profile",
    color: "#0d9488",
    icon: (c, s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
        stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    ),
  },
];

function getActiveTab(pathname: string): TabId {
  if (pathname.startsWith("/colleges")) return "colleges";
  if (pathname.startsWith("/communities")) return "communities";
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/settings")) return "profile";
  return "feed";
}

/* ── One bottom-nav tab button ── */
function BottomTab({ tab, active, hasUnreadCommunity, onClick }: {
  tab: TabDef; active: TabId; hasUnreadCommunity: boolean; onClick: () => void;
}) {
  const isActive = active === tab.id;
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: "10px 4px 8px",
        background: "none", border: "none", cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
        transition: "transform 0.12s ease",
      }}
      onMouseDown={(e)  => { e.currentTarget.style.transform = "scale(0.88)"; }}
      onMouseUp={(e)    => { e.currentTarget.style.transform = "scale(1)"; }}
      onTouchStart={(e) => { e.currentTarget.style.transform = "scale(0.88)"; }}
      onTouchEnd={(e)   => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      <span style={{ position: "relative", display: "flex" }}>
        {tab.icon(isActive ? tab.color : "var(--dd-text4)", 24)}
        {tab.id === "communities" && hasUnreadCommunity && (
          <span style={{ position: "absolute", top: "-1px", right: "-2px", width: "8px", height: "8px", borderRadius: "50%", background: "#7c3aed", border: "1.5px solid var(--dd-bottom-bg)" }} />
        )}
      </span>
      <span style={{
        fontSize: "0.625rem", fontWeight: isActive ? 600 : 400,
        color: isActive ? tab.color : "var(--dd-text4)",
        letterSpacing: "0.02em", lineHeight: 1,
      }}>
        {tab.label}
      </span>
    </button>
  );
}

/* ── Theme toggle button ── */
function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        width: "32px", height: "32px", borderRadius: "8px",
        background: "var(--dd-surface2)",
        border: "1px solid var(--dd-border)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--dd-text3)", cursor: "pointer",
        transition: "color 0.15s, background 0.15s, border-color 0.15s",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "var(--dd-text1)";
        e.currentTarget.style.background = "var(--dd-surface)";
        e.currentTarget.style.borderColor = "var(--dd-border2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "var(--dd-text3)";
        e.currentTarget.style.background = "var(--dd-surface2)";
        e.currentTarget.style.borderColor = "var(--dd-border)";
      }}
    >
      {isDark ? (
        /* Sun icon — click to go light */
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        /* Moon icon — click to go dark */
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
        </svg>
      )}
    </button>
  );
}

/* ── Signup nudge popup ──────────────────────────────────────────────────── */
const NUDGE_KEY      = "dd_nudge_count";
const NUDGE_MAX      = 3;
const NUDGE_DELAY_MS = 2 * 60 * 1000;

function SignupNudge() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const shown = parseInt(sessionStorage.getItem(NUDGE_KEY) ?? "0", 10);
    if (shown >= NUDGE_MAX) return;
    const timer = setTimeout(() => setVisible(true), NUDGE_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    setVisible(false);
    const shown = parseInt(sessionStorage.getItem(NUDGE_KEY) ?? "0", 10);
    sessionStorage.setItem(NUDGE_KEY, String(shown + 1));
    if (shown + 1 < NUDGE_MAX) {
      setTimeout(() => setVisible(true), NUDGE_DELAY_MS);
    }
  }

  if (!visible) return null;

  const shown     = parseInt(sessionStorage.getItem(NUDGE_KEY) ?? "0", 10);
  const remaining = NUDGE_MAX - shown - 1;

  return (
    <>
      <div
        onClick={dismiss}
        style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(15,23,42,0.45)",
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        }}
      />
      <div style={{
        position: "fixed",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 101,
        width: "min(90vw, 380px)",
        background: "var(--dd-bg2)",
        border: "1px solid var(--dd-border2)",
        borderRadius: "26px",
        padding: "36px 28px 28px",
        boxShadow: "var(--dd-shadow-lg)",
        animation: "dd-nudge-in 0.28s cubic-bezier(0.22,1,0.36,1) forwards",
        textAlign: "center",
      }}>
        <button
          onClick={dismiss}
          style={{
            position: "absolute", top: "14px", right: "14px",
            width: "30px", height: "30px", borderRadius: "50%",
            background: "var(--dd-surface2)",
            border: "1px solid var(--dd-border)",
            color: "var(--dd-text3)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.05rem", lineHeight: 1,
            transition: "background 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--dd-border2)";
            e.currentTarget.style.color = "var(--dd-text1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--dd-surface2)";
            e.currentTarget.style.color = "var(--dd-text3)";
          }}
        >
          ×
        </button>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand-icon.png" alt="Darkdoctor" draggable={false}
          style={{ width: "92px", height: "92px", objectFit: "contain", display: "block", margin: "0 auto 22px" }} />

        <h2 style={{
          fontSize: "1.25rem", fontWeight: 700, color: "var(--dd-text1)",
          letterSpacing: "-0.03em", lineHeight: 1.25, marginBottom: "10px",
        }}>
          Know a college? Review it.
        </h2>

        <p style={{
          fontSize: "0.875rem", color: "var(--dd-text3)", lineHeight: 1.65,
          marginBottom: "26px",
        }}>
          Sign up free to share your college experience.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            onClick={() => router.push("/signup")}
            style={{
              padding: "13px 16px", borderRadius: "13px",
              background: "linear-gradient(135deg,#0d9488 0%,#7c3aed 100%)",
              border: "none", color: "#fff",
              fontSize: "0.9375rem", fontWeight: 600, cursor: "pointer",
              boxShadow: "0 4px 20px rgba(13,148,136,0.32)",
              letterSpacing: "-0.01em",
            }}
          >
            Create Free Account
          </button>
          <button
            onClick={() => router.push("/login")}
            style={{
              padding: "12px 16px", borderRadius: "13px",
              background: "var(--dd-surface2)",
              border: "1px solid var(--dd-border2)",
              color: "var(--dd-text2)",
              fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
              transition: "background 0.15s, color 0.15s",
              letterSpacing: "-0.01em",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--dd-border)";
              e.currentTarget.style.color = "var(--dd-text1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--dd-surface2)";
              e.currentTarget.style.color = "var(--dd-text2)";
            }}
          >
            Already have an account? Sign in
          </button>
        </div>

        <p style={{
          marginTop: "16px", fontSize: "0.72rem", color: "var(--dd-text4)",
          lineHeight: 1.5,
        }}>
          {remaining > 0
            ? `You can continue browsing. We'll remind you ${remaining === 1 ? "once" : `${remaining} more times`}.`
            : "We won't ask again this session."
          }
        </p>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */

export default function UserShell({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname() ?? "";
  const [user, setUser]       = useState<SessionUser | null>(null);
  const [mounted, setMounted] = useState(false);
  const [hasUnreadCommunity, setHasUnreadCommunity] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const active = getActiveTab(pathname);

  useEffect(() => {
    setMounted(true);
    if (isAuthenticated()) setUser(getUser<SessionUser>());
  }, []);

  // Small Instagram-style dot on the Communities tab when any of the user's
  // communities has activity they haven't seen — not a full notification
  // system, just this one badge.
  useEffect(() => {
    if (!isAuthenticated()) return;
    import("@/lib/communitiesApi").then(({ communitiesApi }) => {
      communitiesApi.mine()
        .then((mine) => setHasUnreadCommunity(mine.some((c) => c.is_active && c.has_unread)))
        .catch(() => {});
    });
  }, [pathname]);

  async function handleLogout() {
    try { await authApi.logout(getRefreshToken()!, getAccessToken()!); } catch {}
    finally { clearSession(); router.replace("/"); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--dd-bg)", color: "var(--dd-text1)" }}>

      {/* ── Top Navbar ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "var(--dd-nav-bg)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid var(--dd-border)",
        height: "60px",
        display: "flex", alignItems: "stretch",
        padding: "0 clamp(20px, 4vw, 48px)",
      }}>

        {/* ── LEFT zone ── */}
        <div className="dd-nav-left" style={{ flex: 1, display: "flex", alignItems: "center", minWidth: 0 }}>
          <button
            onClick={() => router.push("/about")}
            style={{
              display: "flex", alignItems: "center",
              background: "none", border: "none", cursor: "pointer",
              padding: "0", flexShrink: 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Darkdoctor" draggable={false}
              style={{ height: "30px", width: "auto", objectFit: "contain" }} />
          </button>

          {mounted && user?.role === "super_admin" && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "12px" }}>
              <span style={{ color: "var(--dd-border2)" }}>/</span>
              <button
                onClick={() => router.push("/superadmin/home")}
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--dd-text3)", fontSize: "0.875rem", fontWeight: 500, padding: "4px 8px",
                  borderRadius: "8px", transition: "color 0.15s, background 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-text2)"; e.currentTarget.style.background = "var(--dd-surface2)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)"; e.currentTarget.style.background = "none"; }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M10 12L6 8l4-4"/>
                </svg>
                Admin
              </button>
            </div>
          )}
        </div>

        {/* ── CENTER — desktop tabs ── */}
        {mounted && user?.role !== "super_admin" && (
          <div className="dd-nav-tabs">
            {TABS.filter((tab) => user || tab.id !== "profile").map((tab) => {
              const isActive = active === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => router.push(tab.href)}
                  style={{
                    position: "relative",
                    background: "none", border: "none", cursor: "pointer",
                    padding: "0 16px",
                    display: "flex", alignItems: "center", gap: "6px",
                    fontSize: "0.875rem", fontWeight: isActive ? 600 : 500,
                    color: isActive ? tab.color : "var(--dd-text3)",
                    transition: "color 0.15s, background 0.15s",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = "var(--dd-text2)";
                      e.currentTarget.style.background = "var(--dd-surface2)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = "var(--dd-text3)";
                      e.currentTarget.style.background = "none";
                    }
                  }}
                >
                  <span style={{ position: "relative", display: "flex" }}>
                    {tab.icon(isActive ? tab.color : "var(--dd-text3)", 16)}
                    {tab.id === "communities" && hasUnreadCommunity && (
                      <span style={{ position: "absolute", top: "-2px", right: "-3px", width: "7px", height: "7px", borderRadius: "50%", background: "#7c3aed", border: "1.5px solid var(--dd-nav-bg)" }} />
                    )}
                  </span>
                  {tab.label}
                  {isActive && (
                    <span style={{
                      position: "absolute", bottom: "0px", left: "50%",
                      transform: "translateX(-50%)",
                      width: "24px", height: "2px", borderRadius: "2px",
                      background: tab.color,
                      boxShadow: `0 0 10px ${tab.color}`,
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ── RIGHT zone ── */}
        <div className="dd-nav-right" style={{ flex: 1, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "8px" }}>
          {/* Theme toggle — always visible once mounted */}
          {mounted && <ThemeToggle />}

          {mounted && (
            <>
              {user?.role === "super_admin" && (
                <button
                  onClick={() => router.push("/superadmin/home")}
                  style={{
                    padding: "5px 12px", borderRadius: "8px",
                    background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.22)",
                    color: "#7c3aed", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "5px",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(124,58,237,0.18)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(124,58,237,0.1)"; }}
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <rect x="1" y="1" width="6" height="6" rx="1"/>
                    <rect x="9" y="1" width="6" height="6" rx="1"/>
                    <rect x="1" y="9" width="6" height="6" rx="1"/>
                    <rect x="9" y="9" width="6" height="6" rx="1"/>
                  </svg>
                  Admin
                </button>
              )}

              {user && (
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  style={{
                    width: "32px", height: "32px", borderRadius: "8px",
                    background: "var(--dd-surface2)", border: "1px solid var(--dd-border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--dd-text3)", cursor: "pointer", transition: "color 0.15s, background 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--dd-danger)";
                    e.currentTarget.style.background = "var(--dd-danger-bg)";
                    e.currentTarget.style.borderColor = "var(--dd-danger-border)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--dd-text3)";
                    e.currentTarget.style.background = "var(--dd-surface2)";
                    e.currentTarget.style.borderColor = "var(--dd-border)";
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 3H5a1 1 0 00-1 1v12a1 1 0 001 1h4"/>
                    <polyline points="14 15 18 10 14 5"/>
                    <line x1="18" y1="10" x2="8" y2="10"/>
                  </svg>
                </button>
              )}

              {!user && (
                <>
                  <button
                    onClick={() => router.push("/login")}
                    className="dd-nav-signin"
                    style={{
                      padding: "6px 14px", borderRadius: "9px",
                      background: "var(--dd-surface2)",
                      border: "1px solid var(--dd-border2)",
                      color: "var(--dd-text2)", fontSize: "0.8125rem", fontWeight: 500,
                      cursor: "pointer", transition: "background 0.15s, color 0.15s",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-border)"; e.currentTarget.style.color = "var(--dd-text1)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text2)"; }}
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => router.push("/signup")}
                    style={{
                      padding: "6px 14px", borderRadius: "9px",
                      background: "#0d9488",
                      border: "none", outline: "none",
                      color: "#fff", fontSize: "0.8125rem", fontWeight: 600,
                      cursor: "pointer", transition: "background 0.15s",
                      boxShadow: "0 2px 12px rgba(13,148,136,0.30)",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#0f766e"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#0d9488"; }}
                  >
                    Sign up
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* ── Create (Ask/Discuss/Review) — a desktop button here, a raised
             FAB over the bottom tab bar on mobile; both rendered by the same
             component so they share one action-sheet + modal state. Not
             nested inside .dd-nav-right on purpose: that zone is hidden on
             mobile, which would take the FAB down with it. The FAB, action
             sheet and modals are portalled to document.body inside
             CreateMenu — this <nav> sets backdropFilter, which (like
             transform/filter) creates a new containing block for
             position:fixed descendants, so left un-portalled they'd be
             "fixed" relative to the nav bar instead of the viewport. ── */}
        <CreateMenu />

        {/* ── Notifications — always visible (incl. mobile, unlike the rest
             of the right zone). */}
        {mounted && user && <NotificationBell />}
      </nav>

      {/* ── Email verification banner (end users only, not admin/super admin) ── */}
      {mounted && user && user.role === "user" && !user.email_verified && !bannerDismissed && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
          flexWrap: "wrap", padding: "9px 16px",
          background: "var(--dd-warning-bg)", borderBottom: "1px solid var(--dd-warning-border)",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--dd-warning)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <span style={{ fontSize: "0.8125rem", color: "var(--dd-text2)" }}>Please verify your email to secure your account.</span>
          <button onClick={() => setVerifyOpen(true)} style={{ background: "none", border: "none", padding: 0, color: "var(--dd-warning)", fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer" }}>
            Verify now
          </button>
          <button onClick={() => setBannerDismissed(true)} title="Dismiss" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dd-text3)", padding: "2px", display: "flex" }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
          </button>
        </div>
      )}

      {verifyOpen && user && (
        <EmailVerifyModal
          email={user.email}
          onClose={() => setVerifyOpen(false)}
          onVerified={() => { setUser({ ...user, email_verified: true }); setVerifyOpen(false); }}
        />
      )}

      {/* ── Page content ── */}
      <div className="dd-shell-content">
        {children}
      </div>

      {/* ── Signup nudge (guests only) ── */}
      {mounted && !user && <SignupNudge />}

      {/* ── Bottom Tab Bar (mobile only, end users only) ── */}
      <nav className={`dd-bottom-nav${mounted && user?.role === "super_admin" ? " dd-bottom-nav--hidden" : ""}`} aria-label="Main navigation">
        {TABS.slice(0, 2).map((tab) => (
          <BottomTab key={tab.id} tab={tab} active={active} hasUnreadCommunity={hasUnreadCommunity} onClick={() => router.push(tab.href)} />
        ))}
        {/* Empty slot the raised FAB sits over — keeps it from overlapping tab labels */}
        <div style={{ flex: 1 }} aria-hidden="true" />
        {TABS.slice(2).map((tab) => (
          <BottomTab key={tab.id} tab={tab} active={active} hasUnreadCommunity={hasUnreadCommunity} onClick={() => router.push(tab.href)} />
        ))}
      </nav>

      <style>{`
        @keyframes dd-nudge-in {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1);    }
        }
        .dd-nav-tabs {
          display: flex;
          align-items: stretch;
          gap: 0;
        }
        .dd-bottom-nav {
          display: none;
        }
        .dd-shell-content {
          padding-bottom: 0;
        }
        .dd-bottom-nav--hidden {
          display: none !important;
        }
        @media (max-width: 767px) {
          .dd-nav-tabs {
            display: none;
          }
          .dd-nav-signin {
            display: none;
          }
          .dd-nav-right {
            display: none !important;
          }
          .dd-bottom-nav {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 50;
            background: var(--dd-bottom-bg);
            backdrop-filter: blur(24px) saturate(180%);
            -webkit-backdrop-filter: blur(24px) saturate(180%);
            border-top: 1px solid var(--dd-border);
            padding-bottom: env(safe-area-inset-bottom, 4px);
          }
          .dd-shell-content {
            padding-bottom: calc(64px + env(safe-area-inset-bottom, 4px));
          }
        }
      `}</style>
    </div>
  );
}
