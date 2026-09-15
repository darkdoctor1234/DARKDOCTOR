import { getAccessToken } from "./auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

async function authFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json();

  // 401 with a token present means the token expired — clear the session and
  // redirect to the root so the user can log back in (same pattern as collegeApi.ts).
  if (res.status === 401) {
    const { clearSession } = await import("./auth");
    clearSession();
    if (typeof window !== "undefined") window.location.replace("/");
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const message =
      data?.email?.[0] ??
      data?.non_field_errors?.[0] ??
      data?.detail ??
      "Something went wrong.";
    throw new Error(String(message));
  }

  return data as T;
}

export const superAdminApi = {
  listAdmins: () => authFetch<AdminUser[]>("/accounts/admins/"),

  createAdmin: (payload: { full_name: string; email: string; password: string; role?: "admin" | "super_admin" }) =>
    authFetch<AdminUser>("/accounts/admins/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateAdmin: (id: number, payload: { full_name: string; email: string; password?: string }) =>
    authFetch<AdminUser>(`/accounts/admins/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteAdmin: (id: number) =>
    authFetch<{ detail: string }>(`/accounts/admins/${id}/`, { method: "DELETE" }),

  toggleActive: (id: number) =>
    authFetch<AdminUser>(`/accounts/admins/${id}/toggle-active/`, { method: "PATCH" }),
};
