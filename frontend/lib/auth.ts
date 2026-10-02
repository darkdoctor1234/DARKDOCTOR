"use client";

const ACCESS_KEY  = "dd_access";
const REFRESH_KEY = "dd_refresh";
const USER_KEY    = "dd_user";

/** Feed personalisation prefs — written at login/register/profile-save, cleared on logout */
export const FEED_PREFS_KEY = "dd_feed_prefs";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

function isBrowser() {
  return typeof window !== "undefined";
}

// localStorage (not sessionStorage) — a session must survive normal browser
// navigation (Back/Forward, a backgrounded mobile tab getting evicted and
// restored), not just stay alive within one tab's live memory.
export function saveSession(access: string, refresh: string, user: object) {
  if (!isBrowser()) return;
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function getUser<T = Record<string, unknown>>(): T | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (!isBrowser()) return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  // Feed prefs are written/read via sessionStorage everywhere else (feed,
  // login, signup, settings pages) — clearing it from localStorage here was
  // a no-op, which is exactly how a previous session's college/status choice
  // was leaking into the next guest visit on the same tab.
  sessionStorage.removeItem(FEED_PREFS_KEY);   // prevent previous user's prefs leaking to guests
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

/**
 * Silent token refresh — called by every API client's 401 handler before
 * giving up and logging the user out. The access token is short-lived (60
 * min); as long as the 7-day refresh token is still valid, this lets a
 * session survive well past that without the user noticing. The backend
 * rotates refresh tokens on every use (ROTATE_REFRESH_TOKENS) and blacklists
 * the old one (BLACKLIST_AFTER_ROTATION) — so if a page fires several
 * authenticated requests at once and the access token has expired, EVERY one
 * of them hits 401 around the same time. Without coalescing, each would
 * independently POST the same (still-valid-until-first-use) refresh token;
 * the first to land rotates it, and every other concurrent attempt then gets
 * rejected using the now-blacklisted token, incorrectly looking like a real
 * refresh failure. `inFlightRefresh` makes every concurrent caller share the
 * exact same request/result instead of racing each other.
 */
let inFlightRefresh: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (!isBrowser()) return null;
  if (inFlightRefresh) return inFlightRefresh;

  inFlightRefresh = (async () => {
    const refresh = getRefreshToken();
    if (!refresh) return null;
    try {
      const res = await fetch(`${BASE_URL}/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.access) return null;
      localStorage.setItem(ACCESS_KEY, data.access);
      if (data.refresh) localStorage.setItem(REFRESH_KEY, data.refresh);
      return data.access as string;
    } catch {
      return null;
    }
  })();

  try {
    return await inFlightRefresh;
  } finally {
    inFlightRefresh = null;
  }
}
