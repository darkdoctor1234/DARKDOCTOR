"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import UserShell from "@/components/UserShell";
import { profileApi, type PublicProfile, type PublicQuestion, type PublicAnswer } from "@/lib/profileApi";

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

function QuestionRow({ q, onClick }: { q: PublicQuestion; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ padding: "14px 16px", borderRadius: "14px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "4px" }}>
        <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--dd-text1)" }}>{q.title}</span>
        <span style={{ flexShrink: 0, fontSize: "0.72rem", color: "var(--dd-text4)" }}>{timeAgo(q.created_at)}</span>
      </div>
      {q.content && (
        <p style={{ fontSize: "0.8125rem", color: "var(--dd-text2)", margin: "0 0 4px", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {q.content}
        </p>
      )}
      <div style={{ fontSize: "0.78rem", color: "var(--dd-text3)" }}>{q.college_name} · {q.answer_count} {q.answer_count === 1 ? "answer" : "answers"}</div>
    </div>
  );
}

function AnswerRow({ a, onClick }: { a: PublicAnswer; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ padding: "14px 16px", borderRadius: "14px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "4px" }}>
        <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--dd-text3)" }}>On: {a.question_title}</span>
        <span style={{ flexShrink: 0, fontSize: "0.72rem", color: "var(--dd-text4)" }}>{timeAgo(a.created_at)}</span>
      </div>
      <p style={{ fontSize: "0.8125rem", color: "var(--dd-text2)", margin: "0 0 4px", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {a.content}
      </p>
      <div style={{ fontSize: "0.78rem", color: "var(--dd-text3)" }}>{a.college_name}</div>
    </div>
  );
}

export default function PublicProfilePage() {
  const router = useRouter();
  const params = useParams();
  const username = String(params.username ?? "");

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [tab,     setTab]     = useState<"questions" | "answers">("questions");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    profileApi.getPublic(username)
      .then(setProfile)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "This user could not be found."))
      .finally(() => setLoading(false));
  }, [username]);

  useEffect(() => { if (username) load(); }, [username, load]);

  const initial = username ? username[0].toUpperCase() : "?";
  const list = tab === "questions" ? profile?.questions ?? [] : profile?.answers ?? [];

  return (
    <UserShell>
      <main style={{ maxWidth: "700px", margin: "0 auto", padding: "32px 20px 80px" }}>
        {loading ? (
          <div style={{ height: "180px", borderRadius: "18px", background: "var(--dd-surface2)", animation: "dd-pulse 1.4s ease-in-out infinite" }}>
            <style>{`@keyframes dd-pulse{0%,100%{opacity:.35}50%{opacity:.65}}`}</style>
          </div>
        ) : error || !profile ? (
          <div style={{ textAlign: "center", padding: "64px 20px", borderRadius: "18px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)" }}>
            <p style={{ color: "var(--dd-text3)", fontSize: "0.9rem" }}>{error || "User not found."}</p>
          </div>
        ) : (
          <>
            {/* Header — username + college only, never real name/email/phone */}
            <div style={{ display: "flex", alignItems: "center", gap: "18px", marginBottom: "28px" }}>
              <div style={{ flexShrink: 0, width: "68px", height: "68px", borderRadius: "50%", background: "linear-gradient(135deg,#0d9488 0%,#0f766e 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", fontWeight: 700, color: "#fff" }}>
                {initial}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: "clamp(1.2rem,4vw,1.45rem)", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--dd-text1)", marginBottom: "4px" }}>
                  @{profile.username}
                </h1>
                {profile.current_status_display && (
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "3px 10px", borderRadius: "20px", background: "var(--dd-teal-bg2)", color: "var(--dd-teal)" }}>
                    {profile.current_status_display}
                  </span>
                )}
              </div>
            </div>

            {(profile.ug_college_name || profile.pg_college_name) && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "14px 16px", borderRadius: "14px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)", marginBottom: "24px" }}>
                {profile.ug_college_name && (
                  <div style={{ fontSize: "0.8125rem", color: "var(--dd-text2)" }}><strong style={{ color: "var(--dd-text1)" }}>UG:</strong> {profile.ug_college_name}</div>
                )}
                {profile.pg_college_name && (
                  <div style={{ fontSize: "0.8125rem", color: "var(--dd-text2)" }}><strong style={{ color: "var(--dd-text1)" }}>PG:</strong> {profile.pg_college_name}</div>
                )}
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              {([
                { value: "questions" as const, label: `Questions (${profile.questions.length})` },
                { value: "answers"   as const, label: `Answers (${profile.answers.length})` },
              ]).map((t) => (
                <button key={t.value} onClick={() => setTab(t.value)}
                  style={{
                    padding: "7px 14px", borderRadius: "10px", cursor: "pointer",
                    fontSize: "0.8125rem", fontWeight: 500,
                    background: tab === t.value ? "var(--dd-teal-bg2)" : "var(--dd-surface)",
                    border: `1px solid ${tab === t.value ? "var(--dd-teal-border)" : "var(--dd-border2)"}`,
                    color: tab === t.value ? "var(--dd-teal-hover)" : "var(--dd-text2)",
                  }}
                >{t.label}</button>
              ))}
            </div>

            {list.length === 0 ? (
              <p style={{ fontSize: "0.875rem", color: "var(--dd-text4)" }}>
                {tab === "questions" ? "No questions asked yet." : "No answers posted yet."}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {tab === "questions"
                  ? (list as PublicQuestion[]).map((q) => (
                      <QuestionRow key={q.id} q={q} onClick={() => router.push(`/colleges/${q.college}/questions/${q.id}`)} />
                    ))
                  : (list as PublicAnswer[]).map((a) => (
                      <AnswerRow key={a.id} a={a} onClick={() => router.push(`/colleges/${a.college}/questions/${a.question}`)} />
                    ))}
              </div>
            )}
          </>
        )}
      </main>
    </UserShell>
  );
}
