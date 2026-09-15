"use client";

interface QAItemBase {
  id: number;
  content: string;
  report_count: number;
  user_name: string;
  user_email: string;
  created_at: string;
}

interface QuestionItem extends QAItemBase {
  title: string;
  college_name: string;
}

interface AnswerItem extends QAItemBase {
  question_title: string;
  college_name: string;
}

type Props = {
  item: QuestionItem | AnswerItem;
  acting: boolean;
  onApprove: () => void;
  onRemove: () => void;
};

export default function AdminQACard({ item, acting, onApprove, onRemove }: Props) {
  const isQuestion = "title" in item;

  return (
    <div style={{ borderRadius: "18px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)", padding: "20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "10px" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--dd-text1)" }}>{item.user_name || "-"}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--dd-text3)" }}>{item.user_email}</div>
        </div>
        <span style={{ fontSize: "0.6875rem", padding: "3px 9px", borderRadius: "20px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", color: "var(--dd-danger)", fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap" }}>
          {item.report_count} report{item.report_count !== 1 ? "s" : ""}
        </span>
      </div>

      <div style={{ fontSize: "0.75rem", color: "var(--dd-text3)", marginBottom: "8px" }}>
        {isQuestion ? item.college_name : `${item.college_name} · Re: "${item.question_title}"`}
      </div>

      {isQuestion && (
        <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--dd-text1)", marginBottom: "6px" }}>{item.title}</div>
      )}
      <p style={{ fontSize: "0.875rem", color: "var(--dd-text2)", lineHeight: 1.6, marginBottom: "16px", whiteSpace: "pre-wrap" }}>
        {item.content}
      </p>

      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={onApprove} disabled={acting} style={{ flex: 1, padding: "9px", borderRadius: "10px", background: "var(--dd-success)", border: "none", color: "#fff", fontSize: "0.8125rem", fontWeight: 600, cursor: acting ? "wait" : "pointer" }}>
          Approve
        </button>
        <button onClick={onRemove} disabled={acting} style={{ flex: 1, padding: "9px", borderRadius: "10px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", color: "var(--dd-danger)", fontSize: "0.8125rem", fontWeight: 600, cursor: acting ? "wait" : "pointer" }}>
          Remove
        </button>
      </div>
    </div>
  );
}
