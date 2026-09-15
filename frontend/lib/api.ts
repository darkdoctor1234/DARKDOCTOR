const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

interface LoginPayload {
  email: string;
  password: string;
}

interface AuthResponse {
  access: string;
  refresh: string;
  user: {
    id:                number;
    email:             string;
    email_verified:    boolean;
    full_name:         string;
    username:          string | null;
    role:              string;
    // Profile fields, included so the feed page can cache prefs immediately
    current_status:    string;
    highest_education: string;
    ug_college:        number | null;
    pg_college:        number | null;
  };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const values = Object.values(data as Record<string, unknown>);
    const firstValue = values[0];
    const message: string =
      (data as Record<string, string[]>)?.non_field_errors?.[0] ??
      (data as Record<string, string>)?.detail ??
      (Array.isArray(firstValue) ? String(firstValue[0]) : undefined) ??
      "Something went wrong.";
    throw new Error(String(message));
  }

  return data as T;
}

interface RegisterPayload {
  full_name:         string;
  username:          string;
  email:             string;
  password:          string;
  // profile fields — all optional, collected on steps 2 & 3
  current_status?:    string;
  highest_education?: string;
  ug_college?:        number | null;
  pg_college?:        number | null;
  pg_department?:     string;
  batch?:             string;
  phone?:             string;
  address?:           string;
}

export const authApi = {
  register: (payload: RegisterPayload) =>
    post<AuthResponse>("/auth/register/", payload),

  userLogin: (payload: LoginPayload) =>
    post<AuthResponse>("/auth/user/login/", payload),

  adminLogin: (payload: LoginPayload) =>
    post<AuthResponse>("/auth/admin/login/", payload),

  superAdminLogin: (payload: LoginPayload) =>
    post<AuthResponse>("/auth/superadmin/login/", payload),

  logout: (refresh: string, access: string) =>
    post<void>("/auth/logout/", { refresh }),

  forgotPassword: (email: string) =>
    post<{ detail: string; dev_otp?: string }>("/auth/forgot-password/", { email }),

  resetPassword: (email: string, otp: string, new_password: string) =>
    post<{ detail: string }>("/auth/reset-password/", { email, otp, new_password }),

  checkUsername: async (username: string): Promise<{ available: boolean; error?: string }> => {
    const res = await fetch(`${BASE_URL}/auth/username-check/?username=${encodeURIComponent(username)}`);
    return res.json();
  },

  checkEmail: async (email: string): Promise<{ available: boolean }> => {
    const res = await fetch(`${BASE_URL}/auth/email-check/?email=${encodeURIComponent(email)}`);
    return res.json();
  },

  updateUsername: async (username: string): Promise<{ username: string }> => {
    const { getAccessToken } = await import("./auth");
    const token = getAccessToken();
    const res = await fetch(`${BASE_URL}/auth/username/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data as Record<string, string>).detail ?? "Failed to update username.");
    return data as { username: string };
  },

  sendEmailVerification: async (): Promise<{ detail: string; dev_otp?: string }> => {
    const { getAccessToken } = await import("./auth");
    const token = getAccessToken();
    const res = await fetch(`${BASE_URL}/auth/email/send-verification/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data as Record<string, string>).detail ?? "Failed to send verification code.");
    return data as { detail: string; dev_otp?: string };
  },

  verifyEmail: async (otp: string): Promise<{ detail: string; email_verified: boolean }> => {
    const { getAccessToken } = await import("./auth");
    const token = getAccessToken();
    const res = await fetch(`${BASE_URL}/auth/email/verify/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ otp }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data as Record<string, string>).detail ?? "Invalid or expired code.");
    return data as { detail: string; email_verified: boolean };
  },
};
