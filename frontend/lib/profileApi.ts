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
  phone:             string;
  address:           string;
  created_at?:       string;
  updated_at?:       string;
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
  phone?:             string;
  address?:           string;
}

/* ── Shared fetch helper ── */
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> | undefined) },
  });

  if (res.status === 204) return undefined as T;
  const data = await res.json();

  /* 401 = token expired — clear session and redirect to login */
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
};
