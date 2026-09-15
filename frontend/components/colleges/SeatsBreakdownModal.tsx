"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { College, SeatEntry, SeatEntryInput, collegeApi } from "@/lib/collegeApi";

/* ── Props ───────────────────────────────────────────────────────────────── */
interface Props {
  college:     College;
  isSuperAdmin: boolean;
  /** Called with the updated entries after a successful save. */
  onUpdate:    (entries: SeatEntry[]) => void;
  onClose:     () => void;
}

/* ── Draft row (edit mode only) ─────────────────────────────────────────── */
interface DraftRow {
  key:        string;   // stable React key
  program:    string;
  department: string;
  seats:      string;   // string so input is controlled without coercion
}

/* ── Shared input style (edit mode) ─────────────────────────────────────── */
const INPUT: React.CSSProperties = {
  padding: "8px 10px", borderRadius: "8px",
  background: "var(--dd-input-bg)",
  border: "1px solid var(--dd-border2)",
  color: "var(--dd-text1)", fontSize: "0.875rem",
  outline: "none", width: "100%", boxSizing: "border-box",
  transition: "border-color 0.12s",
};

/* ══════════════════════════════════════════════════════════════════════════ */
export default function SeatsBreakdownModal({
  college, isSuperAdmin, onUpdate, onClose,
}: Props) {
  const [mode,   setMode]   = useState<"view" | "edit">("view");
  const [rows,   setRows]   = useState<DraftRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const keyRef = useRef(0);

  const entries = useMemo(() => college.seat_entries ?? [], [college.seat_entries]);

  /* ── Keyboard: Escape closes modal ────────────────────────────────────── */
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  /* ── Group entries by program for view mode ───────────────────────────── */
  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, SeatEntry[]>();
    for (const e of entries) {
      if (!map.has(e.program)) { order.push(e.program); map.set(e.program, []); }
      map.get(e.program)!.push(e);
    }
    return order.map((p) => ({ program: p, rows: map.get(p)! }));
  }, [entries]);

  const computedTotal = useMemo(
    () => entries.reduce((s, e) => s + e.seats, 0),
    [entries],
  );

  /* ── Program name suggestions (edit mode datalist) ────────────────────── */
  const suggestListId = `seats-prog-${college.id}`;
  const programSuggestions = useMemo(() => {
    const s = new Set<string>();
    if (college.has_mbbs)    s.add("MBBS");
    if (college.has_dental)  s.add("Dental");
    if (college.has_nursing) s.add("Nursing");
    if (college.is_pg)       s.add("PG");
    if (college.is_ug && !college.has_mbbs && !college.has_dental && !college.has_nursing) s.add("UG");
    for (const e of entries) s.add(e.program);
    return Array.from(s);
  }, [college, entries]);

  /* ── Enter edit mode ──────────────────────────────────────────────────── */
  function enterEdit() {
    keyRef.current = entries.length;
    setRows(
      entries.map((e, i) => ({
        key:        String(i),
        program:    e.program,
        department: e.department,
        seats:      String(e.seats),
      })),
    );
    setError(null);
    setMode("edit");
  }

  /* ── Row helpers ──────────────────────────────────────────────────────── */
  function addRow() {
    const key = String(++keyRef.current);
    setRows((prev) => [...prev, { key, program: "", department: "", seats: "" }]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function updateRow(key: string, field: keyof Omit<DraftRow, "key">, value: string) {
    setRows((prev) => prev.map((r) => r.key === key ? { ...r, [field]: value } : r));
  }

  /* ── Save ─────────────────────────────────────────────────────────────── */
  async function handleSave() {
    setError(null);

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.program.trim()) {
        setError(`Row ${i + 1}: Program name is required.`); return;
      }
      const n = Number(r.seats);
      if (r.seats.trim() === "" || isNaN(n) || !Number.isInteger(n) || n < 0) {
        setError(`Row ${i + 1}: Seats must be a whole number ≥ 0.`); return;
      }
    }

    setSaving(true);
    try {
      const payload: SeatEntryInput[] = rows.map((r, i) => ({
        program:       r.program.trim(),
        department:    r.department.trim(),
        seats:         Number(r.seats),
        display_order: i,
      }));
      const updated = await collegeApi.seatEntries.replace(college.id, payload);
      onUpdate(updated);
      setMode("view");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(15,23,42,0.45)",
          backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
          animation: "seatFadeIn 0.15s ease",
        }}
      />

      {/* Modal container */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px", pointerEvents: "none",
      }}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: "500px",
            maxHeight: "calc(100dvh - 32px)",
            background: "var(--dd-bg2)",
            border: "1px solid var(--dd-border)",
            borderRadius: "24px",
            boxShadow: "var(--dd-shadow-lg)",
            display: "flex", flexDirection: "column",
            pointerEvents: "auto",
            animation: "seatSlideUp 0.22s cubic-bezier(0.22,1,0.36,1)",
            overflow: "hidden",
          }}
        >

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div style={{
            padding: "22px 26px 18px",
            borderBottom: "1px solid var(--dd-border)",
            display: "flex", alignItems: "flex-start",
            justifyContent: "space-between", flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "40px", height: "40px", borderRadius: "11px", flexShrink: 0,
                background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 20px rgba(13,148,136,0.22)",
              }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <div>
                <h2 style={{ fontSize: "1.0625rem", fontWeight: 600, color: "var(--dd-text1)", letterSpacing: "-0.02em" }}>
                  {mode === "edit" ? "Edit Seat Breakdown" : "Intake Seats"}
                </h2>
                <p style={{ fontSize: "0.775rem", color: "var(--dd-text3)", marginTop: "2px" }}>
                  {mode === "edit"
                    ? "Add, edit, or remove program entries"
                    : entries.length > 0
                      ? `${computedTotal.toLocaleString()} total · ${groups.length} program${groups.length !== 1 ? "s" : ""}`
                      : college.name}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: "28px", height: "28px", borderRadius: "8px", flexShrink: 0,
                background: "var(--dd-border)", border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "var(--dd-text2)", transition: "background 0.12s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-border2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-border)"; }}
            >
              <svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="1" y1="1" x2="12" y2="12"/><line x1="12" y1="1" x2="1" y2="12"/>
              </svg>
            </button>
          </div>

          {/* ── Body (scrollable) ───────────────────────────────────────── */}
          <div style={{ overflowY: "auto", flex: 1 }}>

            {/* ════ VIEW MODE ════ */}
            {mode === "view" && (
              <div style={{ padding: "22px 26px" }}>

                {entries.length === 0 ? (
                  /* Empty state */
                  <div style={{ textAlign: "center", padding: "28px 0" }}>
                    <div style={{
                      width: "48px", height: "48px", borderRadius: "14px", margin: "0 auto 14px",
                      background: "var(--dd-surface)", border: "1px solid var(--dd-border)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--dd-text3)" strokeWidth="1.6" strokeLinecap="round">
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                      </svg>
                    </div>
                    <p style={{ fontSize: "0.9rem", color: "var(--dd-text3)", marginBottom: isSuperAdmin ? "16px" : 0 }}>
                      No seat breakdown added yet.
                    </p>
                    {isSuperAdmin && (
                      <button
                        onClick={enterEdit}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: "6px",
                          padding: "9px 20px", borderRadius: "100px",
                          background: "rgba(13,148,136,0.1)", border: "1px solid rgba(13,148,136,0.25)",
                          color: "#0d9488", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(13,148,136,0.18)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(13,148,136,0.1)"; }}
                      >
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                          <line x1="7" y1="1" x2="7" y2="13"/><line x1="1" y1="7" x2="13" y2="7"/>
                        </svg>
                        Add Breakdown
                      </button>
                    )}
                  </div>
                ) : (
                  /* Grouped breakdown */
                  <div>
                    {groups.map((group, gi) => {
                      const isFlat      = group.rows.length === 1 && group.rows[0].department === "";
                      const groupTotal  = group.rows.reduce((s, r) => s + r.seats, 0);

                      return (
                        <div key={group.program}>
                          {gi > 0 && (
                            <div style={{ height: "1px", background: "var(--dd-border)", margin: "2px 0" }} />
                          )}
                          <div style={{ padding: "14px 0" }}>
                            {isFlat ? (
                              /* ── program IS the seat unit ── */
                              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                                <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--dd-text1)", letterSpacing: "-0.01em" }}>
                                  {group.program}
                                </span>
                                <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--dd-text1)", letterSpacing: "-0.02em" }}>
                                  {group.rows[0].seats.toLocaleString()}
                                  <span style={{ fontSize: "0.72rem", color: "var(--dd-text3)", fontWeight: 400, marginLeft: "4px" }}>seats</span>
                                </span>
                              </div>
                            ) : (
                              /* ── program with department rows ── */
                              <div>
                                {/* Program header row */}
                                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "10px" }}>
                                  <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--dd-text1)", letterSpacing: "-0.01em" }}>
                                    {group.program}
                                  </span>
                                  <span style={{ fontSize: "0.78rem", color: "var(--dd-text3)" }}>
                                    {groupTotal.toLocaleString()} total
                                  </span>
                                </div>
                                {/* Department rows (indented) */}
                                <div style={{
                                  display: "flex", flexDirection: "column", gap: "7px",
                                  paddingLeft: "14px",
                                  borderLeft: "2px solid var(--dd-border)",
                                }}>
                                  {group.rows.map((e) => (
                                    <div key={e.id} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                                      <span style={{ fontSize: "0.875rem", color: "var(--dd-text2)" }}>
                                        {e.department || e.program}
                                      </span>
                                      <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--dd-text1)" }}>
                                        {e.seats.toLocaleString()}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Total row */}
                    <div style={{
                      borderTop: "1px solid var(--dd-border2)", marginTop: "4px", paddingTop: "14px",
                      display: "flex", alignItems: "baseline", justifyContent: "space-between",
                    }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        Total
                      </span>
                      <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--dd-text1)", letterSpacing: "-0.03em" }}>
                        {computedTotal.toLocaleString()}
                        <span style={{ fontSize: "0.8rem", color: "var(--dd-text3)", fontWeight: 400, marginLeft: "5px" }}>seats</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ════ EDIT MODE ════ */}
            {mode === "edit" && (
              <div style={{ padding: "22px 26px" }}>

                {/* Column headers */}
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr 72px 32px",
                  gap: "8px", paddingBottom: "9px",
                  borderBottom: "1px solid var(--dd-border)",
                  marginBottom: "10px",
                }}>
                  {["Program", "Department (optional)", "Seats", ""].map((h, i) => (
                    <span key={i} style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
                      {h}
                    </span>
                  ))}
                </div>

                {/* Program name suggestions */}
                <datalist id={suggestListId}>
                  {programSuggestions.map((p) => <option key={p} value={p} />)}
                </datalist>

                {rows.length === 0 && (
                  <p style={{ textAlign: "center", padding: "20px 0 12px", color: "var(--dd-text3)", fontSize: "0.875rem" }}>
                    No entries yet. Click &ldquo;Add Row&rdquo; below.
                  </p>
                )}

                {/* Editable rows */}
                <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                  {rows.map((row) => (
                    <div key={row.key} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 72px 32px", gap: "8px", alignItems: "center" }}>
                      <input
                        id={`seats-modal-program-${row.key}`} name="program"
                        list={suggestListId}
                        value={row.program}
                        onChange={(e) => updateRow(row.key, "program", e.target.value)}
                        placeholder="e.g. MBBS"
                        style={INPUT}
                        onFocus={(e)  => { e.currentTarget.style.borderColor = "rgba(13,148,136,0.45)"; }}
                        onBlur={(e)   => { e.currentTarget.style.borderColor = "var(--dd-border2)"; }}
                      />
                      <input
                        id={`seats-modal-department-${row.key}`} name="department"
                        value={row.department}
                        onChange={(e) => updateRow(row.key, "department", e.target.value)}
                        placeholder="e.g. General Surgery"
                        style={INPUT}
                        onFocus={(e)  => { e.currentTarget.style.borderColor = "rgba(13,148,136,0.45)"; }}
                        onBlur={(e)   => { e.currentTarget.style.borderColor = "var(--dd-border2)"; }}
                      />
                      <input
                        id={`seats-modal-count-${row.key}`} name="seats"
                        type="number"
                        min="0"
                        value={row.seats}
                        onChange={(e) => updateRow(row.key, "seats", e.target.value)}
                        placeholder="0"
                        style={{ ...INPUT, textAlign: "right" }}
                        onFocus={(e)  => { e.currentTarget.style.borderColor = "rgba(13,148,136,0.45)"; }}
                        onBlur={(e)   => { e.currentTarget.style.borderColor = "var(--dd-border2)"; }}
                      />
                      <button
                        type="button"
                        onClick={() => removeRow(row.key)}
                        aria-label="Remove row"
                        style={{
                          width: "28px", height: "36px", borderRadius: "7px",
                          background: "none", border: "none", cursor: "pointer",
                          color: "var(--dd-text3)", display: "flex", alignItems: "center",
                          justifyContent: "center", transition: "all 0.12s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-danger)"; e.currentTarget.style.background = "rgba(185,28,28,0.09)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)";  e.currentTarget.style.background = "none"; }}
                      >
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                          <line x1="2" y1="2" x2="12" y2="12"/><line x1="12" y1="2" x2="2" y2="12"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Row */}
                <button
                  type="button"
                  onClick={addRow}
                  style={{
                    marginTop: "12px",
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "7px 14px", borderRadius: "8px",
                    background: "var(--dd-surface)",
                    border: "1px solid var(--dd-border2)",
                    color: "var(--dd-text2)", fontSize: "0.8125rem", fontWeight: 500,
                    cursor: "pointer", transition: "all 0.14s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface)"; e.currentTarget.style.color = "var(--dd-text2)"; }}
                >
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <line x1="7" y1="1" x2="7" y2="13"/><line x1="1" y1="7" x2="13" y2="7"/>
                  </svg>
                  Add Row
                </button>

                {/* Validation error */}
                {error && (
                  <div style={{
                    marginTop: "14px", padding: "10px 13px", borderRadius: "9px",
                    background: "rgba(185,28,28,0.08)", border: "1px solid rgba(185,28,28,0.2)",
                    display: "flex", alignItems: "flex-start", gap: "7px",
                  }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: "1px" }}>
                      <circle cx="8" cy="8" r="7" stroke="var(--dd-danger)" strokeWidth="1.5"/>
                      <line x1="8" y1="5" x2="8" y2="9" stroke="var(--dd-danger)" strokeWidth="1.5" strokeLinecap="round"/>
                      <circle cx="8" cy="11.5" r="0.75" fill="var(--dd-danger)"/>
                    </svg>
                    <span style={{ fontSize: "0.8125rem", color: "var(--dd-danger)", lineHeight: 1.5 }}>{error}</span>
                  </div>
                )}

                {/* Helper note */}
                <p style={{ marginTop: "16px", fontSize: "0.75rem", color: "var(--dd-text4)", lineHeight: 1.6 }}>
                  Leave <strong style={{ color: "var(--dd-text3)" }}>Department</strong> blank when the program itself is the only unit (e.g. MBBS = 20).
                  Fill it in when a program has multiple sub-departments.
                </p>
              </div>
            )}
          </div>

          {/* ── Footer ─────────────────────────────────────────────────── */}
          <div style={{
            padding: "16px 26px",
            borderTop: "1px solid var(--dd-border)",
            display: "flex", gap: "10px", flexShrink: 0,
          }}>
            {mode === "view" ? (
              <>
                <button
                  onClick={onClose}
                  style={{ flex: 1, padding: "12px", borderRadius: "11px", background: "var(--dd-border)", border: "1px solid var(--dd-border2)", color: "var(--dd-text2)", fontSize: "0.9375rem", fontWeight: 500, cursor: "pointer", transition: "background 0.14s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-border2)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-border)"; }}
                >Close</button>
                {isSuperAdmin && entries.length > 0 && (
                  <button
                    onClick={enterEdit}
                    style={{ flex: 2, padding: "12px", borderRadius: "11px", background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)", border: "none", color: "#fff", fontSize: "0.9375rem", fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 20px rgba(13,148,136,0.26)", transition: "opacity 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                  >Edit Breakdown</button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={() => { setMode("view"); setError(null); }}
                  disabled={saving}
                  style={{ flex: 1, padding: "12px", borderRadius: "11px", background: "var(--dd-border)", border: "1px solid var(--dd-border2)", color: "var(--dd-text2)", fontSize: "0.9375rem", fontWeight: 500, cursor: saving ? "not-allowed" : "pointer", transition: "background 0.14s", opacity: saving ? 0.5 : 1 }}
                  onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = "var(--dd-border2)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-border)"; }}
                >Cancel</button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{ flex: 2, padding: "12px", borderRadius: "11px", background: saving ? "rgba(13,148,136,0.35)" : "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)", border: "none", color: "#fff", fontSize: "0.9375rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, boxShadow: saving ? "none" : "0 4px 20px rgba(13,148,136,0.26)", transition: "all 0.2s" }}
                >{saving ? "Saving…" : "Save Changes"}</button>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes seatFadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes seatSlideUp { from { opacity:0; transform:translateY(18px) scale(0.97) } to { opacity:1; transform:translateY(0) scale(1) } }
      `}</style>
    </>
  );
}
