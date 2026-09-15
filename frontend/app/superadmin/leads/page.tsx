"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { leadsApi, STATUS_META, type Lead } from "@/lib/leadsApi";

const PAGE_SIZE = 10;

/* ── status options for filter dropdown ── */
const STATUS_OPTIONS = [
  { value: "ug_aspirant",          label: "UG Aspirant" },
  { value: "ug_student",           label: "UG Student" },
  { value: "pg_aspirant",          label: "PG Aspirant" },
  { value: "pg_student",           label: "PG Student" },
  { value: "working_professional",  label: "Working Professional" },
  { value: "alumni",               label: "Alumni" },
  { value: "other",                label: "Other" },
];

/* ── helpers ── */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function collegeCell(lead: Lead) {
  const parts: string[] = [];
  if (lead.ug_college_name) parts.push(lead.ug_college_name);
  if (lead.pg_college_name) parts.push(lead.pg_college_name);
  return parts.length ? parts.join(" · ") : "-";
}

function stateCell(lead: Lead) {
  const states = Array.from(new Set([lead.ug_college_state, lead.pg_college_state].filter(Boolean)));
  return states.length ? states.join(" · ") : "-";
}

type SortKey = "full_name" | "email" | "current_status" | "college" | "state" | "created_at";

function sortValue(lead: Lead, key: SortKey): string {
  switch (key) {
    case "full_name":      return lead.full_name.toLowerCase();
    case "email":          return lead.email.toLowerCase();
    case "current_status": return lead.status_display.toLowerCase();
    case "college":        return collegeCell(lead).toLowerCase();
    case "state":          return stateCell(lead).toLowerCase();
    case "created_at":     return lead.created_at;
  }
}

/* ── sub-components ── */
function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={{ flex: "1 1 160px", padding: "18px 20px", borderRadius: "16px", background: "var(--dd-bg2)", border: "1px solid var(--dd-border)" }}>
      <div className="num" style={{ fontSize: "clamp(1.6rem,4vw,2rem)", fontWeight: 700, letterSpacing: "-0.03em", color: accent, lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: "0.78rem", color: "var(--dd-text3)", marginTop: "4px", fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (!status) return <span style={{ color: "var(--dd-text4)" }}>-</span>;
  const m = STATUS_META[status];
  if (!m) return <span style={{ color: "var(--dd-text3)", fontSize: "0.8rem" }}>{status}</span>;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 10px", borderRadius: "100px",
      background: m.bg, border: `1px solid ${m.border}`,
      color: m.color, fontSize: "0.72rem", fontWeight: 600,
      whiteSpace: "nowrap", letterSpacing: "0.01em",
    }}>
      {m.label}
    </span>
  );
}

function SortableHeader({ label, sortKey, activeKey, dir, onClick }: {
  label: string; sortKey: SortKey; activeKey: SortKey; dir: "asc" | "desc"; onClick: (k: SortKey) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <th onClick={() => onClick(sortKey)} style={{
      padding: "12px 16px", textAlign: "left", cursor: "pointer", userSelect: "none",
      fontSize: "0.7rem", fontWeight: 600, color: active ? "#ff375f" : "var(--dd-text3)",
      letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap",
      background: "var(--dd-surface)",
    }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
        {label}
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
          style={{ opacity: active ? 1 : 0.35, transform: active && dir === "asc" ? "rotate(180deg)" : "none" }}>
          <path d="M2 4l3 3 3-3"/>
        </svg>
      </span>
    </th>
  );
}

function FilterSelect({ id, value, onChange, placeholder, options }: {
  id: string; value: string; onChange: (v: string) => void; placeholder: string; options: { value: string; label: string }[];
}) {
  const active = !!value;
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <select id={id} name={id} value={value} onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "10px 36px 10px 14px", borderRadius: "10px", maxWidth: "180px",
          background: active ? "rgba(255,55,95,0.08)" : "var(--dd-input-bg)",
          border: `1px solid ${active ? "rgba(255,55,95,0.3)" : "var(--dd-border2)"}`,
          color: active ? "#ff375f" : "var(--dd-text3)",
          fontSize: "0.875rem", fontWeight: active ? 600 : 400,
          outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none",
        }}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", stroke: "var(--dd-text3)" }}
        width="12" height="12" viewBox="0 0 16 16" fill="none" strokeWidth="1.8" strokeLinecap="round">
        <path d="M4 6l4 4 4-4"/>
      </svg>
    </div>
  );
}

/* ── Pagination component ── */
function Pagination({
  page, totalPages, onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  /* Build the page number sequence with ellipsis */
  function pages(): (number | "…")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4)       return [1, 2, 3, 4, 5, "…", totalPages];
    if (page >= totalPages - 3) return [1, "…", totalPages-4, totalPages-3, totalPages-2, totalPages-1, totalPages];
    return [1, "…", page - 1, page, page + 1, "…", totalPages];
  }

  const pageBtn = (keyVal: string, content: React.ReactNode, onClick: () => void, active = false, disabled = false) => (
    <button
      key={keyVal}
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: "34px", height: "34px", borderRadius: "8px", padding: "0 6px",
        background: active ? "rgba(255,55,95,0.15)" : "var(--dd-surface2)",
        border: `1px solid ${active ? "rgba(255,55,95,0.35)" : "var(--dd-border)"}`,
        color: active ? "#ff375f" : disabled ? "var(--dd-text4)" : "var(--dd-text2)",
        fontSize: "0.8125rem", fontWeight: active ? 700 : 500,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.12s",
      }}
      onMouseEnter={(e) => { if (!disabled && !active) { e.currentTarget.style.background = "var(--dd-border2)"; e.currentTarget.style.color = "var(--dd-text1)"; } }}
      onMouseLeave={(e) => { if (!disabled && !active) { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text2)"; } }}
    >
      {content}
    </button>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
      {/* Prev */}
      {pageBtn("prev",
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 12L6 8l4-4"/></svg>,
        () => onChange(page - 1), false, page === 1
      )}

      {/* Page numbers */}
      {pages().map((p, i) =>
        p === "…"
          ? <span key={`ellipsis-${i}`} style={{ color: "var(--dd-text4)", fontSize: "0.8125rem", padding: "0 4px" }}>…</span>
          : pageBtn(`page-${p}`, p, () => onChange(p as number), p === page)
      )}

      {/* Next */}
      {pageBtn("next",
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 12l4-4-4-4"/></svg>,
        () => onChange(page + 1), false, page === totalPages
      )}
    </div>
  );
}

/* ════════════════════════════════════════ PAGE ══ */
export default function LeadsPage() {
  const router = useRouter();

  const [leads,     setLeads]     = useState<Lead[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [search,    setSearch]    = useState("");
  const [statusF,   setStatusF]   = useState("");
  const [stateF,    setStateF]    = useState("");
  const [collegeF,  setCollegeF]  = useState("");
  const [eduF,      setEduF]      = useState("");
  const [sortKey,   setSortKey]   = useState<SortKey>("created_at");
  const [sortDir,   setSortDir]   = useState<"asc" | "desc">("desc");
  const [page,      setPage]      = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState("");

  /* load */
  useEffect(() => {
    leadsApi.list()
      .then(setLeads)
      .catch(() => setError("Could not load leads. Is the backend running?"))
      .finally(() => setLoading(false));
  }, []);

  /* reset to page 1 whenever filters change */
  useEffect(() => { setPage(1); }, [search, statusF, stateF, collegeF, eduF]);

  /* filter option lists, derived from whatever leads actually exist */
  const stateOptions = useMemo(() => {
    const s = new Set<string>();
    leads.forEach((l) => { if (l.ug_college_state) s.add(l.ug_college_state); if (l.pg_college_state) s.add(l.pg_college_state); });
    return Array.from(s).sort();
  }, [leads]);

  const collegeOptions = useMemo(() => {
    const s = new Set<string>();
    leads.forEach((l) => { if (l.ug_college_name) s.add(l.ug_college_name); if (l.pg_college_name) s.add(l.pg_college_name); });
    return Array.from(s).sort();
  }, [leads]);

  /* client-side filter + sort */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const rows = leads.filter((l) => {
      const matchSearch = !q ||
        l.full_name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.ug_college_name ?? "").toLowerCase().includes(q) ||
        (l.pg_college_name ?? "").toLowerCase().includes(q);
      const matchStatus  = !statusF   || l.current_status === statusF;
      const matchState   = !stateF    || l.ug_college_state === stateF || l.pg_college_state === stateF;
      const matchCollege = !collegeF  || l.ug_college_name === collegeF || l.pg_college_name === collegeF;
      const matchEdu     = !eduF      || l.highest_education === eduF;
      return matchSearch && matchStatus && matchState && matchCollege && matchEdu;
    });
    const sorted = [...rows].sort((a, b) => {
      const av = sortValue(a, sortKey), bv = sortValue(b, sortKey);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [leads, search, statusF, stateF, collegeF, eduF, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) { setSortDir((d) => (d === "asc" ? "desc" : "asc")); }
    else { setSortKey(key); setSortDir(key === "created_at" ? "desc" : "asc"); }
  }

  /* pagination */
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const startIdx   = (page - 1) * PAGE_SIZE; // for absolute row numbering

  /* stats always from full set */
  const stats = useMemo(() => ({
    total:    leads.length,
    hot:      leads.filter(l => l.current_status === "ug_aspirant" || l.current_status === "pg_aspirant").length,
    students: leads.filter(l => l.current_status === "ug_student"  || l.current_status === "pg_student").length,
    pros:     leads.filter(l => l.current_status === "working_professional" || l.current_status === "alumni").length,
  }), [leads]);

  const hasFilter     = !!(search || statusF || stateF || collegeF || eduF);
  const showingFrom   = filtered.length === 0 ? 0 : startIdx + 1;
  const showingTo     = Math.min(startIdx + PAGE_SIZE, filtered.length);

  /* export */
  async function handleExport() {
    setExporting(true); setExportErr("");
    try {
      await leadsApi.exportCsv(hasFilter ? {
        search: search || undefined, status: statusF || undefined,
        state: stateF || undefined, college: collegeF || undefined, education: eduF || undefined,
      } : undefined);
    } catch {
      setExportErr("Export failed. Try again.");
    } finally {
      setExporting(false);
    }
  }

  /* ── skeleton ── */
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--dd-bg)", color: "var(--dd-text1)" }}>
        <NavBar router={router} />
        <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 20px" }}>
          <div style={{ display: "flex", gap: "12px", marginBottom: "28px", flexWrap: "wrap" }}>
            {[1,2,3,4].map(i => <div key={i} style={{ flex: "1 1 150px", height: "80px", borderRadius: "16px", background: "var(--dd-surface2)", animation: "pulse 1.4s ease infinite" }} />)}
          </div>
          <div style={{ height: "400px", borderRadius: "18px", background: "var(--dd-surface2)", animation: "pulse 1.4s ease infinite" }} />
          <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.7}}`}</style>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--dd-bg)", color: "var(--dd-text1)" }}>

      {/* Ambient glow */}
      <div style={{ position: "fixed", top: "-180px", left: "50%", transform: "translateX(-50%)", width: "700px", height: "700px", background: "radial-gradient(circle,rgba(255,55,95,0.05) 0%,transparent 65%)", filter: "blur(60px)", pointerEvents: "none", zIndex: 0 }} />

      <NavBar router={router} />

      <main style={{ position: "relative", zIndex: 1, maxWidth: "1200px", margin: "0 auto", padding: "36px 20px 80px" }}>

        {/* ── Page header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", marginBottom: "28px" }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.4rem,4vw,1.9rem)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--dd-text1)", marginBottom: "4px" }}>
              Leads
            </h1>
            <p style={{ fontSize: "0.875rem", color: "var(--dd-text3)" }}>
              {leads.length === 0
                ? "No profiles yet. Leads appear once end users create their profile."
                : `${leads.length} profile${leads.length !== 1 ? "s" : ""}, medical education interest base`}
            </p>
          </div>

          {/* Export button */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
            <button
              onClick={handleExport}
              disabled={exporting || leads.length === 0}
              style={{
                display: "flex", alignItems: "center", gap: "7px",
                padding: "9px 18px", borderRadius: "10px",
                background: "var(--dd-success-bg)", border: "1px solid var(--dd-success-border)",
                color: "var(--dd-success)", fontSize: "0.875rem", fontWeight: 600,
                cursor: leads.length === 0 ? "not-allowed" : "pointer",
                opacity: leads.length === 0 ? 0.4 : 1, transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { if (leads.length > 0) e.currentTarget.style.background = "rgba(21,128,61,0.16)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-success-bg)"; }}
            >
              {exporting
                ? <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 0.8s linear infinite" }}><path d="M8 2a6 6 0 010 12" /></svg>
                : <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2"/><path d="M8 2v8"/><path d="M5 7l3 3 3-3"/></svg>
              }
              {exporting ? "Exporting…" : "Export CSV"}
              {hasFilter && !exporting && <span style={{ fontSize: "0.68rem", color: "var(--dd-success)" }}>(filtered)</span>}
            </button>
            {exportErr && <span style={{ fontSize: "0.75rem", color: "var(--dd-danger)" }}>{exportErr}</span>}
          </div>
        </div>

        {/* ── Stats row ── */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "24px" }}>
          <StatCard label="Total Leads"      value={stats.total}    accent="#ff375f" />
          <StatCard label="Aspirants (Hot)"  value={stats.hot}      accent="#ff9f0a" />
          <StatCard label="Active Students"  value={stats.students} accent="#0d9488" />
          <StatCard label="Professionals"    value={stats.pros}     accent="#15803d" />
        </div>

        {/* ── Search + filter ── */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "12px" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <svg style={{ position: "absolute", left: "13px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", stroke: "var(--dd-text3)" }}
              width="14" height="14" viewBox="0 0 16 16" fill="none" strokeWidth="1.7" strokeLinecap="round">
              <circle cx="6.5" cy="6.5" r="4.5"/><path d="M11 11l3 3"/>
            </svg>
            <input id="leads-search" name="search" type="text" placeholder="Search name, email, or college…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px 10px 36px", borderRadius: "10px",
                background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)",
                color: "var(--dd-text1)", fontSize: "0.875rem", outline: "none", boxSizing: "border-box",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(255,55,95,0.4)"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--dd-border2)"; }}
            />
          </div>

          {/* Status filter */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <select id="leads-status-filter" name="status" value={statusF} onChange={(e) => setStatusF(e.target.value)}
              style={{
                padding: "10px 36px 10px 14px", borderRadius: "10px",
                background: statusF ? "rgba(255,55,95,0.08)" : "var(--dd-input-bg)",
                border: `1px solid ${statusF ? "rgba(255,55,95,0.3)" : "var(--dd-border2)"}`,
                color: statusF ? "#ff375f" : "var(--dd-text3)",
                fontSize: "0.875rem", fontWeight: statusF ? 600 : 400,
                outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none",
              }}>
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <svg style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", stroke: "var(--dd-text3)" }}
              width="12" height="12" viewBox="0 0 16 16" fill="none" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 6l4 4 4-4"/>
            </svg>
          </div>

          {/* State filter */}
          <FilterSelect id="leads-state-filter" value={stateF} onChange={setStateF} placeholder="All States"
            options={stateOptions.map((s) => ({ value: s, label: s }))} />

          {/* College filter */}
          <FilterSelect id="leads-college-filter" value={collegeF} onChange={setCollegeF} placeholder="All Colleges"
            options={collegeOptions.map((c) => ({ value: c, label: c }))} />

          {/* Education level filter */}
          <FilterSelect id="leads-education-filter" value={eduF} onChange={setEduF} placeholder="UG & PG"
            options={[{ value: "ug", label: "UG" }, { value: "pg", label: "PG" }]} />

          {/* Clear */}
          {hasFilter && (
            <button onClick={() => { setSearch(""); setStatusF(""); setStateF(""); setCollegeF(""); setEduF(""); }}
              style={{
                padding: "10px 14px", borderRadius: "10px",
                background: "var(--dd-surface2)", border: "1px solid var(--dd-border)",
                color: "var(--dd-text3)", fontSize: "0.8125rem", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "5px",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-text1)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)"; }}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 4L4 12M4 4l8 8"/>
              </svg>
              Clear
            </button>
          )}
        </div>

        {/* ── Results count bar ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: "8px",
          padding: "10px 14px", borderRadius: "10px", marginBottom: "14px",
          background: hasFilter ? "rgba(255,55,95,0.05)" : "var(--dd-surface)",
          border: `1px solid ${hasFilter ? "rgba(255,55,95,0.15)" : "var(--dd-border)"}`,
          transition: "all 0.2s",
        }}>
          <span style={{ fontSize: "0.8125rem", color: hasFilter ? "#ff375f" : "var(--dd-text3)", fontWeight: hasFilter ? 600 : 400 }}>
            {hasFilter
              ? <>
                  <span style={{ color: "var(--dd-text1)", fontWeight: 700 }}>{filtered.length}</span>
                  {" "}result{filtered.length !== 1 ? "s" : ""} found
                  {" · "}
                  <span style={{ fontWeight: 400, color: "var(--dd-text3)" }}>{leads.length} total</span>
                </>
              : <>{leads.length} lead{leads.length !== 1 ? "s" : ""} total</>
            }
          </span>
          {filtered.length > 0 && (
            <span style={{ fontSize: "0.78rem", color: "var(--dd-text4)" }}>
              Showing {showingFrom}–{showingTo} of {filtered.length}
            </span>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ padding: "14px 18px", borderRadius: "12px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", color: "var(--dd-danger)", fontSize: "0.875rem", marginBottom: "16px" }}>
            {error}
          </div>
        )}

        {/* ── Table ── */}
        {!error && filtered.length === 0 ? (
          <EmptyState hasFilter={hasFilter} />
        ) : !error ? (
          <>
            <div style={{ borderRadius: "18px", overflow: "hidden", border: "1px solid var(--dd-border)", background: "var(--dd-surface)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "780px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--dd-border)" }}>
                      <th style={{ padding: "12px 8px 12px 20px", textAlign: "left", fontSize: "0.7rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap", background: "var(--dd-surface)" }}>#</th>
                      <SortableHeader label="Name" sortKey="full_name" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
                      <SortableHeader label="Email" sortKey="email" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
                      <SortableHeader label="Status" sortKey="current_status" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
                      <SortableHeader label="College" sortKey="college" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
                      <SortableHeader label="State" sortKey="state" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
                      <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.7rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap", background: "var(--dd-surface)" }}>Phone</th>
                      <SortableHeader label="Joined" sortKey="created_at" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((lead, idx) => (
                      <tr key={lead.id}
                        style={{ borderBottom: idx < paginated.length - 1 ? "1px solid var(--dd-border)" : "none", transition: "background 0.12s" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--dd-surface2)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                      >
                        {/* # — absolute across all pages */}
                        <td className="num" style={{ padding: "14px 8px 14px 20px", fontSize: "0.78rem", color: "var(--dd-text4)", fontWeight: 500 }}>
                          {startIdx + idx + 1}
                        </td>
                        {/* Name */}
                        <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#ff375f 0%,#ff2d55 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: "#fff" }}>
                              {lead.full_name ? lead.full_name.trim().split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase() : "?"}
                            </div>
                            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--dd-text1)" }}>
                              {lead.full_name || <span style={{ color: "var(--dd-text4)" }}>-</span>}
                            </span>
                          </div>
                        </td>
                        {/* Email */}
                        <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                          <a href={`mailto:${lead.email}`} style={{ fontSize: "0.8125rem", color: "var(--dd-teal)", textDecoration: "none" }}
                            onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}>
                            {lead.email}
                          </a>
                        </td>
                        {/* Status */}
                        <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                          <StatusBadge status={lead.current_status} />
                        </td>
                        {/* College */}
                        <td style={{ padding: "14px 16px", maxWidth: "220px" }}>
                          <span style={{ fontSize: "0.8125rem", color: "var(--dd-text2)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={collegeCell(lead)}>
                            {collegeCell(lead)}
                          </span>
                        </td>
                        {/* State */}
                        <td style={{ padding: "14px 16px", maxWidth: "160px" }}>
                          <span style={{ fontSize: "0.8125rem", color: "var(--dd-text3)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={stateCell(lead)}>
                            {stateCell(lead)}
                          </span>
                        </td>
                        {/* Phone */}
                        <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                          {lead.phone
                            ? <a href={`tel:${lead.phone}`} style={{ fontSize: "0.8125rem", color: "var(--dd-text1)", textDecoration: "none" }}>{lead.phone}</a>
                            : <span style={{ color: "var(--dd-text4)" }}>-</span>}
                        </td>
                        {/* Joined */}
                        <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                          <span style={{ fontSize: "0.8rem", color: "var(--dd-text3)" }}>{fmtDate(lead.created_at)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table footer — pagination + summary */}
              <div style={{
                padding: "14px 20px", borderTop: "1px solid var(--dd-border)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexWrap: "wrap", gap: "12px",
              }}>
                <span style={{ fontSize: "0.78rem", color: "var(--dd-text4)" }}>
                  {showingFrom}–{showingTo} of {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
                  {hasFilter && <span style={{ color: "var(--dd-text4)" }}> (filtered)</span>}
                </span>
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
              </div>
            </div>
          </>
        ) : null}
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        select option { background: var(--dd-bg2); color: var(--dd-text1); }
      `}</style>
    </div>
  );
}

/* ── Navbar ── */
function NavBar({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 30,
      background: "var(--dd-nav-bg)",
      backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)",
      borderBottom: "1px solid var(--dd-border)",
      padding: "0 16px", height: "60px",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, overflow: "hidden" }}>
        <button onClick={() => router.push("/about")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Darkdoctor" draggable={false}
            style={{ height: "28px", width: "auto", objectFit: "contain" }} />
        </button>
        <span style={{ color: "var(--dd-border2)" }}>/</span>
        <span style={{ fontSize: "0.875rem", color: "var(--dd-text3)", fontWeight: 500 }}>Home</span>
        <span style={{ color: "var(--dd-border2)" }}>/</span>
        <span style={{ fontSize: "0.875rem", color: "var(--dd-text1)", fontWeight: 600 }}>Leads</span>
      </div>
      <button onClick={() => router.push("/superadmin/home")}
        style={{ padding: "7px 13px", borderRadius: "8px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text2)", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-border2)"; e.currentTarget.style.color = "var(--dd-text1)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text2)"; }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 12L6 8l4-4"/></svg>
        Home
      </button>
    </nav>
  );
}

/* ── Empty state ── */
function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div style={{ textAlign: "center", padding: "64px 20px", borderRadius: "18px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)" }}>
      <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "rgba(255,55,95,0.08)", border: "1px solid rgba(255,55,95,0.16)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff375f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
      </div>
      <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--dd-text1)", marginBottom: "8px" }}>
        {hasFilter ? "No leads match your filter" : "No leads yet"}
      </h3>
      <p style={{ fontSize: "0.875rem", color: "var(--dd-text3)", maxWidth: "320px", margin: "0 auto", lineHeight: 1.6 }}>
        {hasFilter
          ? "Try clearing a filter to see more leads."
          : "Leads will appear here once end users sign up and complete their profile on the platform."}
      </p>
    </div>
  );
}
