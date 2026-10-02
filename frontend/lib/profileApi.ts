import { getAccessToken } from "./auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/* ── Status constants ── */
export const STATUS_OPTIONS = [
  { value: "ug_aspirant",          label: "UG Aspirant" },
  { value: "ug_student",           label: "UG Student" },
  { value: "pg_aspirant",          label: "PG Aspirant" },
  { value: "pg_student",           label: "PG Student" },
  { value: "working_professional", label: "Working Professional" },
  { value: "alumni",               label: "Alumni" },
  { value: "faculty",              label: "Faculty / Professor" },
  { value: "other",                label: "Other" },
] as const;

export type StatusValue = typeof STATUS_OPTIONS[number]["value"] | "";

/** Statuses eligible for Specialty Communities — mirrors
 * UserProfile.COMMUNITY_ELIGIBLE_STATUSES on the backend. Never UG. */
export const COMMUNITY_ELIGIBLE_STATUSES: StatusValue[] = ["pg_student", "working_professional", "alumni", "faculty"];

/** Which year of the course someone is currently in — distinct from Batch
 * (their admission year). Only meaningful for ug_student/pg_student; UG and
 * PG show different subsets since PG has no 4th/Final/Internship year. */
export const UG_YEAR_OPTIONS = [
  { value: "1",          label: "1st Year" },
  { value: "2",          label: "2nd Year" },
  { value: "3",          label: "3rd Year" },
  { value: "4",          label: "4th Year" },
  { value: "final",      label: "Final Year" },
  { value: "internship", label: "Internship" },
] as const;

export const PG_YEAR_OPTIONS = [
  { value: "1", label: "1st Year" },
  { value: "2", label: "2nd Year" },
  { value: "3", label: "3rd Year" },
] as const;

export type YearOfStudyValue = typeof UG_YEAR_OPTIONS[number]["value"] | "";

/* ── Types ── */
export interface UserProfile {
  has_profile:       boolean;
  email:             string;
  email_verified:    boolean;
  full_name:         string;
  username:          string | null;
  current_status:    StatusValue;
  highest_education: "ug" | "pg" | "";
  ug_college:        number | null;
  pg_college:        number | null;
  ug_college_name:   string | null;
  pg_college_name:   string | null;
  ug_college_locked?: boolean;
  pg_college_locked?: boolean;
  pg_department:     string;
  batch:             string;
  pg_batch:          string;
  year_of_study:     YearOfStudyValue;
  phone:             string;
  address:           string;
  created_at?:       string;
  updated_at?:       string;
}

/** A user's public Q&A activity — reviews are never included, they stay
 * fully anonymous everywhere (see PublicProfileView on the backend). */
export interface PublicQuestion {
  id:            number;
  college:       number;
  college_name:  string;
  kind:          "question" | "discussion";
  title:         string;
  content:       string;
  answer_count:  number;
  created_at:    string;
}

export interface PublicAnswer {
  id:             number;
  question:       number;
  question_title: string;
  college:        number;
  college_name:   string;
  content:        string;
  created_at:     string;
}

export interface PublicProfile {
  username:                string;
  current_status:          string;
  current_status_display:  string;
  ug_college_name:         string | null;
  pg_college_name:         string | null;
  questions:                PublicQuestion[];
  answers:                  PublicAnswer[];
}

export interface ProfilePayload {
  full_name?:         string;
  email?:             string;
  current_status?:    string;
  highest_education?: string;
  ug_college?:        number | null;
  pg_college?:        number | null;
  pg_department?:     string;
  batch?:             string;
  pg_batch?:          string;
  year_of_study?:     string;
  phone?:             string;
  address?:           string;
}

/* ── Shared fetch helper ── */
async function doFetch(path: string, options: RequestInit, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> | undefined) },
  });
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await doFetch(path, options, getAccessToken());

  /* 401 — try one silent refresh-and-retry before giving up */
  if (res.status === 401) {
    const { refreshAccessToken, clearSession } = await import("./auth");
    const newToken = await refreshAccessToken();
    if (newToken) res = await doFetch(path, options, newToken);
    if (res.status === 401) {
      clearSession();
      if (typeof window !== "undefined") window.location.replace("/");
      throw new Error("Session expired. Please log in again.");
    }
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json();

  if (!res.ok) {
    const pick = (d: Record<string, unknown>): string => {
      for (const key of ["detail", "non_field_errors", "error"]) {
        const v = d[key];
        if (Array.isArray(v) && v.length) return String(v[0]);
        if (typeof v === "string") return v;
      }
      const first = Object.values(d)[0];
      return Array.isArray(first) ? String(first[0]) : "Something went wrong.";
    };
    throw new Error(pick(data as Record<string, unknown>));
  }
  return data as T;
}

/* ── API ── */
export const profileApi = {
  get: () =>
    apiFetch<UserProfile>("/accounts/profile/me/"),

  create: (payload: ProfilePayload) =>
    apiFetch<UserProfile>("/accounts/profile/me/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (payload: ProfilePayload) =>
    apiFetch<UserProfile>("/accounts/profile/me/", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  /** Public profile by username — no auth required, works for logged-out visitors too. */
  getPublic: (username: string) =>
    apiFetch<PublicProfile>(`/accounts/u/${encodeURIComponent(username)}/`),

  /** Permanently deletes the current user's own account (and, via CASCADE,
   * all their reviews/Q&A/community content). Irreversible. */
  deleteAccount: () =>
    apiFetch<void>("/accounts/profile/me/", { method: "DELETE" }),
};
