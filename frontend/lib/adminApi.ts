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

export interface PlatformUser {
  id: number;
  username: string | null;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  blocked_reason: string;
  current_status_display: string | null;
  ug_college_name: string | null;
  pg_college_name: string | null;
  created_at: string;
}

async function doFetch(path: string, options: RequestInit, token: string | null): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

async function authFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await doFetch(path, options, getAccessToken());

  // 401 — try one silent refresh-and-retry before giving up (same pattern as collegeApi.ts).
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

export const usersApi = {
  list: (q?: string) =>
    authFetch<PlatformUser[]>(`/accounts/users/${q ? `?q=${encodeURIComponent(q)}` : ""}`),

  toggleBlock: (id: number, reason?: string) =>
    authFetch<PlatformUser>(`/accounts/users/${id}/block/`, {
      method: "PATCH",
      body: JSON.stringify({ reason: reason ?? "" }),
    }),
};
