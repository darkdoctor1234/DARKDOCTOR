"use client";

import { useState, useEffect, useRef, FormEvent, KeyboardEvent } from "react";
import { collegeApi, College, CollegePayload } from "@/lib/collegeApi";
import { INDIA_STATES, INDIA_UNION_TERRITORIES } from "@/lib/indiaStates";

/* ─── types ─── */
export interface CollegeFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (college: College) => void;
  initial?: College | null; // null = create mode
}

const CURRENT_YEAR = new Date().getFullYear();

/* ─── sub-components ─── */
function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: "7px" }}>
      <span style={{ fontSize: "0.8125rem", color: "var(--dd-text2)", letterSpacing: "-0.01em" }}>{children}</span>
      {hint && <span style={{ fontSize: "0.75rem", color: "var(--dd-text3)", marginLeft: "6px" }}>{hint}</span>}
    </div>
  );
}

function StyledInput({
  id, value, onChange, placeholder, type = "text",
  required = true, min, max,
}: {
  id: string; value: string | number; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean; min?: number; max?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      id={id} type={type} value={value} required={required}
      placeholder={placeholder} min={min} max={max}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        width: "100%", padding: "11px 13px", borderRadius: "10px",
        background: focused ? "var(--dd-surface2)" : "var(--dd-input-bg)",
        border: `1px solid ${focused ? "var(--dd-teal-border)" : "var(--dd-border2)"}`,
        color: "var(--dd-text1)", fontSize: "0.9rem", outline: "none",
        boxShadow: focused ? "0 0 0 3px var(--dd-teal-bg)" : "none",
        transition: "all 0.15s", boxSizing: "border-box",
      }}
    />
  );
}

function PillToggle({
  options, value, onChange, multi = false,
}: {
  options: { label: string; value: string }[];
  value: string | string[]; onChange: (v: string | string[]) => void; multi?: boolean;
}) {
  function toggle(opt: string) {
    if (multi) {
      const arr = value as string[];
      onChange(arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt]);
    } else {
      onChange(opt);
    }
  }
  const isActive = (opt: string) =>
    multi ? (value as string[]).includes(opt) : value === opt;

  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      {options.map((o) => {
        const active = isActive(o.value);
        return (
          <button key={o.value} type="button" onClick={() => toggle(o.value)} style={{
            padding: "8px 18px", borderRadius: "100px",
            background: active ? "var(--dd-teal-bg2)" : "var(--dd-surface)",
            border: `1.5px solid ${active ? "var(--dd-teal-border)" : "var(--dd-border2)"}`,
            color: active ? "var(--dd-teal-hover)" : "var(--dd-text2)",
            fontSize: "0.875rem", fontWeight: active ? 600 : 400,
            cursor: "pointer", transition: "all 0.15s",
            boxShadow: active ? "0 0 0 3px var(--dd-teal-bg)" : "none",
          }}>
            {active && <span style={{ marginRight: "5px", fontSize: "0.7rem" }}>✓</span>}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function DepartmentField({ departments, onChange }: { departments: string[]; onChange: (d: string[]) => void }) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function add() {
    const t = input.trim();
    if (!t || departments.map((d) => d.toLowerCase()).includes(t.toLowerCase())) { setInput(""); return; }
    onChange([...departments, t]); setInput(""); inputRef.current?.focus();
  }
  function remove(idx: number) { onChange(departments.filter((_, i) => i !== idx)); }
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); add(); }
    if (e.key === "Backspace" && !input && departments.length) onChange(departments.slice(0, -1));
  }

  return (
    <div>
      <div onClick={() => inputRef.current?.focus()} style={{
        minHeight: "46px", padding: "8px 10px", borderRadius: "10px", cursor: "text",
        background: focused ? "var(--dd-surface2)" : "var(--dd-input-bg)",
        border: `1px solid ${focused ? "var(--dd-teal-border)" : "var(--dd-border2)"}`,
        boxShadow: focused ? "0 0 0 3px var(--dd-teal-bg)" : "none",
        display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", transition: "all 0.15s",
      }}>
        {departments.map((dept, idx) => (
          <span key={idx} style={{
            display: "inline-flex", alignItems: "center", gap: "5px",
            padding: "3px 10px 3px 11px", borderRadius: "100px",
            background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.28)",
            color: "#7c3aed", fontSize: "0.8125rem", fontWeight: 500,
          }}>
            {dept}
            <button type="button" onClick={(e) => { e.stopPropagation(); remove(idx); }} style={{
              background: "none", border: "none", cursor: "pointer", color: "var(--dd-text3)",
              display: "flex", alignItems: "center", padding: "1px", borderRadius: "50%",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-danger)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)"; }}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="1" y1="1" x2="10" y2="10" /><line x1="10" y1="1" x2="1" y2="10" />
              </svg>
            </button>
          </span>
        ))}
        <input id="college-department-input" name="department" ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholder={departments.length === 0 ? "Type name and press Enter…" : "Add another…"}
          style={{ flex: 1, minWidth: "160px", background: "none", border: "none", outline: "none", color: "var(--dd-text1)", fontSize: "0.875rem", padding: "2px 4px" }}
        />
      </div>
      {input.trim() && (
        <button type="button" onClick={add} style={{
          marginTop: "7px", padding: "5px 14px", borderRadius: "8px",
          background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)",
          color: "#7c3aed", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
          display: "flex", alignItems: "center", gap: "5px",
        }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="6" y1="1" x2="6" y2="11" /><line x1="1" y1="6" x2="11" y2="6" />
          </svg>
          Add &ldquo;{input.trim()}&rdquo;
        </button>
      )}
      {departments.length > 0 && (
        <p style={{ fontSize: "0.75rem", color: "var(--dd-text3)", marginTop: "7px" }}>
          {departments.length} department{departments.length !== 1 ? "s" : ""} added
        </p>
      )}
    </div>
  );
}

function StateSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <FieldLabel>State / Union Territory</FieldLabel>
      <div style={{ position: "relative" }}>
        <select
          id="college-state" name="state"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%", padding: "11px 36px 11px 13px", borderRadius: "10px",
            background: focused ? "var(--dd-surface2)" : "var(--dd-input-bg)",
            border: `1px solid ${focused ? "var(--dd-teal-border)" : "var(--dd-border2)"}`,
            color: value ? "var(--dd-text1)" : "var(--dd-text3)",
            fontSize: "0.9rem", outline: "none",
            boxShadow: focused ? "0 0 0 3px var(--dd-teal-bg)" : "none",
            appearance: "none", WebkitAppearance: "none",
            cursor: "pointer", transition: "all 0.15s", boxSizing: "border-box",
          }}
        >
          <option value="">Select state…</option>
          <optgroup label="── States ──────────────────">
            {INDIA_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </optgroup>
          <optgroup label="── Union Territories ───────">
            {INDIA_UNION_TERRITORIES.map((ut) => (
              <option key={ut} value={ut}>{ut}</option>
            ))}
          </optgroup>
        </select>
        <svg style={{
          position: "absolute", right: "11px", top: "50%", transform: "translateY(-50%)",
          pointerEvents: "none", color: "var(--dd-text3)",
        }} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M4 6l4 4 4-4"/>
        </svg>
      </div>
    </div>
  );
}

/* ═══════════════════════ MODAL ═══════════════════════ */
export default function CollegeFormModal({ open, onClose, onSaved, initial }: CollegeFormProps) {
  const isEdit = !!initial;
  const firstRef = useRef<HTMLInputElement>(null);

  const [name,            setName]            = useState("");
  const [intakeSeats,     setIntakeSeats]     = useState("");
  const [establishedYear, setEstablishedYear] = useState("");
  const [location,        setLocation]        = useState("");
  const [state,           setState]           = useState("");
  const [collegeType,     setCollegeType]     = useState<"govt" | "private" | "">("");
  const [levels,          setLevels]          = useState<string[]>([]);
  const [courseTypes,     setCourseTypes]     = useState<string[]>([]);
  const [departments,     setDepartments]     = useState<string[]>([]);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState<string | null>(null);

  /* populate from initial */
  useEffect(() => {
    if (open) {
      if (initial) {
        setName(initial.name);
        setIntakeSeats(String(initial.intake_seats));
        setEstablishedYear(String(initial.established_year));
        setLocation(initial.location);
        setState(initial.state ?? "");
        setCollegeType(initial.college_type);
        const lvls: string[] = [];
        if (initial.is_ug) lvls.push("ug");
        if (initial.is_pg) lvls.push("pg");
        setLevels(lvls);
        const courses: string[] = [];
        if (initial.has_mbbs)    courses.push("mbbs");
        if (initial.has_dental)  courses.push("dental");
        if (initial.has_nursing) courses.push("nursing");
        setCourseTypes(courses);
        setDepartments(initial.departments.map((d) => d.name));
      } else {
        setName(""); setIntakeSeats(""); setEstablishedYear(""); setLocation(""); setState("");
        setCollegeType(""); setLevels([]); setCourseTypes([]); setDepartments([]);
      }
      setError(null);
      setTimeout(() => firstRef.current?.focus(), 80);
    }
  }, [open, initial]);

  useEffect(() => {
    const h = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!collegeType)          { setError("Select Government or Private."); return; }
    if (!levels.length)        { setError("Select at least one level: UG or PG."); return; }
    if (!courseTypes.length)   { setError("Select at least one course type."); return; }

    const payload: CollegePayload = {
      name: name.trim(),
      intake_seats: Number(intakeSeats),
      established_year: Number(establishedYear),
      location: location.trim(),
      state,
      college_type: collegeType as "govt" | "private",
      is_ug: levels.includes("ug"),
      is_pg: levels.includes("pg"),
      has_mbbs: courseTypes.includes("mbbs"),
      has_dental: courseTypes.includes("dental"),
      has_nursing: courseTypes.includes("nursing"),
      departments,
    };

    setLoading(true);
    try {
      const saved = isEdit
        ? await collegeApi.update(initial!.id, payload)
        : await collegeApi.create(payload);
      onSaved(saved);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save college.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;
  const divider = <div style={{ height: "1px", background: "var(--dd-border)", margin: "4px 0" }} />;

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 40,
        background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        animation: "fadeIn 0.15s ease",
      }} />

      <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", pointerEvents: "none" }}>
        <div style={{
          width: "100%", maxWidth: "560px", maxHeight: "calc(100dvh - 32px)",
          background: "var(--dd-bg2)", border: "1px solid var(--dd-border)",
          borderRadius: "24px", boxShadow: "var(--dd-shadow-lg)",
          display: "flex", flexDirection: "column", pointerEvents: "auto",
          animation: "slideUp 0.22s cubic-bezier(0.22,1,0.36,1)", overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ padding: "24px 28px 20px", borderBottom: "1px solid var(--dd-border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "42px", height: "42px", borderRadius: "12px",
                background: isEdit
                  ? "linear-gradient(135deg, #0d9488 0%, #7c3aed 100%)"
                  : "linear-gradient(135deg, #7c3aed 0%, #0d9488 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 24px rgba(124,58,237,0.3)", flexShrink: 0,
              }}>
                {isEdit ? (
                  <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-9 9L3 17l1.586-4.414 9-9z"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 34 34" fill="none">
                    <path d="M17 4L3 11l14 7 14-7-14-7z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" fill="none"/>
                    <path d="M3 11v10l14 7 14-7V11" stroke="white" strokeWidth="1.8" strokeLinejoin="round" fill="none"/>
                  </svg>
                )}
              </div>
              <div>
                <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.125rem", fontWeight: 600, color: "var(--dd-text1)", letterSpacing: "-0.01em" }}>
                  {isEdit ? "Edit College" : "Add College"}
                </h2>
                <p style={{ fontSize: "0.8rem", color: "var(--dd-text3)", marginTop: "2px" }}>
                  {isEdit ? `Editing: ${initial?.name}` : "Fill in all details to register a new college."}
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} style={{ width: "30px", height: "30px", borderRadius: "8px", background: "var(--dd-surface2)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--dd-text2)", flexShrink: 0 }} aria-label="Close">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="1" y1="1" x2="12" y2="12" /><line x1="12" y1="1" x2="1" y2="12" />
              </svg>
            </button>
          </div>

          {/* Scrollable body */}
          <div style={{ overflowY: "auto", flex: 1, padding: "24px 28px" }}>
            <form id="college-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Name */}
              <div>
                <FieldLabel>College Name</FieldLabel>
                <input id="college-name" name="name" ref={firstRef} type="text" required value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. All India Institute of Medical Sciences"
                  style={{ width: "100%", padding: "11px 13px", borderRadius: "10px", background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)", color: "var(--dd-text1)", fontSize: "0.9rem", outline: "none", transition: "all 0.15s", boxSizing: "border-box" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--dd-teal-border)"; e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--dd-teal-bg)"; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--dd-border2)"; e.currentTarget.style.background = "var(--dd-input-bg)"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>

              {/* Intake + Year */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <FieldLabel>Intake Seats</FieldLabel>
                  <StyledInput id="intake" type="number" min={1} value={intakeSeats} onChange={setIntakeSeats} placeholder="e.g. 150" />
                </div>
                <div>
                  <FieldLabel>Established Year</FieldLabel>
                  <StyledInput id="year" type="number" min={1800} max={CURRENT_YEAR} value={establishedYear} onChange={setEstablishedYear} placeholder={`e.g. ${CURRENT_YEAR - 20}`} />
                </div>
              </div>

              {/* Location */}
              <div>
                <FieldLabel hint="(full address)">Location</FieldLabel>
                <StyledInput id="location" value={location} onChange={setLocation}
                  placeholder="e.g. 123 Main Street, Chennai, Tamil Nadu 600001" />
              </div>

              {/* State */}
              <StateSelect value={state} onChange={setState} />

              {divider}

              {/* College type */}
              <div>
                <FieldLabel>College Type</FieldLabel>
                <PillToggle options={[{ label: "Government", value: "govt" }, { label: "Private", value: "private" }]} value={collegeType} onChange={(v) => setCollegeType(v as "govt" | "private")} />
              </div>

              {/* Level */}
              <div>
                <FieldLabel hint="(one or both)">Level</FieldLabel>
                <PillToggle multi options={[{ label: "UG", value: "ug" }, { label: "PG", value: "pg" }]} value={levels} onChange={(v) => setLevels(v as string[])} />
              </div>

              {/* Course type */}
              <div>
                <FieldLabel hint="(one or more)">Course Type</FieldLabel>
                <PillToggle multi options={[{ label: "MBBS", value: "mbbs" }, { label: "Dental", value: "dental" }, { label: "Nursing", value: "nursing" }]} value={courseTypes} onChange={(v) => setCourseTypes(v as string[])} />
              </div>

              {divider}

              {/* Departments */}
              <div>
                <FieldLabel hint="(optional, add as many as needed)">Departments</FieldLabel>
                <DepartmentField departments={departments} onChange={setDepartments} />
              </div>

              {/* Error */}
              {error && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "11px 13px", borderRadius: "10px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)" }}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: "1px" }}>
                    <circle cx="8" cy="8" r="7" stroke="var(--dd-danger)" strokeWidth="1.5" />
                    <line x1="8" y1="5" x2="8" y2="9" stroke="var(--dd-danger)" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="8" cy="11.5" r="0.75" fill="var(--dd-danger)" />
                  </svg>
                  <span style={{ fontSize: "0.8125rem", color: "var(--dd-danger)" }}>{error}</span>
                </div>
              )}
            </form>
          </div>

          {/* Footer */}
          <div style={{ padding: "18px 28px", borderTop: "1px solid var(--dd-border)", display: "flex", gap: "10px", flexShrink: 0 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: "11px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text2)", fontSize: "0.9375rem", fontWeight: 500, cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-border)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; }}
            >Cancel</button>
            <button type="submit" form="college-form" disabled={loading} style={{ flex: 2, padding: "12px", borderRadius: "11px", background: loading ? "var(--dd-border2)" : "linear-gradient(135deg, #7c3aed 0%, #0d9488 100%)", border: "none", color: loading ? "var(--dd-text4)" : "white", fontSize: "0.9375rem", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 4px 24px rgba(124,58,237,0.35)", transition: "all 0.2s" }}>
              {loading ? "Saving…" : isEdit ? "Save Changes" : "Add College"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUp { from { opacity:0; transform:translateY(20px) scale(0.97) } to { opacity:1; transform:translateY(0) scale(1) } }
      `}</style>
    </>
  );
}
