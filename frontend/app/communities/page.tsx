"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { profileApi, COMMUNITY_ELIGIBLE_STATUSES, type UserProfile } from "@/lib/profileApi";
import { communitiesApi, type MyCommunity } from "@/lib/communitiesApi";
import UserShell from "@/components/UserShell";
import SpecialtyIcon from "@/components/communities/SpecialtyIcon";

function GlobeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15.3 15.3 0 014 9 15.3 15.3 0 01-4 9 15.3 15.3 0 01-4-9 15.3 15.3 0 014-9z" />
    </svg>
  );
}

function CommunityIcon({ community, size = 20 }: { community: MyCommunity; size?: number }) {
  if (community.type === "national_overall") return <GlobeIcon size={size} />;
  return <SpecialtyIcon department={community.department} size={size} />;
}

/** Templated client-side description — no backend field needed. One
 *  sentence per community type, following the client's spec: overall
 *  national, department nationwide, or department within one state. */
function communityDescription(community: MyCommunity): string {
  if (community.type === "national_overall") {
    return "Every PG doctor on Darkdoctor, one national community. Connect across every specialty and state.";
  }
  if (community.type === "department_national") {
    return `${community.department} specialists across India. Share cases, opportunities and advice nationwide.`;
  }
  return `${community.department} specialists in ${community.state}. Connect with doctors in your own state.`;
}

function communityMeta(community: MyCommunity): string {
  if (community.type === "national_overall") return "National · All specialties";
  if (community.type === "department_national") return "National · " + community.department;
  return `Statewide · ${community.department}`;
}

function CommunityCard({ community, onJoin, busy }: {
  community: MyCommunity;
  onJoin: (id: number) => void;
  busy: boolean;
}) {
  const router = useRouter();

  return (
    <div style={{
      padding: "20px 22px", borderRadius: "18px",
      background: "var(--dd-bg2)", border: "1px solid var(--dd-border)",
      opacity: community.is_active ? 1 : 0.8,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "12px" }}>
        <div style={{
          position: "relative", width: "44px", height: "44px", borderRadius: "12px", flexShrink: 0,
          background: "var(--dd-teal-bg2)", color: "var(--dd-teal)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <CommunityIcon community={community} />
          {community.has_unread && community.is_active && (
            <span style={{
              position: "absolute", top: "-2px", right: "-2px",
              width: "11px", height: "11px", borderRadius: "50%",
              background: "#7c3aed", border: "2px solid var(--dd-bg2)",
            }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingTop: "2px" }}>
          <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--dd-text1)" }}>
            {community.name}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--dd-text4)", marginTop: "1px" }}>
            {communityMeta(community)}
          </div>
        </div>
      </div>

      <p style={{ fontSize: "0.8375rem", color: "var(--dd-text2)", lineHeight: 1.55, margin: "0 0 16px" }}>
        {communityDescription(community)}
      </p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <span style={{ fontSize: "0.78rem", color: "var(--dd-text3)" }}>
          <span className="num">{community.member_count}</span> member{community.member_count !== 1 ? "s" : ""}
        </span>

        {community.is_active ? (
          <button
            onClick={() => router.push(`/communities/${community.id}`)}
            style={{
              padding: "8px 18px", borderRadius: "9px", flexShrink: 0,
              background: "linear-gradient(135deg,#7c3aed 0%,#0d9488 100%)",
              border: "none", color: "#fff", fontSize: "0.8125rem", fontWeight: 600,
              cursor: "pointer",
            }}
          >
            View community
          </button>
        ) : (
          <button
            onClick={() => onJoin(community.id)}
            disabled={busy}
            style={{
              padding: "8px 18px", borderRadius: "9px", flexShrink: 0,
              background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)",
              color: "var(--dd-text1)", fontSize: "0.8125rem", fontWeight: 600,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy ? "Joining…" : "Join"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function CommunitiesPage() {
  const [mounted,    setMounted]    = useState(false);
  const [checking,   setChecking]   = useState(true);
  const [profile,    setProfile]    = useState<UserProfile | null>(null);
  const [communities, setCommunities] = useState<MyCommunity[]>([]);
  const [error,       setError]      = useState("");
  const [busyId,      setBusyId]     = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(() => {
    if (!isAuthenticated()) { setChecking(false); return; }
    setChecking(true);
    Promise.all([profileApi.get(), communitiesApi.mine()])
      .then(([p, c]) => { setProfile(p); setCommunities(c); })
      .catch(() => setError("Could not load your communities. Is the backend running?"))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleJoin(id: number) {
    setBusyId(id);
    try {
      await communitiesApi.join(id);
      load();
    } catch { /* silent */ } finally { setBusyId(null); }
  }

  const eligible = profile ? COMMUNITY_ELIGIBLE_STATUSES.includes(profile.current_status) : false;

  return (
    <UserShell>
      <div style={{ minHeight: "100vh", background: "var(--dd-bg)" }}>
        <main className="dd-communities-main" style={{ margin: "0 auto", padding: "32px 20px 80px" }}>

          <div style={{ marginBottom: "24px" }}>
            <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.5rem,4vw,1.9rem)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--dd-text1)", marginBottom: "4px" }}>
              Specialty Communities
            </h1>
            <p style={{ fontSize: "0.875rem", color: "var(--dd-text3)" }}>
              Your PG communities, nationwide and by specialty.
            </p>
          </div>

          {!mounted || checking ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ height: "78px", borderRadius: "16px", background: "var(--dd-surface2)", animation: "dd-pulse 1.4s ease-in-out infinite", animationDelay: `${i * 0.1}s` }} />
              ))}
              <style>{`@keyframes dd-pulse{0%,100%{opacity:.35}50%{opacity:.65}}`}</style>
            </div>
          ) : !isAuthenticated() ? (
            <div style={{ textAlign: "center", padding: "56px 20px", borderRadius: "18px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)" }}>
              <p style={{ fontSize: "0.9rem", color: "var(--dd-text2)", marginBottom: "16px" }}>Sign in to see your communities.</p>
              <a href="/login" style={{ display: "inline-block", padding: "10px 22px", borderRadius: "10px", background: "linear-gradient(135deg,#7c3aed 0%,#0d9488 100%)", color: "#fff", fontSize: "0.875rem", fontWeight: 600, textDecoration: "none" }}>
                Sign In
              </a>
            </div>
          ) : error ? (
            <div style={{ padding: "14px 18px", borderRadius: "12px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", color: "var(--dd-danger)", fontSize: "0.875rem" }}>
              {error}
            </div>
          ) : !eligible ? (
            <div style={{ textAlign: "center", padding: "56px 20px", borderRadius: "18px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)" }}>
              <p style={{ fontSize: "0.9rem", color: "var(--dd-text2)", lineHeight: 1.6 }}>
                Specialty Communities are for <strong style={{ color: "var(--dd-text1)" }}>PG doctors, alumni, and faculty</strong>, not open to UG students.
              </p>
            </div>
          ) : communities.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 20px", borderRadius: "18px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)" }}>
              <p style={{ fontSize: "0.9rem", color: "var(--dd-text2)", lineHeight: 1.6, marginBottom: "16px" }}>
                Set your PG specialty on your profile to be placed into your communities.
              </p>
              <a href="/profile" style={{ display: "inline-block", padding: "9px 20px", borderRadius: "10px", background: "linear-gradient(135deg,var(--dd-teal),var(--dd-teal-hover))", color: "#fff", fontSize: "0.8125rem", fontWeight: 600, textDecoration: "none" }}>
                Complete Profile
              </a>
            </div>
          ) : (
            <>
              <div className="dd-communities-grid">
                {communities.map((c) => (
                  <CommunityCard key={c.id} community={c} onJoin={handleJoin} busy={busyId === c.id} />
                ))}
              </div>
              {!profile?.pg_department && (
                <p style={{ fontSize: "0.8125rem", color: "var(--dd-text3)", marginTop: "16px", textAlign: "center" }}>
                  Add your PG specialty on <a href="/profile" style={{ color: "var(--dd-teal)", textDecoration: "none" }}>your profile</a> to unlock your department communities.
                </p>
              )}
            </>
          )}
        </main>
      </div>

      <style>{`
        .dd-communities-main { max-width: 640px; }
        .dd-communities-grid { display: flex; flex-direction: column; gap: 14px; }
        @media (min-width: 900px) {
          .dd-communities-main { max-width: 1040px; }
          .dd-communities-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px; }
        }
      `}</style>
    </UserShell>
  );
}
