"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import UserShell from "@/components/UserShell";
import { profileApi, STATUS_OPTIONS, type StatusValue, type UserProfile } from "@/lib/profileApi";
import { collegeApi, type College } from "@/lib/collegeApi";
import { DEPARTMENT_GROUPS } from "@/lib/departments";
import { authApi } from "@/lib/api";
import { saveSession, getAccessToken, getRefreshToken, getUser, isAuthenticated, FEED_PREFS_KEY } from "@/lib/auth";
import EmailVerifyModal from "@/components/EmailVerifyModal";
import CollegeChangeRequestModal from "@/components/CollegeChangeRequestModal";
import { collegeChangeApi, type CollegeField, type CollegeChangeRequestItem } from "@/lib/collegeChangeApi";

function collegeFields(status: StatusValue, edu: "ug" | "pg" | "") {
  switch (status) {
    case "ug_aspirant":
    case "ug_student":
      return { showUg: true,  showPg: false, needsEdu: false };
    case "pg_aspirant":
      return { showUg: true,  showPg: true,  needsEdu: false };
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

const UG_LABEL: Record<StatusValue, string> = {
  ug_aspirant: "Target College (UG)", ug_student: "Current College",
  pg_student: "UG College", working_professional: "UG College Attended",
  alumni: "UG College Attended", pg_aspirant: "UG College Attended",
  faculty: "UG College Attended", other: "", "": "",
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "8px" }}>
      {children}
    </div>
  );
}

function Input({ id, value, onChange, placeholder, type = "text" }: {
  id: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      id={id} name={id}
      type={type} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%", padding: "11px 14px", borderRadius: "12px",
        background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)",
        color: "var(--dd-text1)", fontSize: "0.9375rem", outline: "none",
        boxSizing: "border-box", transition: "border-color 0.15s",
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(21,128,61,0.5)"; }}
      onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--dd-border2)"; }}
    />
  );
}

function Textarea({ id, value, onChange, placeholder, rows = 3 }: {
  id: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      id={id} name={id}
      value={value} placeholder={placeholder} rows={rows}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%", padding: "11px 14px", borderRadius: "12px",
        background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)",
        color: "var(--dd-text1)", fontSize: "0.9375rem", outline: "none",
        resize: "vertical", fontFamily: "inherit", lineHeight: "1.5",
        boxSizing: "border-box", transition: "border-color 0.15s",
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(21,128,61,0.5)"; }}
      onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--dd-border2)"; }}
    />
  );
}

function CollegeSelect({ colleges, value, onChange, label, placeholder }: {
  colleges: College[]; value: number | null; onChange: (id: number | null) => void;
  label: string; placeholder?: string;
}) {
  const [open, setOpen]               = useState(false);
  const [query, setQuery]             = useState("");
  const [highlighted, setHighlighted] = useState<number>(-1);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLUListElement>(null);
  const selectedCollege = colleges.find((c) => c.id === value) ?? null;
  const filtered = query.trim()
    ? colleges.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || (c.state ?? "").toLowerCase().includes(query.toLowerCase()))
    : colleges;

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) { setOpen(false); setQuery(""); setHighlighted(-1); }
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

  function openDropdown() { setOpen(true); setQuery(""); setHighlighted(-1); setTimeout(() => inputRef.current?.focus(), 0); }
  function selectItem(college: College) { onChange(college.id); setOpen(false); setQuery(""); setHighlighted(-1); }
  function clearSelection(e: React.MouseEvent) { e.stopPropagation(); onChange(null); setOpen(false); setQuery(""); }
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (highlighted >= 0 && filtered[highlighted]) selectItem(filtered[highlighted]); }
    else if (e.key === "Escape") { setOpen(false); setQuery(""); }
  }

  return (
    <div>
      <Label>{label}</Label>
      <div ref={wrapRef} style={{ position: "relative", userSelect: "none" }}>
        <div onClick={openDropdown} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderRadius: "12px", cursor: "pointer", background: "var(--dd-input-bg)", border: `1px solid ${open ? "rgba(21,128,61,0.5)" : "var(--dd-border2)"}`, transition: "border-color 0.15s", minHeight: "44px" }}>
          <span style={{ fontSize: "0.9375rem", color: selectedCollege ? "var(--dd-text1)" : "var(--dd-text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
            {selectedCollege ? `${selectedCollege.name}${selectedCollege.state ? `, ${selectedCollege.state}` : ""}` : (placeholder ?? "Select college…")}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, marginLeft: "8px" }}>
            {selectedCollege && (
              <button onClick={clearSelection} title="Clear selection" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "2px", color: "var(--dd-text3)", borderRadius: "4px" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--dd-text1)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--dd-text3)"; }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
              </button>
            )}
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ color: "var(--dd-text3)", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
              <path d="M4 6l4 4 4-4"/>
            </svg>
          </div>
        </div>

        {open && (
          <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 100, background: "var(--dd-bg2)", border: "1px solid var(--dd-border2)", borderRadius: "14px", boxShadow: "var(--dd-shadow-lg)", overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--dd-border)", display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "var(--dd-text3)" }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input
                id={`college-search-${label.toLowerCase().replace(/\s+/g, "-")}`}
                name="college-search"
                ref={inputRef} type="text" value={query} onChange={(e) => { setQuery(e.target.value); setHighlighted(0); }} onKeyDown={handleKeyDown} placeholder="Search college name or state…" style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--dd-text1)", fontSize: "0.875rem" }} />
              {query && (
                <button onClick={() => { setQuery(""); setHighlighted(-1); inputRef.current?.focus(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dd-text3)", padding: 0, display: "flex", alignItems: "center" }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
                </button>
              )}
            </div>
            <ul ref={listRef} style={{ listStyle: "none", margin: 0, padding: "6px 0", maxHeight: "240px", overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <li style={{ padding: "12px 16px", color: "var(--dd-text3)", fontSize: "0.875rem", textAlign: "center" }}>No colleges found</li>
              ) : filtered.map((c, idx) => {
                const isActive = c.id === value; const isHovered = idx === highlighted;
                return (
                  <li key={c.id} onClick={() => selectItem(c)} onMouseEnter={() => setHighlighted(idx)} style={{ padding: "10px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", background: isHovered ? "rgba(21,128,61,0.07)" : "transparent", transition: "background 0.1s" }}>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: isActive ? "var(--dd-success)" : "var(--dd-text1)", fontWeight: isActive ? 600 : 400 }}>{c.name}</div>
                      {c.state && <div style={{ fontSize: "0.75rem", color: "var(--dd-text3)", marginTop: "2px" }}>{c.state}</div>}
                    </div>
                    {isActive && <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--dd-success)" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M3 8l4 4 6-7"/></svg>}
                  </li>
                );
              })}
            </ul>
            {filtered.length > 0 && (
              <div style={{ padding: "6px 14px 8px", borderTop: "1px solid var(--dd-border)", display: "flex", gap: "12px" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--dd-text4)" }}>↑↓ navigate</span>
                <span style={{ fontSize: "0.7rem", color: "var(--dd-text4)" }}>↵ select</span>
                <span style={{ fontSize: "0.7rem", color: "var(--dd-text4)" }}>esc close</span>
                {filtered.length < colleges.length && <span style={{ fontSize: "0.7rem", color: "var(--dd-text4)", marginLeft: "auto" }}>{filtered.length} of {colleges.length}</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LockedCollegeField({ label, collegeName, pending, onRequestChange }: {
  label: string; collegeName: string | null; pending: boolean; onRequestChange: () => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "11px 14px", borderRadius: "12px", background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)", minHeight: "44px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--dd-text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          <span style={{ fontSize: "0.9375rem", color: "var(--dd-text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {collegeName ?? "Not set"}
          </span>
        </div>
        {pending ? (
          <span style={{ fontSize: "0.75rem", color: "var(--dd-text3)", fontWeight: 600, flexShrink: 0 }}>Request pending</span>
        ) : (
          <button type="button" onClick={onRequestChange} style={{ background: "none", border: "none", padding: 0, color: "var(--dd-teal)", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
            Request change
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: "18px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)", padding: "22px 22px 20px" }}>
      <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--dd-success)", letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: "18px" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [mounted,        setMounted]        = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [hasProfile,     setHasProfile]     = useState(false);
  const [colleges,       setColleges]       = useState<College[]>([]);
  const [fullName,       setFullName]       = useState("");
  const [username,       setUsername]       = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle"|"checking"|"available"|"taken"|"invalid">("idle");
  const [usernameMsg,    setUsernameMsg]    = useState("");
  const [initialUsername, setInitialUsername] = useState("");
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [email,          setEmail]          = useState("");
  const [emailVerified,  setEmailVerified]  = useState(false);
  const [verifyOpen,     setVerifyOpen]     = useState(false);
  // Guards against the initial profile fetch (which can still be in flight
  // alongside the slower colleges fetch) overwriting a verification the user
  // just completed with the stale pre-verification value.
  const verifiedLocallyRef = useRef(false);
  const [status,         setStatus]         = useState<StatusValue>("");
  const [highestEdu,     setHighestEdu]     = useState<"ug" | "pg" | "">("");
  const [ugCollege,      setUgCollege]      = useState<number | null>(null);
  const [pgCollege,      setPgCollege]      = useState<number | null>(null);
  const [ugCollegeLocked, setUgCollegeLocked] = useState(false);
  const [pgCollegeLocked, setPgCollegeLocked] = useState(false);
  const [pendingChangeFields, setPendingChangeFields] = useState<Set<CollegeField>>(new Set());
  const [changeRequestField, setChangeRequestField] = useState<CollegeField | null>(null);
  const [pgDepartment,   setPgDepartment]   = useState("");
  const [batch,          setBatch]          = useState("");
  const [phone,          setPhone]          = useState("");
  const [address,        setAddress]        = useState("");
  const [saving,         setSaving]         = useState(false);
  const [saveLabel,      setSaveLabel]      = useState<"idle" | "saving" | "saved">("idle");
  const [error,          setError]          = useState("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

  const { showUg, showPg, needsEdu } = collegeFields(status, highestEdu);
  const needsBatch = status === "ug_student" || status === "pg_student" || status === "alumni";
  const ugColleges = colleges.filter((c) => c.is_ug);
  const pgColleges = colleges.filter((c) => c.is_pg);

  const fillForm = useCallback((p: UserProfile) => {
    setHasProfile(p.has_profile); setEmail(p.email ?? "");
    if (!verifiedLocallyRef.current) setEmailVerified(!!p.email_verified);
    setFullName(p.full_name ?? "");
    setUsername(p.username ?? ""); setInitialUsername(p.username ?? "");
    setStatus((p.current_status as StatusValue) ?? "");
    setHighestEdu((p.highest_education as "ug" | "pg" | "") ?? "");
    setUgCollege(p.ug_college ?? null); setPgCollege(p.pg_college ?? null);
    setUgCollegeLocked(!!p.ug_college_locked); setPgCollegeLocked(!!p.pg_college_locked);
    setPgDepartment(p.pg_department ?? "");
    setBatch(p.batch ?? "");
    setPhone(p.phone ?? ""); setAddress(p.address ?? "");
  }, []);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated()) { setLoading(false); router.replace("/profile"); return; }
    Promise.allSettled([profileApi.get(), collegeApi.list(), collegeChangeApi.mine()])
      .then(([profileResult, collegesResult, requestsResult]) => {
        if (profileResult.status === "fulfilled") fillForm(profileResult.value);
        else {
          const session = getUser<{ email: string; full_name: string }>();
          if (session) { setEmail(session.email ?? ""); setFullName(session.full_name ?? ""); }
        }
        if (collegesResult.status === "fulfilled") setColleges(collegesResult.value);
        if (requestsResult.status === "fulfilled") {
          setPendingChangeFields(new Set(
            requestsResult.value.filter((r) => r.status === "pending").map((r) => r.field)
          ));
        }
      })
      .finally(() => setLoading(false));
  }, [mounted, fillForm, router]);

  function checkUsername(value: string) {
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    const trimmed = value.trim();
    if (trimmed === initialUsername) { setUsernameStatus("idle"); setUsernameMsg(""); return; }
    if (!trimmed) { setUsernameStatus("idle"); setUsernameMsg(""); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) { setUsernameStatus("invalid"); setUsernameMsg("Letters, numbers and underscores only."); return; }
    if (trimmed.length < 3) { setUsernameStatus("invalid"); setUsernameMsg("At least 3 characters."); return; }
    setUsernameStatus("checking"); setUsernameMsg("");
    usernameTimer.current = setTimeout(async () => {
      try {
        const res = await authApi.checkUsername(trimmed);
        if (res.available) { setUsernameStatus("available"); setUsernameMsg("Username is available!"); }
        else               { setUsernameStatus("taken");     setUsernameMsg(res.error || "Username already taken."); }
      } catch { setUsernameStatus("idle"); setUsernameMsg(""); }
    }, 500);
  }

  function handleStatusChange(v: StatusValue) { setStatus(v); setHighestEdu(""); setUgCollege(null); setPgCollege(null); setBatch(""); }
  function handleEduChange(v: "ug" | "pg") { setHighestEdu(v); if (v === "ug") setPgCollege(null); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError("");
    if (!fullName.trim()) { setError("Full name is required."); return; }
    if (!username.trim()) { setError("Please set a username."); return; }
    if (usernameStatus === "taken")    { setError("That username is already taken. Pick another."); return; }
    if (usernameStatus === "invalid")  { setError(usernameMsg || "Invalid username."); return; }
    if (usernameStatus === "checking") { setError("Please wait, checking username…"); return; }
    if (!email.trim()) { setError("Email address is required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Please enter a valid email address."); return; }
    if (needsBatch && !batch.trim()) { setError("Please enter your batch year."); return; }
    setSaving(true); setSaveLabel("saving");
    const payload = {
      full_name: fullName.trim(), email: email.trim(),
      current_status: status || undefined,
      highest_education: needsEdu ? (highestEdu || undefined) : undefined,
      ug_college: showUg ? (ugCollege ?? null) : null,
      pg_college: showPg ? (pgCollege ?? null) : null,
      pg_department: showPg ? pgDepartment : "",
      batch: needsBatch ? batch.trim() : "",
      phone: phone.trim(), address: address.trim(),
    };
    try {
      const trimmedUsername = username.trim();
      if (trimmedUsername !== initialUsername) await authApi.updateUsername(trimmedUsername);
      const updated = hasProfile ? await profileApi.update(payload) : await profileApi.create(payload);
      // A fresh save response is always authoritative, even over a verification done earlier this session.
      verifiedLocallyRef.current = false;
      fillForm(updated); setUsername(trimmedUsername);
      const accessToken = getAccessToken(); const refreshToken = getRefreshToken();
      const session = getUser<{ email: string; full_name: string; role: string }>();
      if (session && accessToken && refreshToken) saveSession(accessToken, refreshToken, { ...session, full_name: updated.full_name, email: updated.email, email_verified: updated.email_verified, ug_college: updated.ug_college ?? null, pg_college: updated.pg_college ?? null });
      if (updated.current_status) {
        sessionStorage.setItem(FEED_PREFS_KEY, JSON.stringify({ status: updated.current_status, highestEdu: updated.highest_education || "", ugCollege: updated.ug_college ?? null, pgCollege: updated.pg_college ?? null }));
      } else { sessionStorage.removeItem(FEED_PREFS_KEY); }
      setSaveLabel("saved");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSaveLabel("idle"), 2200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
      setSaveLabel("idle");
    } finally { setSaving(false); }
  }

  if (loading) {
    return (
      <UserShell>
        <main style={{ maxWidth: "640px", margin: "0 auto", padding: "52px 20px 80px" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: i === 1 ? "60px" : "140px", borderRadius: "18px", background: "var(--dd-surface2)", marginBottom: "14px", animation: "pulse 1.4s ease-in-out infinite" }} />
          ))}
          <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.7} }`}</style>
        </main>
      </UserShell>
    );
  }

  const fields: { label: string; done: boolean; weight: number }[] = [
    { label: "Full name",      done: !!fullName.trim(),  weight: 20 },
    { label: "Username",       done: !!username.trim(),  weight: 15 },
    { label: "Current status", done: !!status,           weight: 20 },
    { label: "UG college",     done: showUg ? !!ugCollege : true, weight: showUg ? 20 : 0 },
    { label: "PG college",     done: showPg ? !!pgCollege : true, weight: showPg ? 10 : 0 },
    { label: "PG specialty",   done: showPg ? !!pgDepartment : true, weight: showPg ? 10 : 0 },
    { label: "Batch year",     done: needsBatch ? !!batch.trim() : true, weight: needsBatch ? 10 : 0 },
    { label: "Phone",          done: !!phone.trim(),     weight: 5  },
    { label: "Address",        done: !!address.trim(),   weight: 5  },
  ];
  const totalWeight = fields.reduce((s, f) => s + f.weight, 0);
  const doneWeight  = fields.reduce((s, f) => s + (f.done ? f.weight : 0), 0);
  const pct         = totalWeight ? Math.round((doneWeight / totalWeight) * 100) : 100;
  const missing     = fields.filter((f) => !f.done && f.weight > 0).map((f) => f.label);
  const barColor    = pct === 100 ? "var(--dd-success)" : pct >= 60 ? "var(--dd-warning)" : "var(--dd-danger)";

  return (
    <UserShell>
      <main style={{ position: "relative", zIndex: 1, maxWidth: "640px", margin: "0 auto", padding: "36px 20px 100px" }}>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
          <button
            onClick={() => router.push("/profile")}
            aria-label="Back to profile"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "34px", height: "34px", borderRadius: "10px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text2)", cursor: "pointer", flexShrink: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 12L6 8l4-4"/></svg>
          </button>
          <h1 style={{ fontSize: "clamp(1.3rem,4vw,1.6rem)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--dd-text1)" }}>
            Settings
          </h1>
        </div>

        {saveLabel === "saved" && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", borderRadius: "12px", marginBottom: "20px", background: "rgba(21,128,61,0.08)", border: "1px solid rgba(21,128,61,0.25)", color: "var(--dd-success)", fontSize: "0.875rem", fontWeight: 500 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M3 8l4 4 6-7"/></svg>
            Profile saved successfully
          </div>
        )}

        {pct < 100 && (
          <div style={{ marginBottom: "20px", padding: "16px 18px", borderRadius: "16px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--dd-text2)" }}>Profile Completion</span>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: barColor }}>{pct}%</span>
            </div>
            <div style={{ height: "6px", borderRadius: "100px", background: "var(--dd-border2)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, borderRadius: "100px", background: barColor, transition: "width 0.4s ease" }} />
            </div>
            {missing.length > 0 && (
              <p style={{ marginTop: "8px", fontSize: "0.75rem", color: "var(--dd-text3)" }}>Missing: {missing.join(" · ")}</p>
            )}
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

          <Section title="Personal Information">
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <Label>Full Name</Label>
                <Input id="settings-full-name" value={fullName} onChange={setFullName} placeholder="Your full name" />
              </div>
              <div>
                <Label>Username <span style={{ fontWeight: 400, color: "var(--dd-text3)", textTransform: "none", letterSpacing: 0, fontSize: "0.7rem" }}>(shown on Q&amp;A and Discussions; reviews stay anonymous)</span></Label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--dd-text3)", fontSize: "0.9375rem", pointerEvents: "none" }}>@</span>
                  <input id="settings-username" name="username" type="text" value={username}
                    onChange={(e) => { const v = e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 30); setUsername(v); checkUsername(v); }}
                    placeholder="your_username"
                    style={{ width: "100%", padding: "11px 36px 11px 28px", borderRadius: "12px", background: "var(--dd-input-bg)", color: "var(--dd-text1)", fontSize: "0.9375rem", outline: "none", boxSizing: "border-box", border: `1px solid ${usernameStatus === "available" ? "rgba(21,128,61,0.5)" : usernameStatus === "taken" || usernameStatus === "invalid" ? "rgba(185,28,28,0.5)" : "var(--dd-border2)"}`, transition: "border-color 0.15s" }}
                  />
                  <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)" }}>
                    {usernameStatus === "checking"  && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: "var(--dd-text3)" }}><path d="M12 2a10 10 0 0 1 0 20"/><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></svg>}
                    {usernameStatus === "available" && <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--dd-success)" strokeWidth="2.2" strokeLinecap="round"><path d="M3 8l4 4 6-7"/></svg>}
                    {(usernameStatus === "taken" || usernameStatus === "invalid") && <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--dd-danger)" strokeWidth="2.2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>}
                  </span>
                </div>
                {usernameMsg && <p style={{ marginTop: "5px", fontSize: "0.75rem", color: usernameStatus === "available" ? "var(--dd-success)" : "var(--dd-danger)" }}>{usernameMsg}</p>}
              </div>
              <div>
                <Label>Email Address</Label>
                <Input id="settings-email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "7px" }}>
                  {emailVerified ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.75rem", fontWeight: 600, color: "var(--dd-success)" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Verified
                    </span>
                  ) : (
                    <>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--dd-warning)" }}>Not verified</span>
                      <button type="button" onClick={() => setVerifyOpen(true)} style={{ background: "none", border: "none", padding: 0, color: "var(--dd-teal)", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}>
                        Verify now
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Section>

          <Section title="Current Status">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {STATUS_OPTIONS.map((opt) => {
                const active = status === opt.value;
                return (
                  <button key={opt.value} type="button" onClick={() => handleStatusChange(opt.value)}
                    style={{
                      padding: "7px 16px", borderRadius: "100px",
                      background: active ? "rgba(21,128,61,0.14)" : "var(--dd-surface)",
                      border: `1px solid ${active ? "rgba(21,128,61,0.4)" : "var(--dd-border2)"}`,
                      color: active ? "var(--dd-success)" : "var(--dd-text3)",
                      fontSize: "0.85rem", fontWeight: active ? 600 : 500,
                      cursor: "pointer", transition: "all 0.15s",
                      boxShadow: active ? "0 0 14px rgba(21,128,61,0.12)" : "none",
                    }}
                    onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text2)"; } }}
                    onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "var(--dd-surface)"; e.currentTarget.style.color = "var(--dd-text3)"; } }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {needsEdu && (
              <div style={{ marginTop: "18px", paddingTop: "16px", borderTop: "1px solid var(--dd-border)" }}>
                <Label>Highest Education Completed</Label>
                <div style={{ display: "flex", gap: "10px" }}>
                  {(["ug", "pg"] as const).map((edu) => {
                    const sel = highestEdu === edu;
                    return (
                      <button key={edu} type="button" onClick={() => handleEduChange(edu)}
                        style={{ flex: 1, padding: "10px", borderRadius: "12px", background: sel ? "rgba(21,128,61,0.1)" : "var(--dd-surface)", border: `1px solid ${sel ? "rgba(21,128,61,0.36)" : "var(--dd-border)"}`, color: sel ? "var(--dd-success)" : "var(--dd-text3)", fontSize: "0.875rem", fontWeight: sel ? 600 : 500, cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                        {sel && <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 8l4 4 6-7"/></svg>}
                        {edu === "ug" ? "UG Degree" : "PG Degree"}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(showUg || showPg) && (
              <div style={{ marginTop: "18px", paddingTop: "16px", borderTop: "1px solid var(--dd-border)", display: "flex", flexDirection: "column", gap: "14px" }}>
                {showUg && (
                  ugCollegeLocked ? (
                    <LockedCollegeField
                      label={UG_LABEL[status] || "UG College"}
                      collegeName={colleges.find((c) => c.id === ugCollege)?.name ?? null}
                      pending={pendingChangeFields.has("ug_college")}
                      onRequestChange={() => setChangeRequestField("ug_college")}
                    />
                  ) : (
                    <CollegeSelect colleges={ugColleges} value={ugCollege} onChange={setUgCollege} label={UG_LABEL[status] || "UG College"} placeholder="Select UG college…" />
                  )
                )}
                {showPg && (
                  pgCollegeLocked ? (
                    <LockedCollegeField
                      label={status === "pg_aspirant" ? "Target College (PG)" : status === "pg_student" ? "Current PG College" : "PG College Attended"}
                      collegeName={colleges.find((c) => c.id === pgCollege)?.name ?? null}
                      pending={pendingChangeFields.has("pg_college")}
                      onRequestChange={() => setChangeRequestField("pg_college")}
                    />
                  ) : (
                    <CollegeSelect colleges={pgColleges} value={pgCollege} onChange={setPgCollege} label={status === "pg_aspirant" ? "Target College (PG)" : status === "pg_student" ? "Current PG College" : "PG College Attended"} placeholder="Select PG college…" />
                  )
                )}
                {showPg && (
                  <div>
                    <Label>PG Specialty</Label>
                    <div style={{ position: "relative" }}>
                      <select
                        id="settings-pg-department" name="pg_department"
                        value={pgDepartment} onChange={(e) => setPgDepartment(e.target.value)}
                        style={{ width: "100%", padding: "11px 36px 11px 14px", borderRadius: "12px", background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)", color: pgDepartment ? "var(--dd-text1)" : "var(--dd-text4)", fontSize: "0.9375rem", outline: "none", appearance: "none", WebkitAppearance: "none", cursor: "pointer", boxSizing: "border-box" }}
                      >
                        <option value="">Select your specialty…</option>
                        {DEPARTMENT_GROUPS.map((g) => (
                          <optgroup key={g.group} label={g.group}>
                            {g.items.map((d) => <option key={d} value={d}>{d}</option>)}
                          </optgroup>
                        ))}
                      </select>
                      <svg style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--dd-text3)" }} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6l4 4 4-4"/></svg>
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "var(--dd-text4)", marginTop: "6px" }}>Places you into your Specialty Communities.</p>
                  </div>
                )}
              </div>
            )}

            {needsBatch && (
              <div style={{ marginTop: "18px", paddingTop: "16px", borderTop: "1px solid var(--dd-border)" }}>
                <Label>Batch Year</Label>
                <Input id="settings-batch" value={batch} onChange={setBatch} placeholder="e.g. 2016" />
              </div>
            )}
          </Section>

          <Section title="Contact Information">
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <Label>Phone Number <span style={{ fontWeight: 400, color: "var(--dd-text3)" }}>(optional)</span></Label>
                <Input id="settings-phone" value={phone} onChange={setPhone} placeholder="+91 98765 43210" type="tel" />
              </div>
              <div>
                <Label>Address / Location <span style={{ fontWeight: 400, color: "var(--dd-text3)" }}>(optional)</span></Label>
                <Textarea id="settings-address" value={address} onChange={setAddress} placeholder="City, State, Country" rows={2} />
              </div>
            </div>
          </Section>

          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 16px", borderRadius: "12px", background: "rgba(185,28,28,0.08)", border: "1px solid rgba(185,28,28,0.22)", color: "var(--dd-danger)", fontSize: "0.875rem" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px" }}>
            <button type="button" onClick={() => router.push("/profile")} style={{ flex: "0 0 auto", padding: "12px 20px", borderRadius: "14px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text2)", fontSize: "0.9375rem", fontWeight: 500, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-border)"; e.currentTarget.style.color = "var(--dd-text1)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text2)"; }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ flex: 1, padding: "12px", borderRadius: "14px", background: "linear-gradient(135deg,var(--dd-success) 0%,#25a244 100%)", border: "none", color: "#fff", fontSize: "0.9375rem", fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.75 : 1, transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: "0 4px 24px rgba(21,128,61,0.24)" }}>
              {saving && <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 2a6 6 0 100 12A6 6 0 008 2z" opacity="0.25"/><path d="M8 2a6 6 0 010 12" style={{ animation: "spin 0.8s linear infinite" }}/></svg>}
              <span>{saving ? "Saving…" : hasProfile ? "Save Changes" : "Create Profile"}</span>
            </button>
          </div>
        </form>
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.7} }`}</style>

      {verifyOpen && (
        <EmailVerifyModal
          email={email}
          onClose={() => setVerifyOpen(false)}
          onVerified={() => { verifiedLocallyRef.current = true; setEmailVerified(true); setVerifyOpen(false); }}
        />
      )}

      {changeRequestField && (
        <CollegeChangeRequestModal
          field={changeRequestField}
          fieldLabel={changeRequestField === "ug_college" ? "UG college" : "PG college"}
          colleges={changeRequestField === "ug_college" ? ugColleges : pgColleges}
          onClose={() => setChangeRequestField(null)}
          onSubmitted={() => {
            setPendingChangeFields((prev) => new Set(prev).add(changeRequestField));
            setChangeRequestField(null);
          }}
        />
      )}
    </UserShell>
  );
}
