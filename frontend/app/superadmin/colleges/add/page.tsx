"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser, clearSession, getRefreshToken, getAccessToken } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { collegeApi, College, SeatEntryInput, FeeEntryInput, StipendEntryInput } from "@/lib/collegeApi";
import { INDIA_STATES, INDIA_UNION_TERRITORIES } from "@/lib/indiaStates";

/* ─────────────────────────────────────────── helpers ── */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ─────────────────────────────────────────── sub-components ── */
function FieldLabel({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <label style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
      <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--dd-text2)", letterSpacing: "0.01em" }}>
        {children}
      </span>
      {note && <span style={{ fontSize: "0.75rem", color: "var(--dd-text3)", fontWeight: 400 }}>{note}</span>}
    </label>
  );
}

function TextInput({
  label, note, error, id, name, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; note?: string; error?: string }) {
  const [focused, setFocused] = useState(false);
  const fieldId = id ?? `add-college-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
      <FieldLabel note={note}>{label}</FieldLabel>
      <input
        id={fieldId} name={name ?? fieldId}
        {...props}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
        style={{
          padding: "11px 14px", borderRadius: "10px",
          background: "var(--dd-input-bg)",
          border: `1px solid ${error ? "rgba(185,28,28,0.5)" : focused ? "rgba(124,58,237,0.55)" : "var(--dd-border2)"}`,
          color: "var(--dd-text1)", fontSize: "0.9375rem", outline: "none",
          transition: "border-color 0.15s",
          width: "100%", boxSizing: "border-box",
        }}
      />
      {error && <span style={{ fontSize: "0.78rem", color: "var(--dd-danger)", letterSpacing: "0.01em" }}>{error}</span>}
    </div>
  );
}

function PillSingle({
  label, options, value, onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ display: "flex", gap: "8px" }}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button key={opt.value} type="button" onClick={() => onChange(opt.value)} style={{
              padding: "8px 20px", borderRadius: "20px", fontSize: "0.875rem", fontWeight: 500,
              cursor: "pointer", transition: "all 0.15s", border: "1px solid transparent",
              background: active ? "linear-gradient(135deg,#7c3aed 0%,#0d9488 100%)" : "var(--dd-input-bg)",
              borderColor: active ? "transparent" : "var(--dd-border2)",
              color: active ? "#fff" : "var(--dd-text2)",
              boxShadow: active ? "0 4px 16px rgba(124,58,237,0.3)" : "none",
            }}>
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PillMulti({
  label, options, checked, onToggle, error,
}: {
  label: string;
  options: { key: string; label: string }[];
  checked: Record<string, boolean>;
  onToggle: (key: string) => void;
  error?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {options.map((opt) => {
          const active = checked[opt.key];
          return (
            <button key={opt.key} type="button" onClick={() => onToggle(opt.key)} style={{
              padding: "8px 20px", borderRadius: "20px", fontSize: "0.875rem", fontWeight: 500,
              cursor: "pointer", transition: "all 0.15s",
              background: active ? "linear-gradient(135deg,#7c3aed 0%,#0d9488 100%)" : "var(--dd-input-bg)",
              border: active ? "1px solid transparent" : `1px solid ${error ? "rgba(185,28,28,0.4)" : "var(--dd-border2)"}`,
              color: active ? "#fff" : "var(--dd-text2)",
              boxShadow: active ? "0 4px 16px rgba(124,58,237,0.3)" : "none",
            }}>
              {opt.label}
            </button>
          );
        })}
      </div>
      {error && <span style={{ fontSize: "0.78rem", color: "var(--dd-danger)" }}>{error}</span>}
    </div>
  );
}

function DepartmentChips({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState("");

  function commit() {
    const t = input.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setInput("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
      <FieldLabel note="(optional)">Departments</FieldLabel>
      <div style={{
        padding: "9px 11px", borderRadius: "10px", minHeight: "48px",
        background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)",
        display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center",
      }}>
        {value.map((d) => (
          <span key={d} style={{
            display: "inline-flex", alignItems: "center", gap: "4px",
            padding: "3px 10px", borderRadius: "20px",
            background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.3)",
            color: "#7c3aed", fontSize: "0.8125rem", fontWeight: 500,
          }}>
            {d}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== d))} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(124,58,237,0.7)", fontSize: "0.9rem", padding: "0 0 0 2px",
              display: "flex", alignItems: "center", lineHeight: 1,
            }}>&times;</button>
          </span>
        ))}
        <input
          id="add-college-department-input" name="department"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === ",") { e.preventDefault(); commit(); }
          }}
          placeholder={value.length === 0 ? "Type a department and press Enter…" : "Add more…"}
          style={{
            flex: 1, minWidth: "160px", background: "none", border: "none",
            outline: "none", color: "var(--dd-text1)", fontSize: "0.875rem", padding: "2px 4px",
          }}
        />
      </div>
      <span style={{ fontSize: "0.75rem", color: "var(--dd-text3)" }}>Press Enter or comma to add each department</span>
    </div>
  );
}

/* ── Seat breakdown builder ─────────────────────────────────────────────── */
interface DraftSeatRow { key: string; program: string; department: string; seats: string; }
let _seatKey = 0;
function newSeatKey() { return String(++_seatKey); }

const SEAT_INPUT: React.CSSProperties = {
  padding: "8px 10px", borderRadius: "8px",
  background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)",
  color: "var(--dd-text1)", fontSize: "0.875rem", outline: "none",
  width: "100%", boxSizing: "border-box",
};

function SeatEntriesBuilder({
  rows, onChange, programs,
}: {
  rows: DraftSeatRow[];
  onChange: (rows: DraftSeatRow[]) => void;
  programs: string[];
}) {
  const listId = "add-seat-prog-list";

  function addRow() {
    onChange([...rows, { key: newSeatKey(), program: "", department: "", seats: "" }]);
  }
  function removeRow(key: string) {
    onChange(rows.filter((r) => r.key !== key));
  }
  function update(key: string, field: keyof Omit<DraftSeatRow, "key">, value: string) {
    onChange(rows.map((r) => r.key === key ? { ...r, [field]: value } : r));
  }

  return (
    <div>
      <datalist id={listId}>
        {programs.map((p) => <option key={p} value={p} />)}
      </datalist>

      {rows.length > 0 && (
        <div style={{ marginBottom: "8px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 68px 28px", gap: "6px", marginBottom: "6px", paddingBottom: "6px", borderBottom: "1px solid var(--dd-border)" }}>
            {["Program", "Department (optional)", "Seats", ""].map((h, i) => (
              <span key={i} style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.07em", textTransform: "uppercase" }}>{h}</span>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {rows.map((row) => (
              <div key={row.key} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 68px 28px", gap: "6px", alignItems: "center" }}>
                <input id={`seat-program-${row.key}`} name="program" list={listId} value={row.program} onChange={(e) => update(row.key, "program", e.target.value)} placeholder="e.g. MBBS" style={SEAT_INPUT}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(180,83,9,0.45)"; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--dd-border2)"; }} />
                <input id={`seat-department-${row.key}`} name="department" value={row.department} onChange={(e) => update(row.key, "department", e.target.value)} placeholder="e.g. Cardiology" style={SEAT_INPUT}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(180,83,9,0.45)"; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--dd-border2)"; }} />
                <input id={`seat-count-${row.key}`} name="seats" type="number" min="0" value={row.seats} onChange={(e) => update(row.key, "seats", e.target.value)} placeholder="0" style={{ ...SEAT_INPUT, textAlign: "right" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(180,83,9,0.45)"; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--dd-border2)"; }} />
                <button type="button" onClick={() => removeRow(row.key)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dd-text3)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "5px", width: "28px", height: "34px", transition: "all 0.12s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-danger)"; e.currentTarget.style.background = "var(--dd-danger-bg)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)";  e.currentTarget.style.background = "none"; }}
                >
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
                    <line x1="2" y1="2" x2="12" y2="12"/><line x1="12" y1="2" x2="2" y2="12"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button type="button" onClick={addRow}
        style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 13px", borderRadius: "8px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border)", color: "var(--dd-text2)", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", transition: "all 0.14s" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-border2)"; e.currentTarget.style.color = "var(--dd-text1)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text2)"; }}
      >
        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
          <line x1="7" y1="1" x2="7" y2="13"/><line x1="1" y1="7" x2="13" y2="7"/>
        </svg>
        Add row
      </button>

      {rows.length > 0 && (
        <p style={{ fontSize: "0.72rem", color: "var(--dd-text3)", marginTop: "6px", lineHeight: 1.5 }}>
          Leave <strong style={{ color: "var(--dd-text2)" }}>Department</strong> blank when the program itself is the unit (e.g. MBBS = 150).
          Fill it when a program has sub-departments (e.g. PG &rarr; Cardiology = 20).
        </p>
      )}
    </div>
  );
}

/* ── Finance entries builder (fee / stipend) ────────────────────────────── */
interface DraftFinanceRow { key: string; program: string; department: string; amount: string; }
let _finKey = 0;
function newFinKey() { return String(++_finKey); }

function FinanceEntriesBuilder({
  rows, onChange, programs, amountLabel,
}: {
  rows: DraftFinanceRow[];
  onChange: (rows: DraftFinanceRow[]) => void;
  programs: string[];
  amountLabel: string;
}) {
  const listId = `add-fin-prog-list-${amountLabel}`;

  function addRow() {
    onChange([...rows, { key: newFinKey(), program: "", department: "", amount: "" }]);
  }
  function removeRow(key: string) {
    onChange(rows.filter((r) => r.key !== key));
  }
  function update(key: string, field: keyof Omit<DraftFinanceRow, "key">, value: string) {
    onChange(rows.map((r) => r.key === key ? { ...r, [field]: value } : r));
  }

  return (
    <div>
      <datalist id={listId}>
        {programs.map((p) => <option key={p} value={p} />)}
      </datalist>

      {rows.length > 0 && (
        <div style={{ marginBottom: "8px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 88px 28px", gap: "6px", marginBottom: "6px", paddingBottom: "6px", borderBottom: "1px solid var(--dd-border)" }}>
            {["Program", "Department (optional)", amountLabel, ""].map((h, i) => (
              <span key={i} style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.07em", textTransform: "uppercase" }}>{h}</span>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {rows.map((row) => (
              <div key={row.key} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 88px 28px", gap: "6px", alignItems: "center" }}>
                <input id={`finance-program-${row.key}`} name="program" list={listId} value={row.program} onChange={(e) => update(row.key, "program", e.target.value)} placeholder="e.g. MBBS" style={SEAT_INPUT}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(180,83,9,0.45)"; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--dd-border2)"; }} />
                <input id={`finance-department-${row.key}`} name="department" value={row.department} onChange={(e) => update(row.key, "department", e.target.value)} placeholder="e.g. Cardiology" style={SEAT_INPUT}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(180,83,9,0.45)"; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--dd-border2)"; }} />
                <input id={`finance-amount-${row.key}`} name="amount" type="number" min="0" step="1" value={row.amount} onChange={(e) => update(row.key, "amount", e.target.value)} placeholder="0" style={{ ...SEAT_INPUT, textAlign: "right" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(180,83,9,0.45)"; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--dd-border2)"; }} />
                <button type="button" onClick={() => removeRow(row.key)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dd-text3)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "5px", width: "28px", height: "34px", transition: "all 0.12s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-danger)"; e.currentTarget.style.background = "var(--dd-danger-bg)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)";  e.currentTarget.style.background = "none"; }}
                >
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
                    <line x1="2" y1="2" x2="12" y2="12"/><line x1="12" y1="2" x2="2" y2="12"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button type="button" onClick={addRow}
        style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 13px", borderRadius: "8px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border)", color: "var(--dd-text2)", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", transition: "all 0.14s" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-border2)"; e.currentTarget.style.color = "var(--dd-text1)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text2)"; }}
      >
        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
          <line x1="7" y1="1" x2="7" y2="13"/><line x1="1" y1="7" x2="13" y2="7"/>
        </svg>
        Add row
      </button>

      {rows.length > 0 && (
        <p style={{ fontSize: "0.72rem", color: "var(--dd-text3)", marginTop: "6px", lineHeight: 1.5 }}>
          Leave <strong style={{ color: "var(--dd-text2)" }}>Department</strong> blank when the program itself is the unit (e.g. MBBS).
          Enter amounts in whole rupees, no commas.
        </p>
      )}
    </div>
  );
}

function StateSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
      <FieldLabel>State / Union Territory</FieldLabel>
      <div style={{ position: "relative" }}>
        <select
          id="add-college-state" name="state"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%", padding: "11px 36px 11px 14px", borderRadius: "10px",
            background: "var(--dd-input-bg)",
            border: `1px solid ${focused ? "rgba(124,58,237,0.55)" : "var(--dd-border2)"}`,
            color: value ? "var(--dd-text1)" : "var(--dd-text3)",
            fontSize: "0.9375rem", outline: "none",
            appearance: "none", WebkitAppearance: "none",
            cursor: "pointer", boxSizing: "border-box",
            transition: "border-color 0.15s",
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
          position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
          pointerEvents: "none", color: "var(--dd-text3)",
        }} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M4 6l4 4 4-4"/>
        </svg>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── step indicator ── */
function StepIndicator({ step }: { step: 1 | 2 }) {
  const steps = [
    { n: 1, label: "Basic Info" },
    { n: 2, label: "Breakdowns" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "24px" }}>
      {steps.map((s, i) => {
        const done = step > s.n;
        const active = step === s.n;
        return (
          <div key={s.n} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
              <div style={{
                width: "26px", height: "26px", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.75rem", fontWeight: 700,
                background: done
                  ? "linear-gradient(135deg,#7c3aed,#0d9488)"
                  : active
                    ? "rgba(124,58,237,0.15)"
                    : "var(--dd-surface2)",
                border: done
                  ? "none"
                  : active
                    ? "1.5px solid rgba(124,58,237,0.55)"
                    : "1.5px solid var(--dd-border2)",
                color: done ? "#fff" : active ? "#7c3aed" : "var(--dd-text3)",
                transition: "all 0.2s",
              }}>
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2 7 6 11 12 3"/>
                  </svg>
                ) : s.n}
              </div>
              <span style={{
                fontSize: "0.8125rem", fontWeight: active ? 600 : 400,
                color: active ? "var(--dd-text1)" : done ? "var(--dd-text2)" : "var(--dd-text3)",
                transition: "color 0.2s",
              }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: "1px", margin: "0 12px",
                background: done ? "rgba(124,58,237,0.5)" : "var(--dd-border)",
                transition: "background 0.2s",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────── form types ── */
interface FState {
  name: string; intake_seats: string; established_year: string; location: string;
  state: string;
  college_type: "govt" | "private";
  is_ug: boolean; is_pg: boolean;
  has_mbbs: boolean; has_dental: boolean; has_nursing: boolean;
  departments: string[];
}
interface FErrors {
  name?: string; seats?: string; year?: string; location?: string;
  state?: string; level?: string; course?: string;
}

const BLANK: FState = {
  name: "", intake_seats: "", established_year: "", location: "", state: "",
  college_type: "govt", is_ug: false, is_pg: false,
  has_mbbs: false, has_dental: false, has_nursing: false, departments: [],
};

/* ══════════════════════════════════════════════════════ PAGE ══ */
export default function AddCollegePage() {
  const router = useRouter();
  const [step, setStep]             = useState<1 | 2>(1);
  const [user, setUser]             = useState<{ email: string } | null>(null);
  const [form, setForm]             = useState<FState>(BLANK);
  const [errors, setErrors]         = useState<FErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError]     = useState<string | null>(null);
  const [recent, setRecent]         = useState<College[]>([]);
  const [loadingR, setLoadingR]     = useState(true);
  const [flashId, setFlashId]       = useState<number | null>(null);
  const [seatRows,    setSeatRows]    = useState<DraftSeatRow[]>([]);
  const [feeRows,     setFeeRows]     = useState<DraftFinanceRow[]>([]);
  const [stipendRows, setStipendRows] = useState<DraftFinanceRow[]>([]);
  const [seatWarn,    setSeatWarn]    = useState<string | null>(null);
  const [feeWarn,     setFeeWarn]     = useState<string | null>(null);
  const [stipendWarn, setStipendWarn] = useState<string | null>(null);

  useEffect(() => {
    setUser(getUser<{ email: string }>());
    collegeApi.list()
      .then((all) => setRecent(all.slice(0, 10)))
      .catch(() => {})
      .finally(() => setLoadingR(false));
  }, []);

  async function handleLogout() {
    try { await authApi.logout(getRefreshToken()!, getAccessToken()!); } catch {}
    finally { clearSession(); router.replace("/superadmin"); }
  }

  function patch<K extends keyof FState>(key: K, val: FState[K]) {
    setForm((p) => ({ ...p, [key]: val }));
    const eKey = key === "intake_seats" ? "seats" : key === "established_year" ? "year" : key as keyof FErrors;
    if (errors[eKey]) setErrors((p) => ({ ...p, [eKey]: undefined }));
  }

  function toggle(key: "is_ug" | "is_pg" | "has_mbbs" | "has_dental" | "has_nursing") {
    setForm((p) => ({ ...p, [key]: !p[key] }));
    if (["is_ug","is_pg"].includes(key) && errors.level) setErrors((p) => ({ ...p, level: undefined }));
    if (["has_mbbs","has_dental","has_nursing"].includes(key) && errors.course) setErrors((p) => ({ ...p, course: undefined }));
  }

  /* Validates Step 1 required fields before advancing */
  function validateStep1(): boolean {
    const e: FErrors = {};
    if (!form.name.trim()) e.name = "College name is required.";
    const seats = Number(form.intake_seats);
    if (!form.intake_seats || isNaN(seats) || seats < 1) e.seats = "Enter a valid number.";
    const yr = Number(form.established_year);
    const now = new Date().getFullYear();
    if (!form.established_year || isNaN(yr) || yr < 1800 || yr > now)
      e.year = `Must be between 1800 and ${now}.`;
    if (!form.location.trim()) e.location = "Location is required.";
    if (!form.state) e.state = "Please select a state or union territory.";
    if (!form.is_ug && !form.is_pg) e.level = "Select at least one level.";
    if (!form.has_mbbs && !form.has_dental && !form.has_nursing) e.course = "Select at least one course type.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    if (validateStep1()) {
      setErrors({});
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setApiError(null); setSeatWarn(null); setFeeWarn(null); setStipendWarn(null);
    try {
      const created = await collegeApi.create({
        name: form.name.trim(),
        intake_seats: Number(form.intake_seats),
        established_year: Number(form.established_year),
        location: form.location.trim(),
        state: form.state,
        college_type: form.college_type,
        is_ug: form.is_ug, is_pg: form.is_pg,
        has_mbbs: form.has_mbbs, has_dental: form.has_dental, has_nursing: form.has_nursing,
        departments: form.departments,
      });

      if (seatRows.length > 0) {
        const validEntries: SeatEntryInput[] = seatRows
          .filter((r) => r.program.trim() && r.seats.trim() !== "" && !isNaN(Number(r.seats)) && Number(r.seats) >= 0)
          .map((r, i) => ({
            program:       r.program.trim(),
            department:    r.department.trim(),
            seats:         Number(r.seats),
            display_order: i,
          }));
        if (validEntries.length > 0) {
          try {
            await collegeApi.seatEntries.replace(created.id, validEntries);
          } catch {
            setSeatWarn("College added, but seat entries could not be saved. Open the college detail page → Intake Seats to add them.");
          }
        }
      }

      if (feeRows.length > 0) {
        const validFees: FeeEntryInput[] = feeRows
          .filter((r) => r.program.trim() && r.amount.trim() !== "" && !isNaN(Number(r.amount)) && Number.isInteger(Number(r.amount)) && Number(r.amount) >= 0)
          .map((r, i) => ({
            program:       r.program.trim(),
            department:    r.department.trim(),
            amount:        Number(r.amount),
            display_order: i,
          }));
        if (validFees.length > 0) {
          try {
            await collegeApi.feeEntries.replace(created.id, validFees);
          } catch {
            setFeeWarn("College added, but fee entries could not be saved. Open the college detail page → Fee to add them.");
          }
        }
      }

      if (stipendRows.length > 0) {
        const validStipends: StipendEntryInput[] = stipendRows
          .filter((r) => r.program.trim() && r.amount.trim() !== "" && !isNaN(Number(r.amount)) && Number.isInteger(Number(r.amount)) && Number(r.amount) >= 0)
          .map((r, i) => ({
            program:       r.program.trim(),
            department:    r.department.trim(),
            amount:        Number(r.amount),
            display_order: i,
          }));
        if (validStipends.length > 0) {
          try {
            await collegeApi.stipendEntries.replace(created.id, validStipends);
          } catch {
            setStipendWarn("College added, but stipend entries could not be saved. Open the college detail page → Stipend to add them.");
          }
        }
      }

      setRecent((prev) => [created, ...prev].slice(0, 10));
      setFlashId(created.id);
      setTimeout(() => setFlashId(null), 3500);
      setForm(BLANK);
      setSeatRows([]);
      setFeeRows([]);
      setStipendRows([]);
      setStep(1);
      setSeatWarn(null);
      setFeeWarn(null);
      setStipendWarn(null);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Failed to add college. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const programs = [
    ...(form.is_ug && form.has_mbbs    ? ["MBBS"]    : []),
    ...(form.is_ug && form.has_dental   ? ["Dental"]  : []),
    ...(form.is_ug && form.has_nursing  ? ["Nursing"] : []),
    ...(form.is_pg                      ? ["PG"]      : []),
  ];

  /* ── render ── */
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
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, overflow: "hidden" }}>
          <button onClick={() => router.push("/about")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Darkdoctor" draggable={false}
              style={{ height: "28px", width: "auto", objectFit: "contain" }} />
          </button>
          <span style={{ color: "var(--dd-border2)" }}>/</span>
          <button onClick={() => router.push("/superadmin/home")} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--dd-text2)", fontSize: "0.9375rem", fontWeight: 500, padding: 0,
          }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-text1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text2)"; }}
          >Dashboard</button>
          <span style={{ color: "var(--dd-border2)" }}>/</span>
          <span style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--dd-text1)" }}>Add College</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <span className="dd-admin-nav-email" style={{ fontSize: "0.8125rem", color: "var(--dd-text3)" }}>{user?.email}</span>
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
      <main style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 20px 80px" }}>

        {/* Page header */}
        <div style={{ marginBottom: "32px" }}>
          <button onClick={() => router.push("/superadmin/home")} style={{
            display: "inline-flex", alignItems: "center", gap: "5px",
            background: "none", border: "none", cursor: "pointer",
            color: "var(--dd-text3)", fontSize: "0.8125rem", fontWeight: 500, padding: 0, marginBottom: "16px",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-text2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)"; }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 12L6 8l4-4"/></svg>
            Back to Dashboard
          </button>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.6rem,4vw,2rem)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "6px", color: "var(--dd-text1)" }}>
                Add College
              </h1>
              <p style={{ fontSize: "0.9rem", color: "var(--dd-text3)" }}>
                Register a new college. It appears in College Information immediately.
              </p>
            </div>
            <button
              onClick={() => router.push("/superadmin/colleges/bulk-import")}
              style={{
                display: "flex", alignItems: "center", gap: "7px",
                padding: "9px 16px", borderRadius: "10px", cursor: "pointer",
                background: "rgba(50,173,230,0.08)", border: "1px solid rgba(50,173,230,0.22)",
                color: "#32ade6", fontSize: "0.8125rem", fontWeight: 500,
                transition: "all 0.15s", flexShrink: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(50,173,230,0.15)"; e.currentTarget.style.borderColor = "rgba(50,173,230,0.4)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(50,173,230,0.08)"; e.currentTarget.style.borderColor = "rgba(50,173,230,0.22)"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Bulk Import
            </button>
          </div>
        </div>

        {/* Two-column layout */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1.45fr) minmax(0,1fr)",
          gap: "20px", alignItems: "start",
        }} className="add-college-grid">

          {/* ── LEFT – Form ── */}
          <div style={{
            background: "var(--dd-bg2)",
            border: "1px solid var(--dd-border)",
            borderRadius: "20px", padding: "28px",
          }}>
            <StepIndicator step={step} />

            {/* ════ STEP 1: Basic Info ════ */}
            {step === 1 && (
              <form onSubmit={handleContinue} style={{ display: "flex", flexDirection: "column", gap: "22px" }}>

                <TextInput label="College Name" placeholder="e.g. Government Medical College, Chennai"
                  value={form.name} onChange={(e) => patch("name", e.target.value)} error={errors.name} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <TextInput label="Intake Seats" type="number" placeholder="e.g. 150" min="1"
                    value={form.intake_seats} onChange={(e) => patch("intake_seats", e.target.value)} error={errors.seats} />
                  <TextInput label="Established Year" type="number" placeholder="e.g. 1985"
                    min="1800" max={new Date().getFullYear()}
                    value={form.established_year} onChange={(e) => patch("established_year", e.target.value)} error={errors.year} />
                </div>

                <TextInput label="Location" note="(full address)" placeholder="e.g. 123 Main Street, Chennai, Tamil Nadu 600001"
                  value={form.location} onChange={(e) => patch("location", e.target.value)} error={errors.location} />

                <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                  <StateSelect value={form.state} onChange={(v) => patch("state", v)} />
                  {errors.state && <span style={{ fontSize: "0.78rem", color: "var(--dd-danger)" }}>{errors.state}</span>}
                </div>

                <PillSingle label="College Type"
                  options={[{ value: "govt", label: "Government" }, { value: "private", label: "Private" }]}
                  value={form.college_type} onChange={(v) => patch("college_type", v as "govt" | "private")} />

                <PillMulti
                  label="Level"
                  options={[{ key: "is_ug", label: "Undergraduate (UG)" }, { key: "is_pg", label: "Postgraduate (PG)" }]}
                  checked={{ is_ug: form.is_ug, is_pg: form.is_pg }}
                  onToggle={(k) => toggle(k as "is_ug" | "is_pg")}
                  error={errors.level}
                />

                <PillMulti
                  label="Course Types"
                  options={[{ key: "has_mbbs", label: "MBBS" }, { key: "has_dental", label: "Dental" }, { key: "has_nursing", label: "Nursing" }]}
                  checked={{ has_mbbs: form.has_mbbs, has_dental: form.has_dental, has_nursing: form.has_nursing }}
                  onToggle={(k) => toggle(k as "has_mbbs" | "has_dental" | "has_nursing")}
                  error={errors.course}
                />

                <DepartmentChips value={form.departments} onChange={(d) => patch("departments", d)} />

                {/* Continue button */}
                <button type="submit" style={{
                  padding: "13px", borderRadius: "12px",
                  background: "linear-gradient(135deg,#7c3aed 0%,#0d9488 100%)",
                  border: "none", color: "white",
                  fontSize: "0.9375rem", fontWeight: 600, cursor: "pointer",
                  boxShadow: "0 4px 24px rgba(124,58,237,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                >
                  Continue
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 8h8M9 5l3 3-3 3"/>
                  </svg>
                </button>
              </form>
            )}

            {/* ════ STEP 2: Breakdown Details ════ */}
            {step === 2 && (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "22px" }}>

                {/* Summary of step 1 choices */}
                <div style={{
                  padding: "12px 14px", borderRadius: "12px",
                  background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.15)",
                  display: "flex", flexDirection: "column", gap: "4px",
                }}>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#7c3aed" }}>{form.name}</span>
                  <span style={{ fontSize: "0.78rem", color: "var(--dd-text3)" }}>
                    {form.state && `${form.state} · `}
                    {form.college_type === "govt" ? "Government" : "Private"}
                    {form.is_ug && " · UG"}
                    {form.is_pg && " · PG"}
                    {form.has_mbbs && " · MBBS"}
                    {form.has_dental && " · Dental"}
                    {form.has_nursing && " · Nursing"}
                  </span>
                </div>

                <p style={{ fontSize: "0.8125rem", color: "var(--dd-text3)", margin: 0, lineHeight: 1.5 }}>
                  All fields below are <strong style={{ color: "var(--dd-text2)" }}>optional</strong>. Add breakdowns now or fill them later from the college detail page.
                </p>

                {/* Seat Breakdown */}
                <div>
                  <FieldLabel note="(optional, per-program seat breakdown)">Seat Breakdown</FieldLabel>
                  <SeatEntriesBuilder rows={seatRows} onChange={setSeatRows} programs={programs} />
                </div>

                {/* Fee Breakdown */}
                <div>
                  <FieldLabel note="(optional, annual fee per program in ₹)">Fee Breakdown</FieldLabel>
                  <FinanceEntriesBuilder rows={feeRows} onChange={setFeeRows} amountLabel="Amount ₹/yr" programs={programs} />
                </div>

                {/* Stipend Breakdown */}
                <div>
                  <FieldLabel note="(optional, monthly stipend per program in ₹)">Stipend Breakdown</FieldLabel>
                  <FinanceEntriesBuilder rows={stipendRows} onChange={setStipendRows} amountLabel="Amount ₹/mo" programs={programs} />
                </div>

                {/* Non-fatal warnings */}
                {seatWarn && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 13px", borderRadius: "9px", background: "var(--dd-warning-bg)", border: "1px solid var(--dd-warning-border)" }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ stroke: "var(--dd-warning)", flexShrink: 0, marginTop: "1px" }} strokeWidth="1.6" strokeLinecap="round">
                      <circle cx="8" cy="8" r="7"/><line x1="8" y1="5.5" x2="8" y2="9.5"/><circle cx="8" cy="11.5" r="0.7" fill="var(--dd-warning)" stroke="none"/>
                    </svg>
                    <span style={{ fontSize: "0.8125rem", color: "var(--dd-warning)", lineHeight: 1.5 }}>{seatWarn}</span>
                  </div>
                )}
                {feeWarn && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 13px", borderRadius: "9px", background: "var(--dd-warning-bg)", border: "1px solid var(--dd-warning-border)" }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ stroke: "var(--dd-warning)", flexShrink: 0, marginTop: "1px" }} strokeWidth="1.6" strokeLinecap="round">
                      <circle cx="8" cy="8" r="7"/><line x1="8" y1="5.5" x2="8" y2="9.5"/><circle cx="8" cy="11.5" r="0.7" fill="var(--dd-warning)" stroke="none"/>
                    </svg>
                    <span style={{ fontSize: "0.8125rem", color: "var(--dd-warning)", lineHeight: 1.5 }}>{feeWarn}</span>
                  </div>
                )}
                {stipendWarn && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 13px", borderRadius: "9px", background: "var(--dd-warning-bg)", border: "1px solid var(--dd-warning-border)" }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ stroke: "var(--dd-warning)", flexShrink: 0, marginTop: "1px" }} strokeWidth="1.6" strokeLinecap="round">
                      <circle cx="8" cy="8" r="7"/><line x1="8" y1="5.5" x2="8" y2="9.5"/><circle cx="8" cy="11.5" r="0.7" fill="var(--dd-warning)" stroke="none"/>
                    </svg>
                    <span style={{ fontSize: "0.8125rem", color: "var(--dd-warning)", lineHeight: 1.5 }}>{stipendWarn}</span>
                  </div>
                )}

                {/* API error */}
                {apiError && (
                  <div style={{
                    padding: "12px 14px", borderRadius: "10px",
                    background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)",
                  }}>
                    <span style={{ fontSize: "0.875rem", color: "var(--dd-danger)" }}>{apiError}</span>
                  </div>
                )}

                {/* Back + Create buttons */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => { setStep(1); setApiError(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    style={{
                      padding: "13px", borderRadius: "12px",
                      background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)",
                      color: "var(--dd-text2)", fontSize: "0.9375rem", fontWeight: 500, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-border2)"; e.currentTarget.style.color = "var(--dd-text1)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text2)"; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M12 8H4M7 11l-3-3 3-3"/>
                    </svg>
                    Back
                  </button>

                  <button type="submit" disabled={submitting} style={{
                    padding: "13px", borderRadius: "12px",
                    background: submitting ? "rgba(124,58,237,0.35)" : "linear-gradient(135deg,#7c3aed 0%,#0d9488 100%)",
                    border: "none", color: "white",
                    fontSize: "0.9375rem", fontWeight: 600,
                    cursor: submitting ? "not-allowed" : "pointer",
                    boxShadow: submitting ? "none" : "0 4px 24px rgba(124,58,237,0.35)",
                    transition: "opacity 0.2s",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    opacity: submitting ? 0.65 : 1,
                  }}
                    onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.opacity = "0.88"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = submitting ? "0.65" : "1"; }}
                  >
                    {submitting ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                          style={{ animation: "dd-spin 0.8s linear infinite" }}>
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                        </svg>
                        Adding&hellip;
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                          <line x1="7" y1="1" x2="7" y2="13"/><line x1="1" y1="7" x2="13" y2="7"/>
                        </svg>
                        Create College
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* ── RIGHT – Recently Added ── */}
          <div style={{ position: "sticky", top: "76px" }}>
            <div style={{
              background: "var(--dd-bg2)",
              border: "1px solid var(--dd-border)",
              borderRadius: "20px", overflow: "hidden",
            }}>
              <div style={{
                padding: "18px 22px 14px",
                borderBottom: "1px solid var(--dd-border)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "0.9375rem", fontWeight: 600, letterSpacing: "-0.01em", marginBottom: "2px", color: "var(--dd-text1)" }}>
                    Recently Added
                  </h2>
                  <p style={{ fontSize: "0.78rem", color: "var(--dd-text3)" }}>Last 10 colleges</p>
                </div>
                <button onClick={() => router.push("/colleges")} style={{
                  display: "inline-flex", alignItems: "center", gap: "3px",
                  background: "none", border: "none", cursor: "pointer",
                  color: "#7c3aed", fontSize: "0.8125rem", fontWeight: 500, padding: 0,
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#9161f0"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#7c3aed"; }}
                >
                  View all
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 4l4 4-4 4"/></svg>
                </button>
              </div>

              {loadingR ? (
                <div style={{ padding: "36px", textAlign: "center", color: "var(--dd-text3)", fontSize: "0.875rem" }}>
                  Loading&hellip;
                </div>
              ) : recent.length === 0 ? (
                <div style={{ padding: "44px 22px", textAlign: "center" }}>
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "12px",
                    background: "var(--dd-surface2)", border: "1px solid var(--dd-border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 12px",
                  }}>
                    <svg width="20" height="20" viewBox="0 0 34 34" fill="none" style={{ stroke: "var(--dd-text3)" }} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 4L3 11l14 7 14-7-14-7z"/><path d="M3 11v10l14 7 14-7V11"/>
                    </svg>
                  </div>
                  <p style={{ color: "var(--dd-text3)", fontSize: "0.875rem", fontWeight: 500 }}>No colleges yet</p>
                  <p style={{ color: "var(--dd-text3)", fontSize: "0.78rem", marginTop: "4px" }}>
                    Colleges you add will appear here.
                  </p>
                </div>
              ) : (
                <div>
                  {recent.map((c, i) => {
                    const isFlash = c.id === flashId;
                    const isGovt = c.college_type === "govt";
                    return (
                      <div key={c.id}>
                        {i > 0 && <div style={{ height: "1px", background: "var(--dd-border)", margin: "0 22px" }} />}
                        <div
                          onClick={() => router.push(`/colleges/${c.id}`)}
                          style={{
                            padding: "13px 22px", cursor: "pointer",
                            background: isFlash ? "rgba(124,58,237,0.09)" : "transparent",
                            transition: "background 0.5s",
                          }}
                          onMouseEnter={(e) => { if (!isFlash) e.currentTarget.style.background = "var(--dd-surface2)"; }}
                          onMouseLeave={(e) => { if (!isFlash) e.currentTarget.style.background = "transparent"; }}
                        >
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", justifyContent: "space-between" }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "4px", flexWrap: "wrap" }}>
                                {isFlash && (
                                  <span style={{
                                    fontSize: "0.6875rem", padding: "1px 7px", borderRadius: "20px",
                                    background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.35)",
                                    color: "#7c3aed", fontWeight: 600, letterSpacing: "0.02em",
                                  }}>NEW</span>
                                )}
                                <span style={{
                                  fontSize: "0.6875rem", padding: "1px 7px", borderRadius: "20px", fontWeight: 500,
                                  background: isGovt ? "var(--dd-teal-bg)" : "rgba(124,58,237,0.1)",
                                  border: `1px solid ${isGovt ? "var(--dd-teal-border)" : "rgba(124,58,237,0.2)"}`,
                                  color: isGovt ? "var(--dd-teal)" : "#7c3aed",
                                }}>
                                  {isGovt ? "Govt" : "Private"}
                                </span>
                              </div>
                              <div style={{
                                fontSize: "0.875rem", fontWeight: 500, color: "var(--dd-text1)",
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}>{c.name}</div>
                              <div style={{
                                fontSize: "0.78rem", color: "var(--dd-text3)", marginTop: "2px",
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}>{c.location}</div>
                            </div>
                            <span style={{
                              fontSize: "0.72rem", color: "var(--dd-text3)",
                              whiteSpace: "nowrap", marginTop: "2px", flexShrink: 0,
                            }}>{timeAgo(c.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes dd-spin { to { transform: rotate(360deg); } }
        select option { background: var(--dd-bg2); color: var(--dd-text1); }
        @media (max-width: 760px) {
          .add-college-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 560px) {
          .dd-admin-nav-email { display: none; }
        }
      `}</style>
    </div>
  );
}
