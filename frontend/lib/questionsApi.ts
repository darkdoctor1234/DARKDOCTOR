import { getAccessToken } from "./auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export type QuestionKind = "question" | "discussion";

export interface Question {
  id:            number;
  college:       number;
  college_name:  string;
  user:          number;
  display_name:  string;   // username or "Anonymous"
  is_mine:       boolean;
  kind:          QuestionKind;
  title:         string;
  content:       string;
  answer_count:  number;
  created_at:    string;
  updated_at:    string;
}

export interface QuestionPayload {
  kind:    QuestionKind;
  title:   string;
  content: string;
}

export interface Answer {
  id:           number;
  question:     number;
  content:      string;
  display_name: string;
  is_mine:      boolean;
  created_at:   string;
}

export type ReportReason = "spam" | "offensive" | "misleading" | "harassment" | "other";

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam",       label: "Spam or advertisement" },
  { value: "offensive",  label: "Offensive or inappropriate" },
  { value: "misleading", label: "Medically misleading / misinformation" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "other",      label: "Other" },
];

export interface AdminQuestion extends Question {
  status:       "visible" | "flagged" | "removed";
  report_count: number;
  user_name:    string;
  user_email:   string;
}

export interface AdminAnswer extends Answer {
  status:         "visible" | "flagged" | "removed";
  report_count:   number;
  user_name:      string;
  user_email:     string;
  question_title: string;
  college_name:   string;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers: { ...headers, ...options.headers } });

  if (res.status === 204) return undefined as T;
  const data = await res.json();

  if (res.status === 401) {
    const { clearSession } = await import("./auth");
    clearSession();
    if (typeof window !== "undefined") window.location.replace("/");
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const pick = (d: Record<string, unknown>): string => {
      for (const key of ["detail", "non_field_errors", "error"]) {
        const v = d[key];
        if (Array.isArray(v) && v.length) return String(v[0]);
        if (typeof v === "string" && v) return v;
      }
      const first = Object.values(d)[0];
      return Array.isArray(first) ? String(first[0]) : "Something went wrong.";
    };
    throw new Error(pick(data as Record<string, unknown>));
  }
  return data as T;
}

export const questionsApi = {
  /** Current user's own questions + discussions, across all colleges. */
  mine: () => apiFetch<Question[]>("/colleges/questions/mine/"),

  /** All questions/discussions for a college; optionally filter by kind. */
  listForCollege: (collegeId: number, kind?: QuestionKind) =>
    apiFetch<Question[]>(`/colleges/${collegeId}/questions/${kind ? `?kind=${kind}` : ""}`),

  /** A single question, for its own detail/answers page. */
  get: (questionId: number) =>
    apiFetch<Question>(`/colleges/questions/${questionId}/`),

  create: (collegeId: number, payload: QuestionPayload) =>
    apiFetch<Question>(`/colleges/${collegeId}/questions/`, {
      method: "POST",
      body:   JSON.stringify(payload),
    }),

  answers: {
    list: (questionId: number) =>
      apiFetch<Answer[]>(`/colleges/questions/${questionId}/answers/`),

    create: (questionId: number, content: string) =>
      apiFetch<Answer>(`/colleges/questions/${questionId}/answers/`, {
        method: "POST",
        body:   JSON.stringify({ content }),
      }),

    report: (answerId: number, reason: ReportReason, detail?: string) =>
      apiFetch<{ detail: string }>(`/colleges/answers/${answerId}/report/`, {
        method: "POST",
        body:   JSON.stringify({ reason, detail }),
      }),
  },

  report: (questionId: number, reason: ReportReason, detail?: string) =>
    apiFetch<{ detail: string }>(`/colleges/questions/${questionId}/report/`, {
      method: "POST",
      body:   JSON.stringify({ reason, detail }),
    }),

  admin: {
    questionsFlagged: () => apiFetch<AdminQuestion[]>("/colleges/questions/flagged/"),
    answersFlagged:   () => apiFetch<AdminAnswer[]>("/colleges/answers/flagged/"),

    questionAction: (questionId: number, action: "approve" | "remove") =>
      apiFetch<{ detail: string }>(`/colleges/questions/${questionId}/admin/`, {
        method: "PATCH",
        body:   JSON.stringify({ action }),
      }),

    answerAction: (answerId: number, action: "approve" | "remove") =>
      apiFetch<{ detail: string }>(`/colleges/answers/${answerId}/admin/`, {
        method: "PATCH",
        body:   JSON.stringify({ action }),
      }),
  },
};
