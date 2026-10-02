import { getAccessToken } from "./auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export interface AboutUs {
  mission:       string;
  vision:        string;
  about:         string;
  contact_email: string;
  updated_at:    string;
}

export interface SocialHandle {
  id:            number;
  platform:      string;
  url:           string;
  display_order: number;
}

export interface AboutData {
  about:          AboutUs;
  social_handles: SocialHandle[];
}

async function doFetch(path: string, options: RequestInit, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${BASE}${path}`, { ...options, headers: { ...headers, ...options.headers } });
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
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
    const d = data as Record<string, unknown>;
    const msg = (d.detail ?? d.non_field_errors ?? Object.values(d)[0]) as string;
    throw new Error(Array.isArray(msg) ? msg[0] : String(msg ?? "Request failed."));
  }
  return data as T;
}

export const aboutApi = {
  get: () =>
    apiFetch<AboutData>("/about/"),

  updateAbout: (payload: Partial<AboutUs>) =>
    apiFetch<AboutUs>("/about/", { method: "PATCH", body: JSON.stringify(payload) }),

  addSocial: (payload: Omit<SocialHandle, "id">) =>
    apiFetch<SocialHandle>("/about/social/", { method: "POST", body: JSON.stringify(payload) }),

  updateSocial: (id: number, payload: Partial<Omit<SocialHandle, "id">>) =>
    apiFetch<SocialHandle>(`/about/social/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }),

  deleteSocial: (id: number) =>
    apiFetch<void>(`/about/social/${id}/`, { method: "DELETE" }),
};
