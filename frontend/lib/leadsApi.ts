import { getAccessToken } from "./auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export interface Lead {
  id:                number;
  full_name:         string;
  email:             string;
  current_status:    string;
  status_display:    string;
  highest_education: string;
  education_display: string;
  ug_college_name:   string | null;
  pg_college_name:   string | null;
  ug_college_state:  string | null;
  pg_college_state:  string | null;
  phone:             string;
  address:           string;
  created_at:        string;   // profile completed
  registered_at:     string;   // account registered
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// 401 with a token present means the token expired — clear the session and
// redirect to the root so the user can log back in (same pattern as collegeApi.ts).
async function handleExpiredSession(res: Response): Promise<void> {
  if (res.status !== 401) return;
  const { clearSession } = await import("./auth");
  clearSession();
  if (typeof window !== "undefined") window.location.replace("/");
  throw new Error("Session expired. Please log in again.");
}

export interface LeadFilterParams {
  search?: string;
  status?: string;
  state?: string;
  college?: string;
  education?: string;
}

function buildLeadQuery(params?: LeadFilterParams): URLSearchParams {
  const qs = new URLSearchParams();
  if (params?.search)    qs.set("search", params.search);
  if (params?.status)    qs.set("status", params.status);
  if (params?.state)     qs.set("state", params.state);
  if (params?.college)   qs.set("college", params.college);
  if (params?.education) qs.set("education", params.education);
  return qs;
}

export const leadsApi = {
  list: async (params?: LeadFilterParams): Promise<Lead[]> => {
    const qs = buildLeadQuery(params);
    const url = `${BASE_URL}/accounts/leads/${qs.toString() ? `?${qs}` : ""}`;
    const res = await fetch(url, { headers: authHeaders() });
    await handleExpiredSession(res);
    if (!res.ok) throw new Error("Failed to load leads.");
    return res.json() as Promise<Lead[]>;
  },

  exportCsv: async (params?: LeadFilterParams): Promise<void> => {
    const qs = buildLeadQuery(params);
    const url = `${BASE_URL}/accounts/leads/export/${qs.toString() ? `?${qs}` : ""}`;
    const res = await fetch(url, { headers: authHeaders() });
    await handleExpiredSession(res);
    if (!res.ok) throw new Error("Export failed.");
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = href;
    a.download = `darkdoctor_leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(href);
  },
};

/* Status metadata used by the table */
export const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  ug_aspirant:          { label: "UG Aspirant",          color: "#ff9f0a", bg: "rgba(255,159,10,0.12)",  border: "rgba(255,159,10,0.3)"  },
  ug_student:           { label: "UG Student",           color: "#0d9488", bg: "rgba(13,148,136,0.12)",  border: "rgba(13,148,136,0.3)"  },
  pg_aspirant:          { label: "PG Aspirant",          color: "#ff6b35", bg: "rgba(255,107,53,0.12)",  border: "rgba(255,107,53,0.3)"  },
  pg_student:           { label: "PG Student",           color: "#5e5ce6", bg: "rgba(94,92,230,0.12)",   border: "rgba(94,92,230,0.3)"   },
  working_professional: { label: "Working Professional", color: "#30d158", bg: "rgba(48,209,88,0.12)",   border: "rgba(48,209,88,0.3)"   },
  alumni:               { label: "Alumni",               color: "#5ac8fa", bg: "rgba(90,200,250,0.12)",  border: "rgba(90,200,250,0.3)"  },
  other:                { label: "Other",                color: "#8e8e93", bg: "rgba(142,142,147,0.12)", border: "rgba(142,142,147,0.3)" },
};
