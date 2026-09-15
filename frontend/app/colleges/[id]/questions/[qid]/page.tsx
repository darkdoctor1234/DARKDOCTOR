"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { questionsApi, type Question, type Answer, type ReportReason } from "@/lib/questionsApi";
import UserShell from "@/components/UserShell";
import ReportModal from "@/components/colleges/ReportModal";

function ReportButton({ onClick, loggedIn }: { onClick: () => void; loggedIn: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={!loggedIn}
      title={loggedIn ? "Report" : "Log in to report"}
      style={{
        display: "flex", alignItems: "center", gap: "4px",
        padding: "4px 8px", borderRadius: "8px", cursor: loggedIn ? "pointer" : "default",
        background: "transparent", border: "1px solid transparent",
        color: "var(--dd-text4)", fontSize: "0.72rem", flexShrink: 0,
      }}
      onMouseEnter={(e) => { if (loggedIn) { e.currentTarget.style.color = "var(--dd-danger)"; e.currentTarget.style.borderColor = "rgba(185,28,28,0.2)"; } }}
      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text4)"; e.currentTarget.style.borderColor = "transparent"; }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M3 3h18v13H3zM12 16v5M8 21h8"/>
      </svg>
      Report
    </button>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const KIND_META = {
  question:   { label: "Question",   color: "var(--dd-teal)", bg: "var(--dd-teal-bg2)" },
  discussion: { label: "Discussion", color: "#7c3aed",        bg: "rgba(124,58,237,0.1)" },
} as const;

function AnswerBox({ questionId, onPosted }: { questionId: number; onPosted: (a: Answer) => void }) {
  const [content,    setContent]    = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return setError("Write something before posting.");
    setSubmitting(true);
    setError("");
    try {
      const answer = await questionsApi.answers.create(questionId, content.trim());
      onPosted(answer);
      setContent("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to post your answer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <textarea
        id="answer-content" name="content"
        value={content} onChange={(e) => setContent(e.target.value)}
        placeholder="Write your answer…"
        rows={3}
        style={{
          width: "100%", padding: "12px 14px", borderRadius: "12px",
          background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)",
          color: "var(--dd-text1)", fontSize: "0.875rem", outline: "none",
          resize: "vertical", minHeight: "72px", boxSizing: "border-box", fontFamily: "inherit",
        }}
      />
      {error && <span style={{ fontSize: "0.78rem", color: "var(--dd-danger)" }}>{error}</span>}
      <button type="submit" disabled={submitting}
        style={{
          alignSelf: "flex-end", padding: "9px 20px", borderRadius: "10px",
          background: submitting ? "var(--dd-border2)" : "linear-gradient(135deg,#0d9488 0%,#7c3aed 100%)",
          border: "none", color: submitting ? "var(--dd-text4)" : "#fff", fontSize: "0.8125rem", fontWeight: 600,
          cursor: submitting ? "not-allowed" : "pointer",
        }}
      >
        {submitting ? "Posting…" : "Post Answer"}
      </button>
    </form>
  );
}

export default function QuestionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const collegeId = Number(params.id);
  const questionId = Number(params.qid);

  const [question, setQuestion] = useState<Question | null>(null);
  const [answers,  setAnswers]  = useState<Answer[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [mounted,  setMounted]  = useState(false);
  const [reportingQuestion, setReportingQuestion] = useState(false);
  const [reportingAnswerId, setReportingAnswerId] = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);
  const loggedIn = mounted && isAuthenticated();

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([questionsApi.get(questionId), questionsApi.answers.list(questionId)])
      .then(([q, a]) => { setQuestion(q); setAnswers(a); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "This question could not be found."))
      .finally(() => setLoading(false));
  }, [questionId]);

  useEffect(() => { if (!isNaN(questionId)) load(); }, [questionId, load]);

  const kindMeta = question ? KIND_META[question.kind] : null;

  return (
    <UserShell>
      <div style={{ minHeight: "100vh", background: "var(--dd-bg)" }}>
        <main style={{ maxWidth: "700px", margin: "0 auto", padding: "32px 20px 80px" }}>

          <button onClick={() => router.push(`/colleges/${collegeId}`)} style={{
            display: "inline-flex", alignItems: "center", gap: "5px",
            background: "none", border: "none", cursor: "pointer",
            color: "var(--dd-text3)", fontSize: "0.8125rem", fontWeight: 500, padding: 0, marginBottom: "20px",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-text2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)"; }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 12L6 8l4-4"/></svg>
            {question?.college_name ?? "Back to college"}
          </button>

          {loading ? (
            <div style={{ height: "260px", borderRadius: "18px", background: "var(--dd-surface2)", animation: "dd-pulse 1.4s ease-in-out infinite" }}>
              <style>{`@keyframes dd-pulse{0%,100%{opacity:.35}50%{opacity:.65}}`}</style>
            </div>
          ) : error || !question ? (
            <div style={{ textAlign: "center", padding: "64px 20px", borderRadius: "18px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)" }}>
              <p style={{ color: "var(--dd-text3)", fontSize: "0.9rem" }}>{error || "Question not found."}</p>
            </div>
          ) : (
            <>
              {/* Question */}
              <div style={{ padding: "22px 24px", borderRadius: "18px", background: "var(--dd-bg2)", border: "1px solid var(--dd-border)", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
                  {kindMeta && (
                    <span style={{ fontSize: "0.68rem", fontWeight: 600, padding: "2px 9px", borderRadius: "20px", background: kindMeta.bg, color: kindMeta.color, letterSpacing: "0.02em" }}>
                      {kindMeta.label}
                    </span>
                  )}
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--dd-text1)" }}>{question.display_name}</span>
                  {question.is_mine && (
                    <span style={{ fontSize: "0.68rem", fontWeight: 600, padding: "1px 7px", borderRadius: "20px", background: "var(--dd-teal-bg2)", color: "var(--dd-teal)" }}>You</span>
                  )}
                  <span style={{ fontSize: "0.75rem", color: "var(--dd-text4)", marginLeft: "auto" }}>{timeAgo(question.created_at)}</span>
                  <ReportButton loggedIn={loggedIn} onClick={() => setReportingQuestion(true)} />
                </div>

                <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.4rem", fontWeight: 700, color: "var(--dd-text1)", letterSpacing: "-0.02em", lineHeight: 1.3, marginBottom: "12px" }}>
                  {question.title}
                </h1>
                <p style={{ fontSize: "0.9375rem", color: "var(--dd-text2)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {question.content}
                </p>
              </div>

              {/* Answers */}
              <div style={{ marginBottom: "16px" }}>
                <h2 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--dd-text1)", marginBottom: "14px" }}>
                  {answers.length} Answer{answers.length !== 1 ? "s" : ""}
                </h2>

                {answers.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" }}>
                    {answers.map((a) => (
                      <div key={a.id} style={{ padding: "13px 16px", borderRadius: "12px", background: "var(--dd-bg2)", border: "1px solid var(--dd-border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--dd-text2)" }}>{a.display_name}</span>
                          {a.is_mine && (
                            <span style={{ fontSize: "0.65rem", fontWeight: 600, padding: "1px 6px", borderRadius: "20px", background: "var(--dd-teal-bg2)", color: "var(--dd-teal)" }}>You</span>
                          )}
                          <span style={{ fontSize: "0.72rem", color: "var(--dd-text4)" }}>{timeAgo(a.created_at)}</span>
                          <div style={{ marginLeft: "auto" }}>
                            <ReportButton loggedIn={loggedIn} onClick={() => setReportingAnswerId(a.id)} />
                          </div>
                        </div>
                        <p style={{ fontSize: "0.875rem", color: "var(--dd-text2)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{a.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {answers.length === 0 && (
                  <p style={{ fontSize: "0.875rem", color: "var(--dd-text4)", marginBottom: "18px" }}>
                    No answers yet. Be the first to help.
                  </p>
                )}
              </div>

              {loggedIn ? (
                <AnswerBox
                  questionId={question.id}
                  onPosted={(a) => setAnswers((prev) => [...prev, a])}
                />
              ) : (
                <p style={{ fontSize: "0.8125rem", color: "var(--dd-text3)" }}>
                  <a href="/login" style={{ color: "#0d9488", textDecoration: "none" }}>Sign in</a> to post an answer.
                </p>
              )}
            </>
          )}
        </main>
      </div>

      {reportingQuestion && question && (
        <ReportModal
          title="Report Question"
          thankYouText="Thank you for helping keep Q&A honest."
          onSubmit={(reason: ReportReason, detail: string) => questionsApi.report(question.id, reason, detail).then(() => {})}
          onClose={() => setReportingQuestion(false)}
        />
      )}
      {reportingAnswerId !== null && (
        <ReportModal
          title="Report Answer"
          thankYouText="Thank you for helping keep Q&A honest."
          onSubmit={(reason: ReportReason, detail: string) => questionsApi.answers.report(reportingAnswerId, reason, detail).then(() => {})}
          onClose={() => setReportingAnswerId(null)}
        />
      )}
    </UserShell>
  );
}
