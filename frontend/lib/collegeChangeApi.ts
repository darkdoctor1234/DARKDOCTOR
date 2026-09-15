import { getAccessToken } from "./auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export type CollegeField = "ug_college" | "pg_college";

export interface CollegeChangeRequestItem {
  id: number;
  user_email: string;
  user_full_name: string;
  field: CollegeField;
  field_display: string;
  current_college_name: string | null;
  requested_college_name: string;
  proof: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string;
  resolved_by_email: string | null;
  created_at: string;
  resolved_at: string | null;
}

function pickError(data: Record<string, unknown>): string {
  for (const key of ["detail", "non_field_errors", "error"]) {
    const v = data[key];
    if (Array.isArray(v) && v.length) return String(v[0]);
    if (typeof v === "string") return v;
  }
  const first = Object.values(data)[0];
  return Array.isArray(first) ? String(first[0]) : "Something went wrong.";
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const data = await res.json();

  if (res.status === 401) {
    const { clearSession } = await import("./auth");
    clearSession();
    if (typeof window !== "undefined") window.location.replace("/");
    throw new Error("Session expired. Please log in again.");
  }
  if (!res.ok) throw new Error(pickError(data as Record<string, unknown>));
  return data as T;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> | undefined) },
  });
  return handleResponse<T>(res);
}

export const collegeChangeApi = {
  submit: async (field: CollegeField, collegeId: number, proof: File): Promise<CollegeChangeRequestItem> => {
    const token = getAccessToken();
    const form = new FormData();
    form.append("field", field);
    form.append("requested_college", String(collegeId));
    form.append("proof", proof);
    const res = await fetch(`${BASE_URL}/accounts/college-change-requests/`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    return handleResponse<CollegeChangeRequestItem>(res);
  },

  mine: () => apiFetch<CollegeChangeRequestItem[]>("/accounts/college-change-requests/mine/"),

  pending: () => apiFetch<CollegeChangeRequestItem[]>("/accounts/college-change-requests/pending/"),

  act: (id: number, action: "approve" | "reject", reason?: string) =>
    apiFetch<{ detail: string }>(`/accounts/college-change-requests/${id}/admin/`, {
      method: "PATCH",
      body: JSON.stringify({ action, reason }),
    }),
};
