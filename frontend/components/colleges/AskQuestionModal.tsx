"use client";

import { useState, useRef, useEffect } from "react";
import { questionsApi, type Question, type QuestionKind } from "@/lib/questionsApi";
import { collegeApi, type College } from "@/lib/collegeApi";

interface Props {
  /** Pre-selected college id (e.g. the user's UG/PG college), if any. Ignored when lockedCollege is set. */
  defaultCollegeId?: number | null;
  /** When set, the college is fixed (e.g. opened from that college's own page) — no picker is shown. */
  lockedCollege?: { id: number; name: string };
  /** Which tab (Question vs Discussion) to open on — set by which button the user clicked to get here. */
  initialKind?: QuestionKind;
  onClose: () => void;
  onSubmitted: (question: Question) => void;
}

function CollegeSelect({ colleges, value, onChange }: {
  colleges: College[]; value: number | null; onChange: (id: number | null) => void;
}) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = colleges.find((c) => c.id === value) ?? null;
  const filtered = query.trim()
    ? colleges.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || (c.state ?? "").toLowerCase().includes(query.toLowerCase()))
    : colleges;

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) { setOpen(false); setQuery(""); }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setTimeout(() => inputRef.current?.focus(), 0); }}
        style={{
          ...inputStyle, display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", textAlign: "left", width: "100%",
        }}
      >
        <span style={{ color: selected ? "var(--dd-text1)" : "var(--dd-text4)", fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected ? `${selected.name}${selected.state ? `, ${selected.state}` : ""}` : "Select a college…"}
        </span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--dd-text3)" strokeWidth="2" strokeLinecap="round"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 500,
          background: "var(--dd-bg2)", border: "1px solid var(--dd-border2)",
          borderRadius: "12px", boxShadow: "var(--dd-shadow-lg)",
          maxHeight: "260px", display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{ padding: "10px 10px 6px", borderBottom: "1px solid var(--dd-border)" }}>
            <input
              id="ask-question-college-search" name="college-search"
              ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search college name or state…"
              style={{ width: "100%", padding: "7px 10px", borderRadius: "8px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text1)", fontSize: "0.8125rem", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtered.length === 0 ? (
              <p style={{ padding: "14px", color: "var(--dd-text4)", fontSize: "0.8125rem", textAlign: "center" }}>No colleges found</p>
            ) : filtered.map((c) => {
              const isSelected = c.id === value;
              return (
                <button
                  key={c.id} type="button"
                  onClick={() => { onChange(c.id); setOpen(false); setQuery(""); }}
                  style={{
                    width: "100%", padding: "9px 14px", textAlign: "left",
                    background: isSelected ? "var(--dd-teal-bg2)" : "none",
                    border: "none", color: isSelected ? "var(--dd-teal-hover)" : "var(--dd-text2)",
                    fontSize: "0.875rem", cursor: "pointer",
                  }}
                >
                  {c.name}{c.state ? `, ${c.state}` : ""}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AskQuestionModal({ defaultCollegeId, lockedCollege, initialKind, onClose, onSubmitted }: Props) {
  const [colleges,   setColleges]   = useState<College[]>([]);
  const [collegeId,  setCollegeId]  = useState<number | null>(lockedCollege ? lockedCollege.id : (defaultCollegeId ?? null));
  const [kind,       setKind]       = useState<QuestionKind>(initialKind ?? "question");
  const [title,      setTitle]      = useState("");
  const [content,    setContent]    = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  useEffect(() => {
    if (lockedCollege) return;
    collegeApi.list().then(setColleges).catch(() => {});
  }, [lockedCollege]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!collegeId)       return setError("Please select a college.");
    if (!title.trim())    return setError("Please enter a title.");
    if (!content.trim())  return setError(kind === "question" ? "Please write your question." : "Please write your discussion topic.");

    setSubmitting(true);
    try {
      const question = await questionsApi.create(collegeId, { kind, title: title.trim(), content: content.trim() });
      onSubmitted(question);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--dd-bg2)", borderRadius: "22px", border: "1px solid var(--dd-border)", width: "100%", maxWidth: "520px", maxHeight: "90vh", overflowY: "auto", padding: "28px", boxShadow: "var(--dd-shadow-lg)" }}>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "22px" }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.2rem", fontWeight: 600, color: "var(--dd-text1)", letterSpacing: "-0.01em", marginBottom: "4px" }}>
              {kind === "question" ? "Ask a Question" : "Start a Discussion"}
            </h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--dd-text3)" }}>Visible to everyone browsing this college.</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dd-text3)", padding: "4px" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-text1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)"; }}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

          <div>
            <label style={labelStyle}>Type</label>
            <div style={{ display: "flex", gap: "8px" }}>
              {([
                { value: "question" as QuestionKind,   label: "Question" },
                { value: "discussion" as QuestionKind, label: "Discussion" },
              ]).map((opt) => (
                <button key={opt.value} type="button" onClick={() => setKind(opt.value)}
                  style={{
                    padding: "8px 16px", borderRadius: "10px", cursor: "pointer",
                    fontSize: "0.875rem", fontWeight: 500, transition: "all 0.15s",
                    background: kind === opt.value ? "var(--dd-teal-bg2)" : "var(--dd-surface)",
                    border: `1px solid ${kind === opt.value ? "var(--dd-teal-border)" : "var(--dd-border2)"}`,
                    color: kind === opt.value ? "var(--dd-teal-hover)" : "var(--dd-text2)",
                  }}
                >{opt.label}</button>
              ))}
            </div>
          </div>

          {lockedCollege ? (
            <div>
              <label style={labelStyle}>College</label>
              <div style={{ ...inputStyle, color: "var(--dd-text1)", display: "flex", alignItems: "center" }}>{lockedCollege.name}</div>
            </div>
          ) : (
            <div>
              <label style={labelStyle}>College</label>
              <CollegeSelect colleges={colleges} value={collegeId} onChange={setCollegeId} />
            </div>
          )}

          <div>
            <label style={labelStyle}>Title</label>
            <input id="qna-title" name="title" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === "question" ? "e.g. How is the hostel food?" : "e.g. Anyone else starting this year?"}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>{kind === "question" ? "Your Question" : "Details"}</label>
            <textarea
              id="qna-content" name="content"
              value={content} onChange={(e) => setContent(e.target.value)}
              placeholder={kind === "question" ? "What do you want to know?" : "Share more context…"}
              rows={5}
              style={{ ...inputStyle, resize: "vertical", minHeight: "110px" }}
            />
          </div>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "10px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", color: "var(--dd-danger)", fontSize: "0.8125rem" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting}
            style={{
              padding: "13px", borderRadius: "12px",
              background: submitting ? "var(--dd-border2)" : "linear-gradient(135deg,var(--dd-teal),var(--dd-teal-hover))",
              border: "none", color: submitting ? "var(--dd-text4)" : "#fff", fontSize: "0.9375rem", fontWeight: 600,
              cursor: submitting ? "not-allowed" : "pointer",
              boxShadow: "0 4px 20px var(--dd-teal-border)",
            }}
          >
            {submitting ? "Posting…" : kind === "question" ? "Post Question" : "Post Discussion"}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.75rem", fontWeight: 600,
  color: "var(--dd-text3)", letterSpacing: "0.06em", textTransform: "uppercase",
  marginBottom: "8px",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 13px", borderRadius: "10px",
  background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)",
  color: "var(--dd-text1)", fontSize: "0.9rem", outline: "none",
  boxSizing: "border-box", transition: "border-color 0.15s",
};
