"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { saveSession, isAuthenticated, FEED_PREFS_KEY } from "@/lib/auth";
import { collegeApi, type College } from "@/lib/collegeApi";
import { STATUS_OPTIONS, type StatusValue } from "@/lib/profileApi";
import { DEPARTMENT_GROUPS } from "@/lib/departments";

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
  ug_aspirant:          "Target College (UG)",
  ug_student:           "Current College",
  pg_student:           "UG College",
  working_professional: "UG College Attended",
  alumni:               "UG College Attended",
  pg_aspirant:          "UG College Attended",
  faculty:              "UG College Attended",
  other:                "",
  "":                   "",
};

const inputBase: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: "12px",
  background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)",
  color: "var(--dd-text1)", fontSize: "0.9375rem", outline: "none", boxSizing: "border-box",
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "8px" }}>
      {children}
    </div>
  );
}

function StepIndicator({ step }: { step: number }) {
  const steps = ["Account", "Status", "Contact"];
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0", marginBottom: "28px" }}>
      {steps.map((label, i) => {
        const idx   = i + 1;
        const done  = idx < step;
        const active = idx === step;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px" }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.75rem", fontWeight: 700,
                background: done ? "var(--dd-success)" : active ? "linear-gradient(135deg,#0d9488,#7c3aed)" : "var(--dd-surface2)",
                border: done || active ? "none" : "1px solid var(--dd-border2)",
                color: done || active ? "#fff" : "var(--dd-text3)",
                transition: "all 0.2s",
              }}>
                {done
                  ? <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round"><path d="M3 8l4 4 6-7"/></svg>
                  : idx
                }
              </div>
              <span style={{ fontSize: "0.65rem", color: active ? "var(--dd-text1)" : done ? "var(--dd-success)" : "var(--dd-text3)", fontWeight: active ? 600 : 400 }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: "48px", height: "1px", background: done ? "var(--dd-success)" : "var(--dd-border2)", margin: "0 6px 18px", transition: "background 0.3s" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [fullName,        setFullName]        = useState("");
  const [username,        setUsername]        = useState("");
  const [usernameStatus,  setUsernameStatus]  = useState<"idle"|"checking"|"available"|"taken"|"invalid">("idle");
  const [usernameMsg,     setUsernameMsg]     = useState("");
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd,         setShowPwd]         = useState(false);
  const [showConfirmPwd,  setShowConfirmPwd]  = useState(false);
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status,     setStatus]     = useState<StatusValue>("");
  const [highestEdu, setHighestEdu] = useState<"ug" | "pg" | "">("");
  const [ugCollege,  setUgCollege]  = useState<number | null>(null);
  const [pgCollege,  setPgCollege]  = useState<number | null>(null);
  const [pgDepartment, setPgDepartment] = useState("");
  const [batch,      setBatch]      = useState("");
  const [colleges,   setColleges]   = useState<College[]>([]);

  const [phone,   setPhone]   = useState("");
  const [address, setAddress] = useState("");

  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const { showUg, showPg, needsEdu } = collegeFields(status, highestEdu);
  const needsBatch = status === "ug_student" || status === "pg_student" || status === "alumni";
  const ugColleges = colleges.filter((c) => c.is_ug);
  const pgColleges = colleges.filter((c) => c.is_pg);

  const pwdStrength   = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthColor = ["transparent", "var(--dd-danger)", "var(--dd-warning)", "var(--dd-success)"][pwdStrength];
  const strengthLabel = ["", "Too short", "Fair", "Strong"][pwdStrength];

  useEffect(() => { if (isAuthenticated()) router.replace("/feed"); }, [router]);

  useEffect(() => {
    if (step === 2 && colleges.length === 0) {
      collegeApi.list().then(setColleges).catch(() => {});
    }
  }, [step, colleges.length]);

  function handleStatusChange(v: StatusValue) {
    setStatus(v); setHighestEdu(""); setUgCollege(null); setPgCollege(null); setBatch("");
  }
  function handleEduChange(v: "ug" | "pg") {
    setHighestEdu(v);
    if (v === "ug") setPgCollege(null);
  }

  const checkUsername = useCallback((value: string) => {
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    const trimmed = value.trim();
    if (!trimmed) { setUsernameStatus("idle"); setUsernameMsg(""); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setUsernameStatus("invalid"); setUsernameMsg("Letters, numbers and underscores only."); return;
    }
    if (trimmed.length < 3) {
      setUsernameStatus("invalid"); setUsernameMsg("At least 3 characters."); return;
    }
    setUsernameStatus("checking"); setUsernameMsg("");
    usernameTimer.current = setTimeout(async () => {
      try {
        const res = await authApi.checkUsername(trimmed);
        if (res.available) { setUsernameStatus("available"); setUsernameMsg("Username is available!"); }
        else               { setUsernameStatus("taken");     setUsernameMsg(res.error || "Username already taken."); }
      } catch { setUsernameStatus("idle"); setUsernameMsg(""); }
    }, 500);
  }, []);

  async function goToStep2() {
    setError("");
    if (!fullName.trim())              { setError("Please enter your full name."); return; }
    if (!username.trim())              { setError("Please choose a username."); return; }
    if (usernameStatus === "taken")    { setError("That username is already taken. Pick another."); return; }
    if (usernameStatus === "invalid")  { setError(usernameMsg || "Invalid username."); return; }
    if (usernameStatus === "checking") { setError("Please wait, checking username…"); return; }
    if (!email.trim())                 { setError("Please enter your email."); return; }
    if (password.length < 6)          { setError("Password must be at least 6 characters."); return; }
    if (confirmPassword !== password) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const { available } = await authApi.checkEmail(email.trim().toLowerCase());
      if (!available) { setError("An account with this email already exists."); return; }
    } catch {
      // network error — let the final submit surface it
    } finally {
      setLoading(false);
    }
    setStep(2);
  }

  function goToStep3() {
    setError("");
    if (status && needsEdu && !highestEdu) {
      setError("Please select your highest education level.");
      return;
    }
    if (needsBatch && !batch.trim()) {
      setError("Please enter your batch year.");
      return;
    }
    setStep(3);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.register({
        full_name: fullName.trim(),
        username:  username.trim(),
        email:     email.trim().toLowerCase(),
        password,
        current_status:    status    || undefined,
        highest_education: (status && needsEdu ? highestEdu : "") || undefined,
        ug_college:        showUg ? ugCollege : null,
        pg_college:        showPg ? pgCollege : null,
        pg_department:     showPg ? pgDepartment : undefined,
        batch:             needsBatch ? batch.trim() : undefined,
        phone:             phone.trim()   || undefined,
        address:           address.trim() || undefined,
      });
      saveSession(res.access, res.refresh, res.user);
      if (res.user.current_status) {
        sessionStorage.setItem(FEED_PREFS_KEY, JSON.stringify({
          status:     res.user.current_status,
          highestEdu: res.user.highest_education || "",
          ugCollege:  res.user.ug_college ?? null,
          pgCollege:  res.user.pg_college ?? null,
        }));
      } else {
        sessionStorage.removeItem(FEED_PREFS_KEY);
      }
      router.replace("/feed");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed.";
      // Email/username uniqueness can only change between the step-1 pre-check and
      // final submit — both fields live on step 1, so send the user back there
      // instead of leaving a confusing error on the Contact step.
      if (/email|username/i.test(message)) {
        setStep(1);
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const focusBlue   = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = "rgba(13,148,136,0.5)"; };
  const blurDefault = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = "var(--dd-border2)"; };

  return (
    <div style={{ minHeight: "100svh", background: "var(--dd-bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>

      <div style={{ position: "fixed", top: "-200px", left: "50%", transform: "translateX(-50%)", width: "600px", height: "600px", background: "radial-gradient(circle,rgba(48,209,88,0.06) 0%,transparent 65%)", filter: "blur(50px)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "400px" }}>

        <button
          onClick={() => router.push("/")}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "var(--dd-surface2)", border: "1px solid var(--dd-border)",
            borderRadius: "10px", padding: "8px 14px",
            color: "var(--dd-text2)", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
            transition: "all 0.15s", marginBottom: "24px",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-border)"; e.currentTarget.style.color = "var(--dd-text1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text2)"; }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8l4-4"/>
          </svg>
          Home
        </button>

        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <button onClick={() => router.push("/")} style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Darkdoctor" draggable={false}
              style={{ height: "38px", width: "auto", objectFit: "contain" }} />
          </button>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--dd-text1)", letterSpacing: "-0.03em", marginTop: "16px", marginBottom: "4px" }}>
            Create your account
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--dd-text3)" }}>Join the Darkdoctor platform</p>
        </div>

        <StepIndicator step={step} />

        <div style={{ background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", borderRadius: "20px", padding: "28px 24px" }}>

          {/* ══ STEP 1 ══ */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <Label>Full Name <span style={{ color: "#0d9488" }}>*</span></Label>
                <input id="signup-full-name" name="name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name" autoComplete="name" autoFocus
                  style={inputBase} onFocus={focusBlue} onBlur={blurDefault} />
              </div>

              <div>
                <Label>Username <span style={{ color: "#0d9488" }}>*</span> <span style={{ fontWeight: 400, color: "var(--dd-text3)", textTransform: "none", letterSpacing: 0 }}>(shown on your Q&amp;A and Discussions; reviews stay anonymous)</span></Label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--dd-text3)", fontSize: "0.9375rem", pointerEvents: "none" }}>@</span>
                  <input
                    id="signup-username" name="username"
                    type="text" value={username}
                    onChange={(e) => { const v = e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 30); setUsername(v); checkUsername(v); }}
                    placeholder="your_username" autoComplete="off"
                    style={{ ...inputBase, paddingLeft: "28px", paddingRight: "36px",
                      borderColor: usernameStatus === "available" ? "rgba(21,128,61,0.5)"
                                 : usernameStatus === "taken" || usernameStatus === "invalid" ? "rgba(185,28,28,0.5)"
                                 : undefined,
                    }}
                    onFocus={focusBlue} onBlur={blurDefault}
                  />
                  <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "14px" }}>
                    {usernameStatus === "checking"  && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: "var(--dd-text3)" }}><path d="M12 2a10 10 0 0 1 0 20"/><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></svg>}
                    {usernameStatus === "available" && <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--dd-success)" strokeWidth="2.2" strokeLinecap="round"><path d="M3 8l4 4 6-7"/></svg>}
                    {(usernameStatus === "taken" || usernameStatus === "invalid") && <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--dd-danger)" strokeWidth="2.2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>}
                  </span>
                </div>
                {usernameMsg && (
                  <p style={{ marginTop: "5px", fontSize: "0.75rem", color: usernameStatus === "available" ? "var(--dd-success)" : "var(--dd-danger)" }}>
                    {usernameMsg}
                  </p>
                )}
              </div>

              <div>
                <Label>Email Address <span style={{ color: "#0d9488" }}>*</span></Label>
                <input id="signup-email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email"
                  style={inputBase} onFocus={focusBlue} onBlur={blurDefault} />
              </div>

              <div>
                <Label>Mobile Number <span style={{ fontWeight: 400, color: "var(--dd-text3)", textTransform: "none", letterSpacing: 0 }}>(optional)</span></Label>
                <input id="signup-phone" name="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210" autoComplete="tel"
                  style={inputBase} onFocus={focusBlue} onBlur={blurDefault} />
              </div>

              <div>
                <Label>Password <span style={{ color: "#0d9488" }}>*</span></Label>
                <div style={{ position: "relative" }}>
                  <input id="signup-password" name="password" type={showPwd ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters" autoComplete="new-password"
                    style={{ ...inputBase, paddingRight: "42px" }} onFocus={focusBlue} onBlur={blurDefault} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--dd-text3)", padding: "2px" }}>
                    {showPwd
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
                {password.length > 0 && (
                  <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ flex: 1, height: "3px", borderRadius: "3px", background: "var(--dd-border2)", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: "3px", background: strengthColor, width: `${(pwdStrength / 3) * 100}%`, transition: "all 0.25s" }} />
                    </div>
                    <span style={{ fontSize: "0.72rem", color: strengthColor, fontWeight: 500, minWidth: "48px" }}>{strengthLabel}</span>
                  </div>
                )}
              </div>

              <div>
                <Label>Confirm Password <span style={{ color: "#0d9488" }}>*</span></Label>
                <div style={{ position: "relative" }}>
                  <input id="signup-confirm-password" name="confirm-password" type={showConfirmPwd ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password" autoComplete="new-password"
                    style={{
                      ...inputBase, paddingRight: "42px",
                      borderColor: confirmPassword.length === 0 ? undefined : confirmPassword === password ? "rgba(21,128,61,0.5)" : "rgba(185,28,28,0.5)",
                    }}
                    onFocus={focusBlue} onBlur={blurDefault} />
                  <button type="button" onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                    style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--dd-text3)", padding: "2px" }}>
                    {showConfirmPwd
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
                {confirmPassword.length > 0 && confirmPassword !== password && (
                  <p style={{ marginTop: "5px", fontSize: "0.75rem", color: "var(--dd-danger)" }}>Passwords do not match.</p>
                )}
              </div>

              {error && <ErrorBox>{error}</ErrorBox>}

              <button type="button" onClick={goToStep2} disabled={loading}
                style={{ padding: "12px", borderRadius: "12px", background: "linear-gradient(135deg,#0d9488 0%,#7c3aed 100%)", border: "none", color: "#fff", fontSize: "0.9375rem", fontWeight: 600, cursor: loading ? "wait" : "pointer", marginTop: "4px", boxShadow: "0 4px 20px rgba(13,148,136,0.24)", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", opacity: loading ? 0.75 : 1 }}>
                {loading ? "Checking…" : "Continue"}
                {!loading && <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>}
              </button>
            </div>
          )}

          {/* ══ STEP 2 ══ */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

              <div>
                <Label>Current Status <span style={{ fontWeight: 400, color: "var(--dd-text3)", textTransform: "none", letterSpacing: 0 }}>(optional)</span></Label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {STATUS_OPTIONS.filter((opt) => opt.value !== "other").map((opt) => {
                    const active = status === opt.value;
                    return (
                      <button key={opt.value} type="button" onClick={() => handleStatusChange(opt.value)}
                        style={{
                          padding: "7px 14px", borderRadius: "100px",
                          background: active ? "rgba(48,209,88,0.14)" : "var(--dd-surface)",
                          border: `1px solid ${active ? "rgba(48,209,88,0.4)" : "var(--dd-border2)"}`,
                          color: active ? "var(--dd-success)" : "var(--dd-text3)",
                          fontSize: "0.82rem", fontWeight: active ? 600 : 500, cursor: "pointer", transition: "all 0.15s",
                        }}>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {needsEdu && (
                <div style={{ paddingTop: "14px", borderTop: "1px solid var(--dd-border)" }}>
                  <Label>Highest Education Completed</Label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    {(["ug", "pg"] as const).map((edu) => {
                      const sel = highestEdu === edu;
                      return (
                        <button key={edu} type="button" onClick={() => handleEduChange(edu)}
                          style={{
                            flex: 1, padding: "10px", borderRadius: "12px",
                            background: sel ? "rgba(48,209,88,0.1)" : "var(--dd-surface)",
                            border: `1px solid ${sel ? "rgba(48,209,88,0.36)" : "var(--dd-border)"}`,
                            color: sel ? "var(--dd-success)" : "var(--dd-text3)",
                            fontSize: "0.875rem", fontWeight: sel ? 600 : 500, cursor: "pointer", transition: "all 0.15s",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                          }}>
                          {sel && <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 8l4 4 6-7"/></svg>}
                          {edu === "ug" ? "UG Degree" : "PG Degree"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {(showUg || showPg) && (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px", paddingTop: "14px", borderTop: "1px solid var(--dd-border)" }}>
                  {showUg && (
                    <div>
                      <Label>{UG_LABEL[status] || "UG College"}</Label>
                      <CollegeSelect colleges={ugColleges} value={ugCollege} onChange={setUgCollege} placeholder="Select UG college…" />
                    </div>
                  )}
                  {showPg && (
                    <div>
                      <Label>{status === "pg_aspirant" ? "Target College (PG)" : status === "pg_student" ? "Current PG College" : "PG College Attended"}</Label>
                      <CollegeSelect colleges={pgColleges} value={pgCollege} onChange={setPgCollege} placeholder="Select PG college…" />
                    </div>
                  )}
                  {showPg && (
                    <div>
                      <Label>PG Specialty <span style={{ fontWeight: 400, color: "var(--dd-text4)" }}>(optional, can add later)</span></Label>
                      <div style={{ position: "relative" }}>
                        <select
                          id="signup-pg-department" name="pg_department"
                          value={pgDepartment} onChange={(e) => setPgDepartment(e.target.value)}
                          style={{ ...inputBase, appearance: "none", WebkitAppearance: "none", cursor: "pointer", color: pgDepartment ? "var(--dd-text1)" : "var(--dd-text4)" }}
                        >
                          <option value="">Select your specialty…</option>
                          {DEPARTMENT_GROUPS.map((g) => (
                            <optgroup key={g.group} label={g.group}>
                              {g.items.map((d) => <option key={d} value={d}>{d}</option>)}
                            </optgroup>
                          ))}
                        </select>
                        <svg style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--dd-text3)" }} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6l4 4 4-4"/></svg>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {needsBatch && (
                <div style={{ paddingTop: "14px", borderTop: "1px solid var(--dd-border)" }}>
                  <Label>Batch Year</Label>
                  <input id="signup-batch" name="batch" type="text" value={batch} onChange={(e) => setBatch(e.target.value)}
                    placeholder="e.g. 2016"
                    style={inputBase} onFocus={focusBlue} onBlur={blurDefault} />
                </div>
              )}

              {error && <ErrorBox>{error}</ErrorBox>}

              <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                <button type="button" onClick={() => { setStep(1); setError(""); }}
                  style={{ flex: "0 0 auto", padding: "12px 18px", borderRadius: "12px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text2)", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M13 8H3M7 12l-4-4 4-4"/></svg>
                  Back
                </button>
                <button type="button" onClick={goToStep3}
                  style={{ flex: 1, padding: "12px", borderRadius: "12px", background: "linear-gradient(135deg,#0d9488 0%,#7c3aed 100%)", border: "none", color: "#fff", fontSize: "0.9375rem", fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 20px rgba(13,148,136,0.24)", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                  Continue
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                </button>
              </div>
            </div>
          )}

          {/* ══ STEP 3 ══ */}
          {step === 3 && (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <Label>Address / Location <span style={{ fontWeight: 400, color: "var(--dd-text3)", textTransform: "none", letterSpacing: 0 }}>(optional)</span></Label>
                <textarea id="signup-address" name="address" value={address} onChange={(e) => setAddress(e.target.value)}
                  placeholder="City, State" rows={2}
                  style={{ ...inputBase, resize: "vertical", fontFamily: "inherit", lineHeight: "1.5" }}
                  onFocus={focusBlue} onBlur={blurDefault} />
              </div>

              {error && <ErrorBox>{error}</ErrorBox>}

              <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                <button type="button" onClick={() => { setStep(2); setError(""); }}
                  style={{ flex: "0 0 auto", padding: "12px 18px", borderRadius: "12px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text2)", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M13 8H3M7 12l-4-4 4-4"/></svg>
                  Back
                </button>
                <button type="submit" disabled={loading}
                  style={{ flex: 1, padding: "12px", borderRadius: "12px", background: "linear-gradient(135deg,var(--dd-success) 0%,#25a244 100%)", border: "none", color: "#fff", fontSize: "0.9375rem", fontWeight: 600, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.75 : 1, boxShadow: "0 4px 20px rgba(48,209,88,0.22)" }}>
                  {loading ? "Creating account…" : "Create Account"}
                </button>
              </div>

              <p style={{ textAlign: "center", fontSize: "0.72rem", color: "var(--dd-text4)", margin: 0 }}>
                By creating an account you agree to our terms of use.
              </p>
            </form>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "0.875rem", color: "var(--dd-text3)" }}>
          Already have an account?{" "}
          <button onClick={() => router.push("/login")}
            style={{ background: "none", border: "none", color: "#0d9488", fontWeight: 500, cursor: "pointer", fontSize: "0.875rem" }}>
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "10px 14px", borderRadius: "10px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", color: "var(--dd-danger)", fontSize: "0.8125rem" }}>
      {children}
    </div>
  );
}

function CollegeSelect({ colleges, value, onChange, placeholder }: {
  colleges: College[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
}) {
  const [open,        setOpen]        = useState(false);
  const [query,       setQuery]       = useState("");
  const [highlighted, setHighlighted] = useState<number>(-1);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLUListElement>(null);

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
          padding: "11px 14px", borderRadius: "12px", cursor: "pointer",
          background: "var(--dd-input-bg)",
          border: `1px solid ${open ? "rgba(48,209,88,0.5)" : "var(--dd-border2)"}`,
          transition: "border-color 0.15s", minHeight: "44px",
        }}
      >
        <span style={{ fontSize: "0.9375rem", color: selectedCollege ? "var(--dd-text1)" : "var(--dd-text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {selectedCollege
            ? `${selectedCollege.name}${selectedCollege.state ? `, ${selectedCollege.state}` : ""}`
            : (placeholder ?? "Select college…")}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, marginLeft: "8px" }}>
          {selectedCollege && (
            <button onClick={clearSelection} title="Clear"
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: "2px", color: "var(--dd-text3)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--dd-text1)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--dd-text3)"; }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8"/>
              </svg>
            </button>
          )}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
            style={{ color: "var(--dd-text3)", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
            <path d="M4 6l4 4 4-4"/>
          </svg>
        </div>
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 100,
          background: "var(--dd-bg2)", border: "1px solid var(--dd-border2)",
          borderRadius: "14px", boxShadow: "var(--dd-shadow-lg)", overflow: "hidden",
        }}>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--dd-border)", display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "var(--dd-text3)" }}>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              id={`signup-college-search-${(placeholder ?? "college").toLowerCase().replace(/[^a-z]+/g, "-")}`}
              name="college-search"
              ref={inputRef} type="text" value={query}
              onChange={(e) => { setQuery(e.target.value); setHighlighted(0); }}
              onKeyDown={handleKeyDown}
              placeholder="Search college name or state…"
              style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--dd-text1)", fontSize: "0.875rem" }}
            />
            {query && (
              <button onClick={() => { setQuery(""); setHighlighted(-1); inputRef.current?.focus(); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dd-text3)", padding: 0, display: "flex", alignItems: "center" }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8"/>
                </svg>
              </button>
            )}
          </div>

          <ul ref={listRef} style={{ listStyle: "none", margin: 0, padding: "6px 0", maxHeight: "220px", overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <li style={{ padding: "12px 16px", color: "var(--dd-text3)", fontSize: "0.875rem", textAlign: "center" }}>No colleges found</li>
            ) : (
              filtered.map((c, idx) => {
                const isActive  = c.id === value;
                const isHovered = idx === highlighted;
                return (
                  <li key={c.id} onClick={() => selectItem(c)} onMouseEnter={() => setHighlighted(idx)}
                    style={{ padding: "10px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", background: isHovered ? "rgba(48,209,88,0.07)" : "transparent", transition: "background 0.1s" }}>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: isActive ? "var(--dd-success)" : "var(--dd-text1)", fontWeight: isActive ? 600 : 400 }}>{c.name}</div>
                      {c.state && <div style={{ fontSize: "0.75rem", color: "var(--dd-text3)", marginTop: "2px" }}>{c.state}</div>}
                    </div>
                    {isActive && (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--dd-success)" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}>
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
