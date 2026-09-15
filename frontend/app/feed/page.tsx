"use client";

import { useState, useEffect, useRef } from "react";
import UserShell from "@/components/UserShell";
import CollegeCard from "@/components/colleges/CollegeCard";
import { collegeApi, type College, type Review } from "@/lib/collegeApi";
import { profileApi, type StatusValue } from "@/lib/profileApi";
import { isAuthenticated, FEED_PREFS_KEY } from "@/lib/auth";
import ReviewCard from "@/components/colleges/ReviewCard";
import { communitiesApi, type MyCommunity } from "@/lib/communitiesApi";
import { useQuickActions, QuickActionsModals, QuickActionsSidebar, FEED_GRID_CSS } from "@/components/QuickActionsSidebar";

/* ─────────────────────── section icons (SVG, not emoji — matches the
   app's established icon convention) ── */
function TrendingIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>
    </svg>
  );
}
function ClockIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
    </svg>
  );
}
function EmptyReviewsIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>
      <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
    </svg>
  );
}

/* ─────────────────────── types ── */
type Phase    = "journey" | "colleges" | "feed";
type EduLevel = "ug" | "pg" | "";

interface FeedPrefs {
  status:     StatusValue;
  highestEdu: EduLevel;
  ugCollege:  number | null;
  pgCollege:  number | null;
}

/* ─────────────────────── college fields logic ── */
function collegeFields(status: StatusValue, edu: EduLevel) {
  switch (status) {
    case "ug_aspirant":
    case "ug_student":
      return { showUg: true,  showPg: false, needsEdu: false };
    case "pg_aspirant":
      return { showUg: false, showPg: true,  needsEdu: false };
    case "pg_student":
      return { showUg: true,  showPg: true,  needsEdu: false };
    case "working_professional":
    case "alumni":
    case "faculty":
      if (!edu) return { showUg: false, showPg: false, needsEdu: true };
      return { showUg: true, showPg: edu === "pg", needsEdu: true };
    default:
      return { showUg: false, showPg: false, needsEdu: false };
  }
}

/* ─────────────────────── status card definitions ── */
const JOURNEY_CARDS = [
  {
    value: "ug_aspirant" as StatusValue,
    label: "UG Aspirant",
    sub:   "Seeking MBBS, BDS or Nursing",
    color: "#0d9488", rgb: "10,132,255",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21C12 21 4 13.5 4 8.5a8 8 0 0116 0C20 13.5 12 21 12 21z"/>
        <circle cx="12" cy="8.5" r="2.5"/>
      </svg>
    ),
  },
  {
    value: "ug_student" as StatusValue,
    label: "UG Student",
    sub:   "Studying MBBS, BDS or Nursing",
    color: "#30d158", rgb: "48,209,88",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
      </svg>
    ),
  },
  {
    value: "pg_aspirant" as StatusValue,
    label: "PG Aspirant",
    sub:   "Preparing for MD, MS or DNB",
    color: "#bf5af2", rgb: "191,90,242",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6"/>
        <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
      </svg>
    ),
  },
  {
    value: "pg_student" as StatusValue,
    label: "PG Student",
    sub:   "MD / MS / DM / MCh student",
    color: "#ff9f0a", rgb: "255,159,10",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/>
        <path d="M6 12v5c3 3 9 3 12 0v-5"/>
      </svg>
    ),
  },
  {
    value: "working_professional" as StatusValue,
    label: "Working Professional",
    sub:   "Doctor, faculty or resident",
    color: "#64d2ff", rgb: "100,210,255",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/>
        <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
        <line x1="12" y1="12" x2="12" y2="16"/>
        <line x1="10" y1="14" x2="14" y2="14"/>
      </svg>
    ),
  },
  {
    value: "alumni" as StatusValue,
    label: "Alumni",
    sub:   "Sharing experiences & reviews",
    color: "#ffd60a", rgb: "255,214,10",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
];

/* ─────────────────────── searchable college select ── */
function CollegeSelect({
  colleges, value, onChange, placeholder,
}: {
  colleges: College[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder: string;
}) {
  const [open,         setOpen]         = useState(false);
  const [query,        setQuery]        = useState("");
  const [highlighted,  setHighlighted]  = useState<number>(-1);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLUListElement>(null);

  const selectedCollege = colleges.find((c) => c.id === value) ?? null;

  const filtered = query.trim()
    ? colleges.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        (c.state ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : colleges;

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false); setQuery(""); setHighlighted(-1);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    if (highlighted >= 0 && listRef.current) {
      const el = listRef.current.children[highlighted] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlighted]);

  function openDropdown() {
    setOpen(true); setQuery(""); setHighlighted(-1);
    setTimeout(() => inputRef.current?.focus(), 0);
  }
  function selectItem(college: College) {
    onChange(college.id); setOpen(false); setQuery(""); setHighlighted(-1);
  }
  function clearSelection(e: React.MouseEvent) {
    e.stopPropagation(); onChange(null); setOpen(false); setQuery("");
  }
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (highlighted >= 0 && filtered[highlighted]) selectItem(filtered[highlighted]); }
    else if (e.key === "Escape") { setOpen(false); setQuery(""); }
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", userSelect: "none" }}>
      <div
        onClick={openDropdown}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 14px", borderRadius: "13px", cursor: "pointer",
          background: "var(--dd-input-bg)",
          border: `1px solid ${open ? "rgba(13,148,136,0.5)" : "var(--dd-border2)"}`,
          transition: "border-color 0.15s", minHeight: "46px",
        }}
      >
        <span style={{ fontSize: "0.9375rem", color: selectedCollege ? "var(--dd-text1)" : "var(--dd-text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {selectedCollege
            ? `${selectedCollege.name}${selectedCollege.state ? `, ${selectedCollege.state}` : ""}`
            : placeholder}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, marginLeft: "8px" }}>
          {selectedCollege && (
            <button
              onClick={clearSelection}
              title="Clear selection"
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "2px", color: "var(--dd-text3)", borderRadius: "4px" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--dd-text1)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--dd-text3)"; }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8"/>
              </svg>
            </button>
          )}
          <svg
            width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
            style={{ color: "var(--dd-text3)", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <path d="M4 6l4 4 4-4"/>
          </svg>
        </div>
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 100,
          background: "var(--dd-bg2)", border: "1px solid var(--dd-border2)",
          borderRadius: "14px", boxShadow: "var(--dd-shadow-lg)",
          overflow: "hidden",
        }}>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--dd-border)", display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "var(--dd-text3)" }}>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              id={`feed-college-search-${placeholder.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              name="college-search"
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHighlighted(0); }}
              onKeyDown={handleKeyDown}
              placeholder="Search college name or state…"
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                color: "var(--dd-text1)", fontSize: "0.875rem",
              }}
            />
            {query && (
              <button
                onClick={() => { setQuery(""); setHighlighted(-1); inputRef.current?.focus(); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dd-text3)", padding: 0, display: "flex", alignItems: "center" }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8"/>
                </svg>
              </button>
            )}
          </div>

          <ul
            ref={listRef}
            style={{ listStyle: "none", margin: 0, padding: "6px 0", maxHeight: "min(240px, 45vh)", overflowY: "auto" }}
          >
            {filtered.length === 0 ? (
              <li style={{ padding: "12px 16px", color: "var(--dd-text3)", fontSize: "0.875rem", textAlign: "center" }}>
                No colleges found
              </li>
            ) : (
              filtered.map((c, idx) => {
                const isActive  = c.id === value;
                const isHovered = idx === highlighted;
                return (
                  <li
                    key={c.id}
                    onClick={() => selectItem(c)}
                    onMouseEnter={() => setHighlighted(idx)}
                    style={{
                      padding: "10px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: isHovered ? "rgba(13,148,136,0.08)" : "transparent",
                      transition: "background 0.1s",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.875rem", color: isActive ? "#0d9488" : "var(--dd-text1)", fontWeight: isActive ? 600 : 400 }}>
                        {c.name}
                      </div>
                      {c.state && (
                        <div style={{ fontSize: "0.75rem", color: "var(--dd-text3)", marginTop: "2px" }}>{c.state}</div>
                      )}
                    </div>
                    {isActive && (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#0d9488" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                        <path d="M3 8l4 4 6-7"/>
                      </svg>
                    )}
                  </li>
                );
              })
            )}
          </ul>

          {filtered.length > 0 && (
            <div style={{ padding: "6px 14px 8px", borderTop: "1px solid var(--dd-border)", display: "flex", gap: "12px" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--dd-text4)" }}>↑↓ navigate</span>
              <span style={{ fontSize: "0.7rem", color: "var(--dd-text4)" }}>↵ select</span>
              <span style={{ fontSize: "0.7rem", color: "var(--dd-text4)" }}>esc close</span>
              {filtered.length < colleges.length && (
                <span style={{ fontSize: "0.7rem", color: "var(--dd-text4)", marginLeft: "auto" }}>{filtered.length} of {colleges.length}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════ PAGE ══════════════════════════════════════════*/
export default function FeedPage() {
  const [phase,           setPhase]           = useState<Phase>("journey");
  const [status,          setStatus]          = useState<StatusValue>("");
  const [highestEdu,      setHighestEdu]      = useState<EduLevel>("");
  const [ugCollege,       setUgCollege]       = useState<number | null>(null);
  const [pgCollege,       setPgCollege]       = useState<number | null>(null);
  const [colleges,        setColleges]        = useState<College[]>([]);
  const [collegesLoading, setCollegesLoading] = useState(true);
  const [error,           setError]           = useState("");
  const [mounted,         setMounted]         = useState(false);
  const [profileFetching, setProfileFetching] = useState(false);
  const [trending,        setTrending]        = useState<Review[]>([]);
  const [recent,          setRecent]          = useState<Review[]>([]);
  const [reviewsLoading,  setReviewsLoading]  = useState(true);
  const [myCommunities,       setMyCommunities]       = useState<MyCommunity[]>([]);
  const [communitiesLoading,  setCommunitiesLoading]  = useState(true);
  const { askState, setAskState, reviewTarget, setReviewTarget, checking, checkError, handleAction } = useQuickActions();

  const { showUg, showPg, needsEdu } = collegeFields(status, highestEdu);
  const ugColleges = colleges.filter((c) => c.is_ug);
  const pgColleges = colleges.filter((c) => c.is_pg);
  const selectedUgCollege = colleges.find((c) => c.id === ugCollege) ?? null;
  const selectedPgCollege = colleges.find((c) => c.id === pgCollege) ?? null;
  const selectedColleges  = [selectedUgCollege, selectedPgCollege].filter(Boolean) as College[];
  const journeyCard = JOURNEY_CARDS.find((c) => c.value === status);

  useEffect(() => {
    setMounted(true);
    collegeApi.list()
      .then(setColleges)
      .catch(() => {})
      .finally(() => setCollegesLoading(false));

    Promise.allSettled([collegeApi.trending(), collegeApi.recent()]).then(([t, r]) => {
      if (t.status === "fulfilled") setTrending(t.value);
      if (r.status === "fulfilled") setRecent(r.value);
      setReviewsLoading(false);
    });

    if (isAuthenticated()) {
      communitiesApi.mine()
        .then(setMyCommunities)
        .catch(() => {})
        .finally(() => setCommunitiesLoading(false));
    } else {
      setCommunitiesLoading(false);
    }

    function applyPrefs(p: FeedPrefs) {
      setStatus(p.status); setHighestEdu(p.highestEdu);
      setUgCollege(p.ugCollege); setPgCollege(p.pgCollege);
      if (p.status) setPhase("feed");
    }
    function tryStorage(): boolean {
      const raw = sessionStorage.getItem(FEED_PREFS_KEY);
      if (!raw) return false;
      try { applyPrefs(JSON.parse(raw)); return true; } catch { return false; }
    }
    if (tryStorage()) return;
    if (isAuthenticated()) {
      setProfileFetching(true);
      profileApi.get()
        .then((profile) => {
          if (profile.current_status) {
            const prefs: FeedPrefs = {
              status:     profile.current_status as StatusValue,
              highestEdu: (profile.highest_education as EduLevel) ?? "",
              ugCollege:  profile.ug_college ?? null,
              pgCollege:  profile.pg_college ?? null,
            };
            sessionStorage.setItem(FEED_PREFS_KEY, JSON.stringify(prefs));
            applyPrefs(prefs);
          }
        })
        .catch(() => {})
        .finally(() => setProfileFetching(false));
    }
  }, []);

  useEffect(() => {
    if (!mounted || !status) return;
    sessionStorage.setItem(FEED_PREFS_KEY, JSON.stringify({ status, highestEdu, ugCollege, pgCollege }));
  }, [mounted, status, highestEdu, ugCollege, pgCollege]);

  function selectStatus(v: StatusValue) {
    setStatus(v); setHighestEdu(""); setUgCollege(null); setPgCollege(null);
    if (v === "other") {
      sessionStorage.setItem(FEED_PREFS_KEY, JSON.stringify({ status: v, highestEdu: "", ugCollege: null, pgCollege: null }));
      setPhase("feed");
    } else { setPhase("colleges"); }
  }
  function handleEduChange(edu: EduLevel) { setHighestEdu(edu); setUgCollege(null); setPgCollege(null); }
  function showFeed() {
    setError("");
    if (needsEdu && !highestEdu) { setError("Please select your highest education level."); return; }
    setPhase("feed");
  }
  function resetPrefs() {
    sessionStorage.removeItem(FEED_PREFS_KEY);
    setStatus(""); setHighestEdu(""); setUgCollege(null); setPgCollege(null);
    setPhase("journey");
  }

  const collegeSectionTitle: Record<StatusValue, string> = {
    ug_aspirant:          "Which UG college are you targeting?",
    ug_student:           "Which college are you studying at?",
    pg_aspirant:          "Which PG college are you targeting?",
    pg_student:           "Which colleges are you at?",
    working_professional: "Which college(s) did you attend?",
    alumni:               "Which college(s) did you attend?",
    faculty:              "Which college(s) did you attend?",
    other:                "",
    "":                   "",
  };

  /* ── Loading skeleton ── */
  if (!mounted || profileFetching) {
    return (
      <UserShell>
        <main className="feed-main" style={{ maxWidth: "640px", margin: "0 auto", paddingTop: "52px", paddingLeft: "20px", paddingRight: "20px" }}>
          {[220, 160, 100].map((h, i) => (
            <div key={i} style={{
              height: h, borderRadius: "18px",
              background: "var(--dd-surface2)", marginBottom: "14px",
              animation: "pulse 1.5s ease-in-out infinite",
              animationDelay: `${i * 0.15}s`,
            }} />
          ))}
          <style>{`@keyframes pulse { 0%,100%{opacity:.25} 50%{opacity:.55} }`}</style>
        </main>
      </UserShell>
    );
  }

  return (
    <UserShell>
      <div style={{ position: "fixed", top: "-200px", left: "50%", transform: "translateX(-50%)", width: "800px", height: "800px", background: "radial-gradient(circle,rgba(13,148,136,0.07) 0%,transparent 65%)", filter: "blur(60px)", pointerEvents: "none", zIndex: 0 }} />

      <main className={`feed-main${phase === "feed" ? " feed-main--wide" : ""}`} style={{ position: "relative", zIndex: 1, paddingLeft: "20px", paddingRight: "20px" }}>

        {/* ══ PHASE: JOURNEY SELECTION ══ */}
        {phase === "journey" && (
          <>
            <style>{`
              @keyframes dd-slide-up {
                from { opacity: 0; transform: translateY(14px); }
                to   { opacity: 1; transform: translateY(0); }
              }
              @media (prefers-reduced-motion: reduce) {
                @keyframes dd-slide-up { from { opacity: 0; } to { opacity: 1; } }
              }
            `}</style>

            <div className="feed-heading-section" style={{ animation: "dd-slide-up 0.38s cubic-bezier(0.22,1,0.36,1) both" }}>
              <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0d9488", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>
                Personalise your feed
              </p>
              <h1 className="feed-heading" style={{ fontSize: "clamp(1.6rem,5vw,2.2rem)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.15, color: "var(--dd-text1)", marginBottom: "12px" }}>
                What stage are you at?
              </h1>
              <p style={{ fontSize: "0.9375rem", color: "var(--dd-text3)", lineHeight: 1.6 }}>
                We&apos;ll show you reviews and discussions most relevant to your stage.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {JOURNEY_CARDS.map((card, index) => (
                <button
                  key={card.value}
                  onClick={() => selectStatus(card.value)}
                  style={{
                    display: "flex", alignItems: "center", gap: "16px",
                    padding: "16px 18px", borderRadius: "16px", textAlign: "left",
                    background: "var(--dd-surface2)",
                    border: "1px solid var(--dd-border2)",
                    cursor: "pointer", width: "100%",
                    transition: "background 0.18s, border-color 0.18s, box-shadow 0.18s",
                    animation: "dd-slide-up 0.42s cubic-bezier(0.22,1,0.36,1) both",
                    animationDelay: `${0.06 + index * 0.05}s`,
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget;
                    el.style.background  = `rgba(${card.rgb},0.08)`;
                    el.style.borderColor = `rgba(${card.rgb},0.30)`;
                    el.style.boxShadow   = `0 4px 20px rgba(15,23,42,0.08), inset 0 1px 0 rgba(${card.rgb},0.08)`;
                    const chevron = el.querySelector<SVGElement>(".card-chevron");
                    if (chevron) chevron.style.color = card.color;
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget;
                    el.style.background  = "var(--dd-surface2)";
                    el.style.borderColor = "var(--dd-border2)";
                    el.style.boxShadow   = "none";
                    const chevron = el.querySelector<SVGElement>(".card-chevron");
                    if (chevron) chevron.style.color = "var(--dd-text4)";
                  }}
                >
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "12px", flexShrink: 0,
                    background: `rgba(${card.rgb},0.12)`,
                    border: `1px solid rgba(${card.rgb},0.22)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: card.color,
                  }}>
                    {card.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--dd-text1)", marginBottom: "3px", letterSpacing: "-0.02em" }}>
                      {card.label}
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--dd-text3)", lineHeight: 1.4 }}>
                      {card.sub}
                    </div>
                  </div>
                  <svg
                    width="16" height="16" viewBox="0 0 16 16" fill="none"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
                    className="card-chevron"
                    style={{ flexShrink: 0, transition: "color 0.18s ease", color: "var(--dd-text4)" }}
                  >
                    <path d="M6 4l4 4-4 4"/>
                  </svg>
                </button>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "14px 0 12px" }}>
              <div style={{ flex: 1, height: "1px", background: "var(--dd-border)" }} />
              <span style={{ color: "var(--dd-text3)", fontSize: "0.8125rem" }}>or</span>
              <div style={{ flex: 1, height: "1px", background: "var(--dd-border)" }} />
            </div>
            <button
              onClick={() => selectStatus("other")}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "100%", padding: "13px 18px", borderRadius: "14px",
                border: "1px dashed var(--dd-border2)",
                background: "var(--dd-surface)",
                cursor: "pointer",
                color: "var(--dd-text3)", fontSize: "0.875rem",
                transition: "background 0.18s, border-color 0.18s, color 0.18s",
                animation: "dd-slide-up 0.42s cubic-bezier(0.22,1,0.36,1) both",
                animationDelay: "0.42s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--dd-text2)";
                e.currentTarget.style.borderColor = "var(--dd-border2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--dd-text3)";
                e.currentTarget.style.borderColor = "var(--dd-border2)";
              }}
            >
              Just browsing
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ opacity: 0.5, flexShrink: 0 }}>
                <path d="M6 4l4 4-4 4"/>
              </svg>
            </button>
          </>
        )}

        {/* ══ PHASE: COLLEGE SELECTION ══ */}
        {phase === "colleges" && (
          <>
            <button
              onClick={() => { setPhase("journey"); setError(""); }}
              style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", color: "var(--dd-text3)", fontSize: "0.875rem", padding: "8px 0", marginBottom: "20px" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-text2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)"; }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 12L6 8l4-4"/></svg>
              Change journey
            </button>

            {journeyCard && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 14px", borderRadius: "100px", background: `rgba(${journeyCard.rgb},0.08)`, border: `1px solid rgba(${journeyCard.rgb},0.22)`, marginBottom: "20px" }}>
                <span style={{ color: journeyCard.color }}>{journeyCard.icon}</span>
                <span style={{ fontSize: "0.8125rem", color: journeyCard.color, fontWeight: 600 }}>{journeyCard.label}</span>
              </div>
            )}

            <h2 style={{ fontSize: "clamp(1.3rem,4vw,1.7rem)", fontWeight: 700, letterSpacing: "-0.04em", color: "var(--dd-text1)", marginBottom: "8px" }}>
              {collegeSectionTitle[status]}
            </h2>
            <p style={{ fontSize: "0.875rem", color: "var(--dd-text3)", marginBottom: "28px", lineHeight: 1.5 }}>
              Select your college to personalise your feed. You can change this anytime.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {needsEdu && (
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "10px" }}>
                    Highest Education Completed
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    {(["ug", "pg"] as EduLevel[]).filter(Boolean).map((edu) => {
                      const sel = highestEdu === edu;
                      return (
                        <button key={edu} type="button" onClick={() => handleEduChange(edu as "ug" | "pg")}
                          style={{
                            flex: 1, padding: "12px", borderRadius: "13px",
                            background: sel ? "rgba(13,148,136,0.1)" : "var(--dd-surface)",
                            border: `1px solid ${sel ? "rgba(13,148,136,0.36)" : "var(--dd-border)"}`,
                            color: sel ? "#0d9488" : "var(--dd-text3)",
                            fontSize: "0.875rem", fontWeight: sel ? 600 : 500, cursor: "pointer", transition: "all 0.15s",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                          }}>
                          {sel && <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 8l4 4 6-7"/></svg>}
                          {edu === "ug" ? "Undergraduate (UG)" : "Postgraduate (PG)"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {showUg && ugColleges.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "10px" }}>
                    {status === "ug_aspirant" ? "Target UG College" : status === "pg_student" || status === "alumni" || status === "working_professional" || status === "faculty" ? "UG College" : "Your College"}
                  </div>
                  <CollegeSelect colleges={ugColleges} value={ugCollege} onChange={setUgCollege} placeholder="Select UG college…" />
                </div>
              )}

              {showPg && pgColleges.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "10px" }}>
                    {status === "pg_aspirant" ? "Target PG College" : status === "pg_student" ? "Current PG College" : "PG College"}
                  </div>
                  <CollegeSelect colleges={pgColleges} value={pgCollege} onChange={setPgCollege} placeholder="Select PG college…" />
                </div>
              )}
            </div>

            {error && (
              <div style={{ marginTop: "14px", padding: "10px 14px", borderRadius: "10px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", color: "var(--dd-danger)", fontSize: "0.8125rem" }}>
                {error}
              </div>
            )}

            <button
              onClick={showFeed}
              style={{
                width: "100%", marginTop: "24px", padding: "13px", borderRadius: "14px",
                background: "linear-gradient(135deg,#0d9488 0%,#0f766e 100%)",
                border: "none", color: "#fff", fontSize: "0.9375rem", fontWeight: 600,
                cursor: "pointer", boxShadow: "0 4px 24px rgba(13,148,136,0.28)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              }}
            >
              Show my feed
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
            </button>

            <p style={{ textAlign: "center", marginTop: "14px", fontSize: "0.8125rem", color: "var(--dd-text4)" }}>
              You can skip college selection and change it later.
            </p>
          </>
        )}

        {/* ══ PHASE: FEED — "other" ══ */}
        {phase === "feed" && (
          <div className="feed-grid">
          <div className="feed-grid-main">
        {status === "other" && (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "36px", gap: "12px", flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0d9488", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>
                  Your feed
                </p>
                <h1 style={{ fontSize: "clamp(1.5rem,5vw,2.1rem)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.2, color: "var(--dd-text1)" }}>
                  Pick a question.<br />Explore deeper.
                </h1>
                <p style={{ fontSize: "0.875rem", color: "var(--dd-text3)", marginTop: "10px", lineHeight: 1.6 }}>
                  Questions the medical community is asking right now.
                </p>
              </div>
              <button
                onClick={resetPrefs}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "10px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border)", color: "var(--dd-text3)", fontSize: "0.8125rem", cursor: "pointer", flexShrink: 0, transition: "all 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-text1)"; e.currentTarget.style.background = "var(--dd-border)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)"; e.currentTarget.style.background = "var(--dd-surface2)"; }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 4h14M1 8h14M1 12h14"/></svg>
                Change preferences
              </button>
            </div>

            {reviewsLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[1,2,3].map((i) => (
                  <div key={i} style={{ height: "160px", borderRadius: "18px", background: "var(--dd-surface2)", animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />
                ))}
                <style>{`@keyframes pulse{0%,100%{opacity:.25}50%{opacity:.55}}`}</style>
              </div>
            ) : (
              <>
                {trending.length > 0 && (
                  <div style={{ marginBottom: "28px" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--dd-warning)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <TrendingIcon /> Trending This Week
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {trending.slice(0, 5).map((review) => <ReviewCard key={review.id} review={review} />)}
                    </div>
                  </div>
                )}
                {recent.length > 0 && (
                  <div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "14px" }}>
                      <ClockIcon /> Recent Reviews
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {recent.slice(0, 8).map((review) => <ReviewCard key={review.id} review={review} />)}
                    </div>
                  </div>
                )}
                {trending.length === 0 && recent.length === 0 && (
                  <div style={{ textAlign: "center", padding: "48px 0" }}>
                    <div style={{ color: "var(--dd-text4)", marginBottom: "12px", display: "flex", justifyContent: "center" }}><EmptyReviewsIcon /></div>
                    <p style={{ fontSize: "0.9375rem", color: "var(--dd-text3)", marginBottom: "6px" }}>No reviews yet</p>
                    <p style={{ fontSize: "0.8125rem", color: "var(--dd-text4)" }}>Browse a college and be the first to leave a review!</p>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ══ PHASE: FEED — college-specific ══ */}
        {status !== "other" && (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px", gap: "12px", flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0d9488", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>
                  Your personalised feed
                </p>
                <h1 style={{ fontSize: "clamp(1.4rem,4vw,1.8rem)", fontWeight: 700, letterSpacing: "-0.04em", color: "var(--dd-text1)" }}>
                  {journeyCard ? journeyCard.label : "My"} Feed
                </h1>
              </div>
              <button
                onClick={resetPrefs}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "10px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border)", color: "var(--dd-text3)", fontSize: "0.8125rem", cursor: "pointer", flexShrink: 0, transition: "all 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-text1)"; e.currentTarget.style.background = "var(--dd-border)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)"; e.currentTarget.style.background = "var(--dd-surface2)"; }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 4h14M1 8h14M1 12h14"/></svg>
                Change preferences
              </button>
            </div>

            {selectedColleges.length > 0 && (
              <div style={{ marginBottom: "32px" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "14px" }}>
                  Your college{selectedColleges.length > 1 ? "s" : ""}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: selectedColleges.length > 1 ? "repeat(auto-fill,minmax(260px,1fr))" : "1fr", gap: "14px" }}>
                  {selectedColleges.map((college) => (
                    <CollegeCard key={college.id} college={college} isSuperAdmin={false} onEdit={() => {}} onDelete={() => {}} />
                  ))}
                </div>
              </div>
            )}

            {!collegesLoading && selectedColleges.length === 0 && (
              <div style={{ padding: "18px 20px", borderRadius: "14px", background: "rgba(13,148,136,0.05)", border: "1px solid rgba(13,148,136,0.15)", marginBottom: "28px", display: "flex", alignItems: "center", gap: "12px" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <p style={{ fontSize: "0.875rem", color: "var(--dd-text2)", margin: 0 }}>
                  No college selected.{" "}
                  <button onClick={() => setPhase("colleges")} style={{ background: "none", border: "none", color: "#0d9488", cursor: "pointer", fontWeight: 500, fontSize: "0.875rem", padding: 0 }}>
                    Pick your college
                  </button>{" "}
                  to personalise further.
                </p>
              </div>
            )}

            {reviewsLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[1,2,3].map((i) => (
                  <div key={i} style={{ height: "160px", borderRadius: "18px", background: "var(--dd-surface2)", animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />
                ))}
                <style>{`@keyframes pulse{0%,100%{opacity:.25}50%{opacity:.55}}`}</style>
              </div>
            ) : (
              <>
                {trending.length > 0 && (
                  <div style={{ marginBottom: "28px" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--dd-warning)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <TrendingIcon /> Trending This Week
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {trending.slice(0, 5).map((review) => <ReviewCard key={review.id} review={review} />)}
                    </div>
                  </div>
                )}
                {recent.length > 0 && (
                  <div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <ClockIcon /> Recent Reviews
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {recent.slice(0, 10).map((review) => <ReviewCard key={review.id} review={review} />)}
                    </div>
                  </div>
                )}
                {trending.length === 0 && recent.length === 0 && (
                  <div style={{ textAlign: "center", padding: "48px 0" }}>
                    <div style={{ color: "var(--dd-text4)", marginBottom: "12px", display: "flex", justifyContent: "center" }}><EmptyReviewsIcon /></div>
                    <p style={{ fontSize: "0.9375rem", color: "var(--dd-text3)", marginBottom: "6px" }}>No reviews yet</p>
                    <p style={{ fontSize: "0.8125rem", color: "var(--dd-text4)" }}>Browse a college and be the first to leave a review!</p>
                  </div>
                )}
              </>
            )}
          </>
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
        )}
      </main>

      <QuickActionsModals askState={askState} setAskState={setAskState} reviewTarget={reviewTarget} setReviewTarget={setReviewTarget} />

      <style>{`
        .feed-main { max-width: 640px; margin: 0 auto; }
        .feed-main.feed-main--wide { max-width: 640px; }
        @media (min-width: 1100px) {
          .feed-main.feed-main--wide { max-width: 1040px; }
        }
        ${FEED_GRID_CSS}
      `}</style>
    </UserShell>
  );
}
