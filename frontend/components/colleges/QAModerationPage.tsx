"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getUser, clearSession, getRefreshToken, getAccessToken, isAuthenticated } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { questionsApi, type AdminQuestion, type AdminAnswer } from "@/lib/questionsApi";
import AdminQACard from "@/components/colleges/AdminQACard";

type Tab = "questions" | "answers";

interface Props {
  /** true → only `super_admin` may view this page; false → `admin` or `super_admin`. */
  strictSuperAdmin: boolean;
  homeHref: string;
  loginHref: string;
}

export default function QAModerationPage({ strictSuperAdmin, homeHref, loginHref }: Props) {
  const router = useRouter();
  const [user, setUser]           = useState<{ email: string; full_name: string; role: string } | null>(null);
  const [tab, setTab]             = useState<Tab>("questions");
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [answers, setAnswers]     = useState<AdminAnswer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [acting, setActing]       = useState<number | null>(null);
  const [toast, setToast]         = useState("");

  useEffect(() => {
    if (!isAuthenticated()) { router.replace(loginHref); return; }
    const u = getUser<{ email: string; full_name: string; role: string }>();
    const allowed = strictSuperAdmin ? u?.role === "super_admin" : (u?.role === "admin" || u?.role === "super_admin");
    if (!allowed) { router.replace(loginHref); return; }
    setUser(u);
  }, [router, strictSuperAdmin, loginHref]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [q, a] = await Promise.all([questionsApi.admin.questionsFlagged(), questionsApi.admin.answersFlagged()]);
      setQuestions(q); setAnswers(a);
    } catch { setQuestions([]); setAnswers([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleQuestionAction(id: number, action: "approve" | "remove") {
    setActing(id);
    try {
      await questionsApi.admin.questionAction(id, action);
      showToast(action === "approve" ? "Question approved." : "Question removed.");
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch { showToast("Action failed."); }
    finally { setActing(null); }
  }

  async function handleAnswerAction(id: number, action: "approve" | "remove") {
    setActing(id);
    try {
      await questionsApi.admin.answerAction(id, action);
      showToast(action === "approve" ? "Answer approved." : "Answer removed.");
      setAnswers((prev) => prev.filter((a) => a.id !== id));
    } catch { showToast("Action failed."); }
    finally { setActing(null); }
  }

  async function handleLogout() {
    try { await authApi.logout(getRefreshToken()!, getAccessToken()!); } catch {}
    finally { clearSession(); router.replace(loginHref); }
  }

  const activeList = tab === "questions" ? questions : answers;

  return (
    <div style={{ minHeight: "100vh", background: "var(--dd-bg)", color: "var(--dd-text1)" }}>

      {toast && (
        <div style={{ position: "fixed", top: "72px", left: "50%", transform: "translateX(-50%)", zIndex: 100, padding: "10px 20px", borderRadius: "12px", background: "var(--dd-bg2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text1)", fontSize: "0.875rem", fontWeight: 500, boxShadow: "var(--dd-shadow-lg)", backdropFilter: "blur(12px)" }}>
          {toast}
        </div>
      )}

      <nav style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--dd-nav-bg)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--dd-border)", padding: "0 16px", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, overflow: "hidden" }}>
          <button onClick={() => router.push(homeHref)}
            style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "var(--dd-text2)", cursor: "pointer", fontSize: "0.875rem", padding: "6px 10px", borderRadius: "8px" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--dd-text2)"; }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 12L6 8l4-4"/></svg>
            Home
          </button>
          <span style={{ color: "var(--dd-border2)" }}>/</span>
          <span style={{ fontSize: "0.875rem", color: "var(--dd-text1)", fontWeight: 600 }}>Q&A Moderation</span>
          <span style={{ fontSize: "0.6875rem", padding: "2px 8px", borderRadius: "20px", background: "var(--dd-teal-bg2)", border: "1px solid var(--dd-teal-border)", color: "var(--dd-teal)", fontWeight: 500 }}>ADMIN</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <span className="dd-admin-nav-email" style={{ fontSize: "0.8125rem", color: "var(--dd-text3)" }}>{user?.email}</span>
          <button onClick={handleLogout} style={{ padding: "7px 14px", borderRadius: "8px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text2)", fontSize: "0.8125rem", cursor: "pointer", flexShrink: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-text1)"; e.currentTarget.style.background = "var(--dd-border2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text2)"; e.currentTarget.style.background = "var(--dd-surface2)"; }}
          >Sign Out</button>
        </div>
      </nav>

      <main style={{ maxWidth: "780px", margin: "0 auto", padding: "40px 20px 80px" }}>
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.5rem,4vw,2rem)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--dd-text1)", marginBottom: "6px" }}>
            Q&A Moderation
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--dd-text3)" }}>
            Questions and answers reported by users, once they cross the report threshold. Approve to keep it visible, or remove it.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
          {(["questions", "answers"] as Tab[]).map((t) => {
            const count = t === "questions" ? questions.length : answers.length;
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "8px 18px", borderRadius: "20px", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
                background: active ? "var(--dd-teal-bg2)" : "var(--dd-surface2)",
                border: `1px solid ${active ? "var(--dd-teal-border)" : "var(--dd-border2)"}`,
                color: active ? "var(--dd-teal)" : "var(--dd-text2)",
              }}>
                {t === "questions" ? "Questions" : "Answers"} <span className="num">({count})</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {[1, 2].map((i) => (
              <div key={i} style={{ height: "160px", borderRadius: "18px", background: "var(--dd-surface2)", animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />
            ))}
            <style>{`@keyframes pulse{0%,100%{opacity:.25}50%{opacity:.55}}`}</style>
          </div>
        ) : activeList.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px 0" }}>
            <div style={{ color: "var(--dd-success)", marginBottom: "14px", display: "flex", justifyContent: "center" }}>
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M8 12.5l2.5 2.5L16 9"/>
              </svg>
            </div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.1rem", fontWeight: 600, color: "var(--dd-text1)", marginBottom: "6px" }}>All caught up</h2>
            <p style={{ color: "var(--dd-text3)", fontSize: "0.875rem" }}>No reported {tab} awaiting review.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {tab === "questions"
              ? questions.map((q) => (
                  <AdminQACard key={q.id} acting={acting === q.id}
                    item={{ id: q.id, title: q.title, content: q.content, college_name: q.college_name, report_count: q.report_count, user_name: q.user_name, user_email: q.user_email, created_at: q.created_at }}
                    onApprove={() => handleQuestionAction(q.id, "approve")}
                    onRemove={() => handleQuestionAction(q.id, "remove")}
                  />
                ))
              : answers.map((a) => (
                  <AdminQACard key={a.id} acting={acting === a.id}
                    item={{ id: a.id, content: a.content, question_title: a.question_title, college_name: a.college_name, report_count: a.report_count, user_name: a.user_name, user_email: a.user_email, created_at: a.created_at }}
                    onApprove={() => handleAnswerAction(a.id, "approve")}
                    onRemove={() => handleAnswerAction(a.id, "remove")}
                  />
                ))
            }
          </div>
        )}
      </main>

      <style>{`
        @media (max-width: 560px) {
          .dd-admin-nav-email { display: none; }
        }
      `}</style>
    </div>
  );
}
