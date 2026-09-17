"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getUser, isAuthenticated } from "@/lib/auth";
import { collegeApi, College } from "@/lib/collegeApi";
import { profileApi } from "@/lib/profileApi";
import { INDIA_STATES, INDIA_UNION_TERRITORIES } from "@/lib/indiaStates";
import UserShell from "@/components/UserShell";
import CollegeCard from "@/components/colleges/CollegeCard";
import CollegeFormModal from "@/components/colleges/CollegeFormModal";
import DeleteCollegeModal from "@/components/colleges/DeleteCollegeModal";

interface SessionUser { id: number; email: string; full_name: string; role: string; }

type Level       = "all" | "ug" | "pg";
type Course      = "all" | "mbbs" | "dental" | "nursing";
type CollegeType = "all" | "govt" | "private";

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 16px", borderRadius: "20px",
        fontSize: "0.8125rem", fontWeight: 500,
        cursor: "pointer", transition: "all 0.15s",
        background: active ? "linear-gradient(135deg,#7c3aed 0%,#0d9488 100%)" : "var(--dd-surface2)",
        border: active ? "1px solid transparent" : "1px solid var(--dd-border)",
        color: active ? "#fff" : "var(--dd-text2)",
        boxShadow: active ? "0 2px 12px rgba(124,58,237,0.28)" : "none",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function StateDropdown({
  value, onChange, states, territories,
}: {
  value: string;
  onChange: (v: string) => void;
  states: string[];
  territories: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const label = value || "All States";
  const active = !!value;

  function pick(v: string) { onChange(v); setOpen(false); }

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: "6px",
          padding: "6px 28px 6px 12px", borderRadius: "20px",
          fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
          background: active ? "linear-gradient(135deg,#7c3aed 0%,#0d9488 100%)" : "var(--dd-surface2)",
          border: active ? "1px solid transparent" : "1px solid var(--dd-border)",
          color: active ? "#fff" : "var(--dd-text2)",
          boxShadow: active ? "0 2px 12px rgba(124,58,237,0.28)" : "none",
          whiteSpace: "nowrap", minWidth: "130px", transition: "all 0.15s",
          position: "relative",
        }}
      >
        {label}
        <svg style={{ position: "absolute", right: "9px", top: "50%", transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`, transition: "transform 0.2s", pointerEvents: "none" }}
          width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="2,4 7,10 12,4"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 999,
          background: "var(--dd-bg2)", border: "1px solid var(--dd-border2)",
          borderRadius: "14px", padding: "6px 0",
          minWidth: "200px", maxHeight: "260px", overflowY: "auto",
          boxShadow: "var(--dd-shadow-lg)",
        }}>
          <button type="button" onClick={() => pick("")}
            style={{
              width: "100%", textAlign: "left", padding: "8px 14px",
              background: !value ? "rgba(124,58,237,0.15)" : "none",
              border: "none", color: !value ? "#7c3aed" : "var(--dd-text2)",
              fontSize: "0.8375rem", cursor: "pointer", fontWeight: !value ? 600 : 400,
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => { if (value) e.currentTarget.style.background = "var(--dd-surface2)"; }}
            onMouseLeave={(e) => { if (value) e.currentTarget.style.background = "none"; }}
          >
            All States
          </button>

          <div style={{ padding: "6px 14px 4px", fontSize: "0.68rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.07em", textTransform: "uppercase" }}>States</div>
          {states.map((s) => (
            <button key={s} type="button" onClick={() => pick(s)}
              style={{
                width: "100%", textAlign: "left", padding: "7px 14px",
                background: value === s ? "rgba(124,58,237,0.15)" : "none",
                border: "none", color: value === s ? "#7c3aed" : "var(--dd-text1)",
                fontSize: "0.8375rem", cursor: "pointer", fontWeight: value === s ? 600 : 400,
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => { if (value !== s) e.currentTarget.style.background = "var(--dd-surface2)"; }}
              onMouseLeave={(e) => { if (value !== s) e.currentTarget.style.background = "none"; }}
            >
              {s}
            </button>
          ))}

          <div style={{ padding: "6px 14px 4px", fontSize: "0.68rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.07em", textTransform: "uppercase", borderTop: "1px solid var(--dd-border)", marginTop: "4px" }}>Union Territories</div>
          {territories.map((s) => (
            <button key={s} type="button" onClick={() => pick(s)}
              style={{
                width: "100%", textAlign: "left", padding: "7px 14px",
                background: value === s ? "rgba(124,58,237,0.15)" : "none",
                border: "none", color: value === s ? "#7c3aed" : "var(--dd-text1)",
                fontSize: "0.8375rem", cursor: "pointer", fontWeight: value === s ? 600 : 400,
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => { if (value !== s) e.currentTarget.style.background = "var(--dd-surface2)"; }}
              onMouseLeave={(e) => { if (value !== s) e.currentTarget.style.background = "none"; }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CollegesPage() {
  const router       = useRouter();
  // Read via window.location rather than next/navigation's useSearchParams()
  // — that hook requires the reading component to sit inside a <Suspense>
  // boundary (Next.js opts a route out of static rendering otherwise, which
  // breaks `next build`), and wrapping just to read one boolean flag isn't
  // worth it here. Starts `false` (matching the server-rendered pass, which
  // has no location to read) and is set client-side in the effect below —
  // same "flip true only after mount" technique already used for
  // `checkingDefault` right below, for the same SSR/hydration reason.
  const [showAll, setShowAll] = useState(false);

  const [user, setUser]               = useState<SessionUser | null>(null);
  const [mounted, setMounted]         = useState(false);
  const [colleges, setColleges]       = useState<College[]>([]);
  const [loading, setLoading]         = useState(true);
  const [fetchErr, setFetchErr]       = useState<string | null>(null);
  const [search, setSearch]           = useState("");
  const [level, setLevel]             = useState<Level>("all");
  const [course, setCourse]           = useState<Course>("all");
  const [collegeType, setCollegeType] = useState<CollegeType>("all");
  const [stateFilter, setStateFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [formOpen, setFormOpen]       = useState(false);
  const [editTarget, setEditTarget]   = useState<College | null>(null);
  const [delTarget, setDelTarget]     = useState<College | null>(null);

  // ── Default-to-own-college: if the signed-in user has a UG/PG college on
  // their profile, send them straight to it instead of the full directory.
  // `?all=1` (used by the "Browse all colleges" link and the detail page's
  // breadcrumb) always skips this and shows the list.
  // Starts `false` (matching the server-rendered pass, which never knows
  // about sessionStorage) and only flips true client-side inside an effect —
  // computing it from isAuthenticated() directly in useState's initializer
  // would run during SSR too and produce a different result there than on
  // the client, breaking hydration.
  const [checkingDefault, setCheckingDefault] = useState(false);

  useEffect(() => {
    setMounted(true);
    setShowAll(new URLSearchParams(window.location.search).get("all") === "1");
    if (isAuthenticated()) setUser(getUser<SessionUser>());
  }, []);

  useEffect(() => {
    // Re-reads location directly rather than trusting the `showAll` state
    // above: both effects fire in the same pass on initial mount, before
    // that state update has taken effect, so relying on it here would let
    // this run once against a stale (pre-mount) value of `showAll` and
    // briefly kick off the own-college redirect even when the URL already
    // said ?all=1.
    if (new URLSearchParams(window.location.search).get("all") === "1" || !isAuthenticated()) return;
    setCheckingDefault(true);
    let cancelled = false;
    profileApi.get()
      .then((profile) => {
        if (cancelled) return;
        const ownCollegeId = profile.pg_college ?? profile.ug_college;
        if (ownCollegeId) { router.replace(`/colleges/${ownCollegeId}`); return; }
        setCheckingDefault(false);
      })
      .catch(() => { if (!cancelled) setCheckingDefault(false); });
    return () => { cancelled = true; };
  }, [showAll, router]);

  const superAdmin = user?.role === "super_admin";

  const loadColleges = useCallback(async () => {
    setLoading(true); setFetchErr(null);
    try { setColleges(await collegeApi.list()); }
    catch (e: unknown) { setFetchErr(e instanceof Error ? e.message : "Failed to load colleges."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadColleges(); }, [loadColleges]);

  const filtered = colleges
    .filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.location.toLowerCase().includes(search.toLowerCase()),
    )
    .filter((c) => { if (level === "ug") return c.is_ug; if (level === "pg") return c.is_pg; return true; })
    .filter((c) => { if (course === "mbbs") return c.has_mbbs; if (course === "dental") return c.has_dental; if (course === "nursing") return c.has_nursing; return true; })
    .filter((c) => { if (collegeType === "govt") return c.college_type === "govt"; if (collegeType === "private") return c.college_type === "private"; return true; })
    .filter((c) => { if (stateFilter) return c.state === stateFilter; return true; });

  const hasActiveFilter   = level !== "all" || course !== "all" || collegeType !== "all" || stateFilter !== "" || search !== "";
  const activeFilterCount = (level !== "all" ? 1 : 0) + (course !== "all" ? 1 : 0) + (collegeType !== "all" ? 1 : 0) + (stateFilter !== "" ? 1 : 0);

  function clearFilters() { setLevel("all"); setCourse("all"); setCollegeType("all"); setStateFilter(""); setSearch(""); }

  const accessBadge = mounted && superAdmin
    ? { label: "Read & Write", color: "#7c3aed", bg: "rgba(124,58,237,0.12)", border: "rgba(124,58,237,0.25)" }
    : null;

  if (checkingDefault) {
    return (
      <UserShell>
        <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: "50%", border: "2.5px solid var(--dd-border2)", borderTopColor: "#0d9488", animation: "dd-spin 0.7s linear infinite" }} />
          <style>{`@keyframes dd-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </UserShell>
    );
  }

  return (
    <UserShell>
      <div style={{ position: "fixed", top: "-200px", left: "50%", transform: "translateX(-50%)", width: "800px", height: "800px", background: "radial-gradient(circle, rgba(13,148,136,0.05) 0%, transparent 65%)", filter: "blur(60px)", pointerEvents: "none", zIndex: 0 }} />

      <main style={{ position: "relative", zIndex: 1, maxWidth: "1100px", margin: "0 auto", padding: "36px 20px 64px" }}>

        <div style={{ marginBottom: "28px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h1 style={{ fontSize: "clamp(1.6rem,4vw,2rem)", fontWeight: 700, letterSpacing: "-0.04em", marginBottom: "6px", color: "var(--dd-text1)" }}>
              College Information
            </h1>
            <p style={{ fontSize: "0.9rem", color: "var(--dd-text3)" }}>
              {loading ? "Loading…" : hasActiveFilter
                ? (
                  <>
                    <span style={{ color: "var(--dd-text1)", fontWeight: 600 }}>{filtered.length}</span>
                    {" "}result{filtered.length !== 1 ? "s" : ""} · {colleges.length} total
                    {" "}
                    <button onClick={clearFilters} style={{ background: "none", border: "none", color: "var(--dd-danger)", fontSize: "0.9rem", cursor: "pointer", padding: 0, fontWeight: 500 }}>
                      Clear
                    </button>
                  </>
                )
                : `${colleges.length} college${colleges.length !== 1 ? "s" : ""} registered on the platform`
              }
            </p>
          </div>
          {accessBadge && (
            <span style={{
              fontSize: "0.6875rem", padding: "4px 10px", borderRadius: "20px",
              background: accessBadge.bg, border: `1px solid ${accessBadge.border}`,
              color: accessBadge.color, fontWeight: 500, letterSpacing: "0.02em",
              display: "inline-flex", alignItems: "center", gap: "5px", alignSelf: "flex-start",
            }}>
              <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "currentColor" }} />
              {accessBadge.label}
            </span>
          )}
        </div>

        {/* Search + Filter toggle */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "10px" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: "460px" }}>
            <svg style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--dd-text3)", pointerEvents: "none" }}
              width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="9" cy="9" r="6"/><line x1="14" y1="14" x2="18" y2="18"/>
            </svg>
            <input
              id="colleges-search" name="colleges-search"
              type="search" placeholder="Search by name or location…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px 10px 36px", borderRadius: "10px",
                background: "var(--dd-input-bg)", border: "1px solid var(--dd-border)",
                color: "var(--dd-text1)", fontSize: "0.875rem", outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          <button
            onClick={() => setFiltersOpen((o) => !o)}
            style={{
              display: "flex", alignItems: "center", gap: "7px",
              padding: "10px 16px", borderRadius: "10px", cursor: "pointer",
              background: filtersOpen ? "rgba(124,58,237,0.12)" : "var(--dd-surface2)",
              border: `1px solid ${filtersOpen ? "rgba(124,58,237,0.35)" : "var(--dd-border)"}`,
              color: filtersOpen ? "#7c3aed" : "var(--dd-text2)",
              fontSize: "0.875rem", fontWeight: 500,
              transition: "all 0.15s", flexShrink: 0,
            }}
            onMouseEnter={(e) => { if (!filtersOpen) { e.currentTarget.style.background = "var(--dd-border)"; e.currentTarget.style.color = "var(--dd-text1)"; }}}
            onMouseLeave={(e) => { if (!filtersOpen) { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text2)"; }}}
          >
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="4" y1="6" x2="16" y2="6"/>
              <line x1="4" y1="10" x2="16" y2="10"/>
              <line x1="4" y1="14" x2="16" y2="14"/>
              <circle cx="8"  cy="6"  r="2" fill="currentColor" stroke="none"/>
              <circle cx="13" cy="10" r="2" fill="currentColor" stroke="none"/>
              <circle cx="7"  cy="14" r="2" fill="currentColor" stroke="none"/>
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span style={{
                minWidth: "18px", height: "18px", borderRadius: "9px",
                background: "linear-gradient(135deg,#7c3aed,#0d9488)",
                color: "#fff", fontSize: "0.7rem", fontWeight: 700,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                padding: "0 5px",
              }}>
                {activeFilterCount}
              </span>
            )}
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              style={{ transition: "transform 0.2s", transform: filtersOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
              <polyline points="2,4 7,10 12,4"/>
            </svg>
          </button>
        </div>

        {/* Collapsible filter panel */}
        <div style={{
          overflow: filtersOpen ? "visible" : "hidden",
          maxHeight: filtersOpen ? "400px" : "0px",
          opacity: filtersOpen ? 1 : 0,
          transition: "max-height 0.28s ease, opacity 0.2s ease",
          marginBottom: filtersOpen ? "20px" : "4px",
        }}>
          <div style={{
            padding: "14px 16px", borderRadius: "14px",
            background: "var(--dd-surface)", border: "1px solid var(--dd-border)",
            display: "flex", flexDirection: "column", gap: "10px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.07em", textTransform: "uppercase", minWidth: "40px" }}>Level</span>
              <div style={{ display: "flex", gap: "6px" }}>
                {(["all", "ug", "pg"] as Level[]).map((v) => (
                  <FilterPill key={v} active={level === v} onClick={() => setLevel(v)}>
                    {v === "all" ? "All" : v.toUpperCase()}
                  </FilterPill>
                ))}
              </div>
              <div className="dd-vsep" style={{ width: "1px", height: "20px", background: "var(--dd-border2)", alignSelf: "center", flexShrink: 0 }} />
              <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.07em", textTransform: "uppercase", minWidth: "32px" }}>Type</span>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {(["all", "govt", "private"] as CollegeType[]).map((v) => (
                  <FilterPill key={v} active={collegeType === v} onClick={() => setCollegeType(v)}>
                    {v === "all" ? "All" : v === "govt" ? "Govt" : "Private"}
                  </FilterPill>
                ))}
              </div>
            </div>

            <div style={{ height: "1px", background: "var(--dd-border)" }} />

            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.07em", textTransform: "uppercase", minWidth: "44px" }}>Course</span>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {(["all", "mbbs", "dental", "nursing"] as Course[]).map((v) => (
                  <FilterPill key={v} active={course === v} onClick={() => setCourse(v)}>
                    {v === "all" ? "All" : v === "mbbs" ? "MBBS" : v === "dental" ? "Dental" : "Nursing"}
                  </FilterPill>
                ))}
              </div>
              <div className="dd-vsep" style={{ width: "1px", height: "20px", background: "var(--dd-border2)", alignSelf: "center", flexShrink: 0 }} />
              <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.07em", textTransform: "uppercase", minWidth: "36px" }}>State</span>
              <StateDropdown
                value={stateFilter}
                onChange={setStateFilter}
                states={INDIA_STATES}
                territories={INDIA_UNION_TERRITORIES}
              />
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--dd-danger)", fontSize: "0.78rem", fontWeight: 500, padding: 0,
                    display: "flex", alignItems: "center", gap: "4px",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.7"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                >
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <line x1="2" y1="2" x2="12" y2="12"/><line x1="12" y1="2" x2="2" y2="12"/>
                  </svg>
                  Clear all
                </button>
              )}
            </div>
          </div>
        </div>

        {loading && (
          <div style={{ padding: "60px", textAlign: "center", color: "var(--dd-text3)" }}>Loading colleges…</div>
        )}

        {!loading && fetchErr && (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <p style={{ color: "var(--dd-danger)", marginBottom: "12px" }}>{fetchErr}</p>
            <button onClick={loadColleges} style={{
              padding: "8px 16px", borderRadius: "8px",
              background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)",
              color: "var(--dd-text2)", cursor: "pointer",
            }}>Retry</button>
          </div>
        )}

        {!loading && !fetchErr && filtered.length === 0 && (
          <div style={{ padding: "80px 32px", textAlign: "center" }}>
            <div style={{
              width: "56px", height: "56px", borderRadius: "16px",
              background: "var(--dd-surface)", border: "1px solid var(--dd-border)",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
            }}>
              <svg width="26" height="26" viewBox="0 0 34 34" fill="none">
                <path d="M17 4L3 11l14 7 14-7-14-7z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" fill="none" style={{ color: "var(--dd-text3)" }}/>
                <path d="M3 11v10l14 7 14-7V11" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" fill="none" style={{ color: "var(--dd-text3)" }}/>
              </svg>
            </div>
            <p style={{ color: "var(--dd-text2)", fontWeight: 500, marginBottom: "4px" }}>
              {hasActiveFilter ? "No colleges match these filters." : "No colleges yet."}
            </p>
            {hasActiveFilter ? (
              <button onClick={clearFilters} style={{
                marginTop: "10px", padding: "8px 16px", borderRadius: "8px",
                background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)",
                color: "var(--dd-text2)", cursor: "pointer", fontSize: "0.875rem",
              }}>Clear filters</button>
            ) : superAdmin ? (
              <p style={{ color: "var(--dd-text3)", fontSize: "0.875rem" }}>
                Go to <strong style={{ color: "var(--dd-text2)" }}>Add College</strong> from the Admin dashboard to register the first one.
              </p>
            ) : null}
          </div>
        )}

        {!loading && !fetchErr && filtered.length > 0 && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))", gap: "16px" }}>
              {filtered.map((c) => (
                <CollegeCard
                  key={c.id} college={c}
                  isSuperAdmin={superAdmin}
                  onEdit={(col) => { setEditTarget(col); setFormOpen(true); }}
                  onDelete={(col) => setDelTarget(col)}
                />
              ))}
            </div>
            <p style={{ marginTop: "16px", fontSize: "0.8125rem", color: "var(--dd-text3)" }}>
              Showing {filtered.length} of {colleges.length} college{colleges.length !== 1 ? "s" : ""}
              {hasActiveFilter && " · filters active"}
            </p>
          </>
        )}
      </main>

      <CollegeFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        initial={editTarget}
        onSaved={(saved) => {
          setColleges((prev) => editTarget ? prev.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...prev]);
          setFormOpen(false); setEditTarget(null);
        }}
      />
      <DeleteCollegeModal
        college={delTarget}
        onClose={() => setDelTarget(null)}
        onDeleted={(id) => setColleges((prev) => prev.filter((c) => c.id !== id))}
      />
      <style>{`
        @media (max-width: 600px) {
          .dd-vsep { display: none !important; }
        }
      `}</style>
    </UserShell>
  );
}
