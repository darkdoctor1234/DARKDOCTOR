import { getAccessToken } from "./auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export interface Notification {
  id: number;
  verb: string;
  message: string;
  url: string;
  is_read: boolean;
  created_at: string;
  actor_name: string | null;
}

export interface NotificationList {
  unread_count: number;
  results: Notification[];
}

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
      return "Something went wrong.";
    };
    throw new Error(pick(data as Record<string, unknown>));
  }
  return data as T;
}

export const notificationsApi = {
  list: () => apiFetch<NotificationList>("/notifications/"),

  markRead: (id: number) =>
    apiFetch<{ detail: string }>(`/notifications/${id}/read/`, { method: "POST" }),

  markAllRead: () =>
    apiFetch<{ detail: string }>("/notifications/mark-all-read/", { method: "POST" }),
};
