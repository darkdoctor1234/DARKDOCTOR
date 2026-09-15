"use client";

import { useState } from "react";
import type { Question } from "@/lib/questionsApi";

type Tab = "questions" | "discussions" | "unanswered";

interface Props {
  questions: Question[];
  loading:   boolean;
  /** Show which college each item belongs to (profile page — items span many colleges). */
  showCollege?: boolean;
  /** Show who asked (college page — items span many askers). */
  showAsker?: boolean;
  onItemClick?: (q: Question) => void;
}

export default function QnaBoxes({ questions, loading, showCollege, showAsker, onItemClick }: Props) {
  const [tab, setTab] = useState<Tab>("questions");

  const questionsOnly   = questions.filter((q) => q.kind === "question");
  const discussionsOnly = questions.filter((q) => q.kind === "discussion");
  const unanswered      = questionsOnly.filter((q) => q.answer_count === 0);
  const list = tab === "questions" ? questionsOnly : tab === "discussions" ? discussionsOnly : unanswered;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginBottom: "18px" }}>
        {([
          { key: "questions" as const,   label: "Questions",            count: questionsOnly.length,   color: "#0d9488" },
          { key: "discussions" as const, label: "Discussions",          count: discussionsOnly.length,  color: "#7c3aed" },
          { key: "unanswered" as const,  label: "Unanswered Questions", count: unanswered.length,       color: "#ff9f0a" },
        ]).map((box) => {
          const active = tab === box.key;
          return (
            <button
              key={box.key} type="button" onClick={() => setTab(box.key)}
              style={{
                textAlign: "left", padding: "16px 18px", borderRadius: "16px", cursor: "pointer",
                background: active ? `${box.color}14` : "var(--dd-surface)",
                border: `1px solid ${active ? `${box.color}55` : "var(--dd-border)"}`,
                transition: "all 0.15s",
              }}
            >
              <div className="num" style={{ fontSize: "1.5rem", fontWeight: 700, color: active ? box.color : "var(--dd-text1)" }}>
                {box.count}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--dd-text3)", marginTop: "2px" }}>{box.label}</div>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1, 2].map((i) => <div key={i} style={{ height: "72px", borderRadius: "14px", background: "var(--dd-surface2)", animation: "pulse 1.4s ease-in-out infinite" }} />)}
        </div>
      ) : list.length === 0 ? (
        <div style={{ padding: "24px", borderRadius: "16px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)", textAlign: "center" }}>
          <p style={{ color: "var(--dd-text3)", fontSize: "0.875rem" }}>
            {tab === "questions"   && "No questions yet."}
            {tab === "discussions" && "No discussions yet."}
            {tab === "unanswered"  && "No unanswered questions, nice!"}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {list.map((q) => {
            const clickable = !!onItemClick;
            const metaParts = [
              showCollege ? q.college_name : null,
              showAsker   ? q.display_name : null,
            ].filter(Boolean);
            return (
              <div
                key={q.id}
                onClick={clickable ? () => onItemClick!(q) : undefined}
                style={{ padding: "14px 16px", borderRadius: "14px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)", cursor: clickable ? "pointer" : "default" }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--dd-text1)" }}>{q.title}</span>
                  <span style={{ flexShrink: 0, fontSize: "0.72rem", color: "var(--dd-text3)" }}>
                    {q.answer_count} {q.answer_count === 1 ? "answer" : "answers"}
                  </span>
                </div>
                {q.content && (
                  <p style={{ fontSize: "0.8125rem", color: "var(--dd-text2)", margin: "0 0 4px", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {q.content}
                  </p>
                )}
                {metaParts.length > 0 && (
                  <div style={{ fontSize: "0.78rem", color: "var(--dd-text3)" }}>{metaParts.join(" · ")}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
