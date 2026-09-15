"use client";

const ACCESS_KEY  = "dd_access";
const REFRESH_KEY = "dd_refresh";
const USER_KEY    = "dd_user";

/** Feed personalisation prefs — written at login/register/profile-save, cleared on logout */
export const FEED_PREFS_KEY = "dd_feed_prefs";

function isBrowser() {
  return typeof window !== "undefined";
}

export function saveSession(access: string, refresh: string, user: object) {
  if (!isBrowser()) return;
  sessionStorage.setItem(ACCESS_KEY, access);
  sessionStorage.setItem(REFRESH_KEY, refresh);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  return sessionStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return sessionStorage.getItem(REFRESH_KEY);
}

export function getUser<T = Record<string, unknown>>(): T | null {
  if (!isBrowser()) return null;
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (!isBrowser()) return;
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(FEED_PREFS_KEY);   // prevent previous user's prefs leaking to guests
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}
