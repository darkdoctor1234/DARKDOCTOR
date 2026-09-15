import { getAccessToken } from "./auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export interface Department {
  id: number;
  name: string;
}

/**
 * One row in the seat breakdown.
 *
 * Two patterns:
 *   program-only  → department === ""   e.g. MBBS = 20
 *   with dept     → department filled   e.g. PG / General Surgery = 10
 */
export interface SeatEntry {
  id:            number;
  program:       string;
  department:    string;   // "" when the program itself is the unit
  seats:         number;
  display_order: number;
}

/** Payload for PUT /colleges/{id}/seats/ — id is server-assigned so omitted */
export type SeatEntryInput = Omit<SeatEntry, "id">;

/**
 * One row in the fee breakdown (annual fee in INR, whole rupees).
 *
 * Two patterns:
 *   program-only  → department === ""   e.g. MBBS = 150000
 *   with dept     → department filled   e.g. PG / Cardiology = 200000
 */
export interface FeeEntry {
  id:            number;
  program:       string;
  department:    string;
  amount:        number;   // INR per year
  display_order: number;
}

/** Payload for PUT /colleges/{id}/fees/ — id is server-assigned so omitted */
export type FeeEntryInput = Omit<FeeEntry, "id">;

/**
 * One row in the stipend breakdown (monthly stipend in INR, whole rupees).
 *
 * Two patterns:
 *   program-only  → department === ""   e.g. PG = 50000
 *   with dept     → department filled   e.g. PG / Cardiology = 75000
 */
export interface StipendEntry {
  id:            number;
  program:       string;
  department:    string;
  amount:        number;   // INR per month
  display_order: number;
}

/** Payload for PUT /colleges/{id}/stipends/ — id is server-assigned so omitted */
export type StipendEntryInput = Omit<StipendEntry, "id">;

export interface College {
  id:               number;
  name:             string;
  intake_seats:     number;
  established_year: number;
  location:         string;
  state:            string;
  college_type:     "govt" | "private";
  is_ug:            boolean;
  is_pg:            boolean;
  has_mbbs:         boolean;
  has_dental:       boolean;
  has_nursing:      boolean;
  university:       string;
  website_url:      string;
  google_maps_url:  string;
  about:            string;
  departments:      Department[];   // full list — only on detail view
  dept_count?:      number;         // count only — on list view
  avg_rating?:      number | null;  // list view only — mean "Overall" rating across visible reviews
  review_count?:    number;         // list view only — how many visible reviews avg_rating is based on
  seat_entries:     SeatEntry[];
  fee_entries:      FeeEntry[];
  stipend_entries:  StipendEntry[];
  created_at:       string;
  updated_at:       string;
}

export interface CollegePayload {
  name:             string;
  intake_seats:     number;
  established_year: number;
  location:         string;
  state?:           string;
  college_type:     "govt" | "private";
  is_ug:            boolean;
  is_pg:            boolean;
  has_mbbs:         boolean;
  has_dental:       boolean;
  has_nursing:      boolean;
  departments:      string[];
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers: { ...headers, ...options.headers } });

  if (res.status === 204) return undefined as T;
  const data = await res.json();

  // ── 401 with a token present means the token expired ──────────────────────
  // Clear the session and redirect to the root so the user can log back in.
  if (res.status === 401) {
    const { clearSession } = await import("./auth");
    clearSession();
    if (typeof window !== "undefined") window.location.replace("/");
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const pick = (d: Record<string, unknown>): string => {
      // Single string fields
      for (const key of ["detail", "error", "name", "non_field_errors", "level", "course_type"]) {
        const v = d[key];
        if (Array.isArray(v) && v.length) return String(v[0]);
        if (typeof v === "string" && v) return v;
      }
      // errors array (used by seat/fee/stipend entry endpoints)
      if (Array.isArray(d["errors"]) && (d["errors"] as unknown[]).length > 0) {
        return String((d["errors"] as unknown[])[0]);
      }
      const first = Object.values(d)[0];
      return Array.isArray(first) ? String(first[0]) : "Something went wrong.";
    };
    throw new Error(pick(data as Record<string, unknown>));
  }
  return data as T;
}

export interface BulkFailure {
  row:      number;
  name:     string;
  location: string;
  errors:   string[];
}

export interface BulkImportResult {
  total:                   number;
  imported:                number;
  failed:                  number;
  failures:                BulkFailure[];
  /** Row-level warnings for malformed seat_entries values that were skipped. */
  seat_entry_warnings:     string[];
  /** Row-level warnings for malformed fee_entries values that were skipped. */
  fee_entry_warnings?:     string[];
  /** Row-level warnings for malformed stipend_entries values that were skipped. */
  stipend_entry_warnings?: string[];
}

export interface ReviewImage {
  id:        number;
  image_url: string;
}

export interface Review {
  id:                     number;
  college:                number;
  college_name:           string;
  user?:                  number;   // admin-only: real user id
  display_name:           string;   // always "Anonymous" — reviews are fully anonymous to other users
  is_mine:                boolean;  // true if the current viewer wrote this review
  user_name?:             string;   // admin-only: real full name
  user_email?:            string;   // admin-only: real email
  role:                   "student" | "alumni" | "faculty";
  department:             string;
  batch_year:             string;
  title:                  string;
  content:                string;
  rating_infrastructure:  number;
  rating_clinical:        number;
  rating_hostel:          number;
  rating_administration:  number;
  rating_overall:         number;
  average_rating:         number;
  status:                 "pending" | "visible" | "rejected" | "flagged" | "removed";
  rejection_reason:       string;   // set only when status is "rejected"
  resolved_by_email?:     string | null;  // admin-only: who last actioned this review
  is_verified:            boolean;
  helpful_count:          number;
  report_count:           number;
  images:                 ReviewImage[];
  created_at:             string;
  updated_at:             string;
}

/** Thrown by reviews.create() when the user already has a row for this college —
 * carries enough detail for the caller to route to "still pending" / "edit & resubmit". */
export class ReviewConflictError extends Error {
  existingReviewId?: number;
  existingStatus?: Review["status"];
  rejectionReason?: string;
  constructor(detail: string, data: Record<string, unknown>) {
    super(detail);
    this.name = "ReviewConflictError";
    this.existingReviewId = data.existing_review_id as number | undefined;
    this.existingStatus   = data.existing_status as Review["status"] | undefined;
    this.rejectionReason  = data.rejection_reason as string | undefined;
  }
}

export interface ReviewPayload {
  role:                   string;
  department?:            string;
  batch_year?:            string;
  title:                  string;
  content:                string;
  rating_infrastructure:  number;
  rating_clinical:        number;
  rating_hostel:          number;
  rating_administration:  number;
  rating_overall:         number;
  images?:                File[];
}

export const collegeApi = {
  list:   ()                              => apiFetch<College[]>("/colleges/"),
  get:    (id: number)                    => apiFetch<College>(`/colleges/${id}/`),
  create: (p: CollegePayload)             => apiFetch<College>("/colleges/", { method: "POST", body: JSON.stringify(p) }),
  update: (id: number, p: Partial<CollegePayload>) =>
    apiFetch<College>(`/colleges/${id}/`, { method: "PATCH", body: JSON.stringify(p) }),
  delete: (id: number)                    => apiFetch<void>(`/colleges/${id}/`, { method: "DELETE" }),

  /** Seat breakdown — atomically replaces all entries for a college. */
  seatEntries: {
    replace: (collegeId: number, entries: SeatEntryInput[]) =>
      apiFetch<SeatEntry[]>(`/colleges/${collegeId}/seats/`, {
        method: "PUT",
        body:   JSON.stringify(entries),
      }),
  },

  /** Fee breakdown — atomically replaces all fee entries for a college. */
  feeEntries: {
    replace: (collegeId: number, entries: FeeEntryInput[]) =>
      apiFetch<FeeEntry[]>(`/colleges/${collegeId}/fees/`, {
        method: "PUT",
        body:   JSON.stringify(entries),
      }),
  },

  /** Stipend breakdown — atomically replaces all stipend entries for a college. */
  stipendEntries: {
    replace: (collegeId: number, entries: StipendEntryInput[]) =>
      apiFetch<StipendEntry[]>(`/colleges/${collegeId}/stipends/`, {
        method: "PUT",
        body:   JSON.stringify(entries),
      }),
  },

  /** Reviews */
  reviews: {
    list: (collegeId: number) =>
      apiFetch<Review[]>(`/colleges/${collegeId}/reviews/`),

    create: async (collegeId: number, payload: ReviewPayload): Promise<Review> => {
      const token = getAccessToken();
      const form  = new FormData();
      form.append("role",                  payload.role);
      form.append("title",                 payload.title);
      form.append("content",               payload.content);
      form.append("rating_infrastructure", String(payload.rating_infrastructure));
      form.append("rating_clinical",       String(payload.rating_clinical));
      form.append("rating_hostel",         String(payload.rating_hostel));
      form.append("rating_administration", String(payload.rating_administration));
      form.append("rating_overall",        String(payload.rating_overall));
      if (payload.department) form.append("department", payload.department);
      if (payload.batch_year) form.append("batch_year", payload.batch_year);
      if (payload.images) payload.images.forEach((img) => form.append("images", img));

      const res = await fetch(`${BASE_URL}/colleges/${collegeId}/reviews/`, {
        method:  "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body:    form,
      });
      const data = await res.json();
      if (!res.ok) {
        const record = data as Record<string, unknown>;
        if (record.existing_review_id) {
          throw new ReviewConflictError(String(record.detail ?? "You already have a review for this college."), record);
        }
        throw new Error(String(record.detail ?? "Failed to submit review."));
      }
      return data as Review;
    },

    /** Edit and resubmit a rejected review — reuses the same row (see backend ReviewCreateSerializer.update). */
    resubmit: async (reviewId: number, payload: ReviewPayload): Promise<Review> => {
      const token = getAccessToken();
      const form  = new FormData();
      form.append("role",                  payload.role);
      form.append("title",                 payload.title);
      form.append("content",               payload.content);
      form.append("rating_infrastructure", String(payload.rating_infrastructure));
      form.append("rating_clinical",       String(payload.rating_clinical));
      form.append("rating_hostel",         String(payload.rating_hostel));
      form.append("rating_administration", String(payload.rating_administration));
      form.append("rating_overall",        String(payload.rating_overall));
      if (payload.department) form.append("department", payload.department);
      if (payload.batch_year) form.append("batch_year", payload.batch_year);
      if (payload.images) payload.images.forEach((img) => form.append("images", img));

      const res = await fetch(`${BASE_URL}/colleges/reviews/${reviewId}/resubmit/`, {
        method:  "PATCH",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body:    form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as Record<string,string>).detail ?? "Failed to resubmit review.");
      return data as Review;
    },

    helpful: (reviewId: number) =>
      apiFetch<{ helpful: boolean; helpful_count: number }>(`/colleges/reviews/${reviewId}/helpful/`, { method: "POST" }),

    report: (reviewId: number, reason: string, detail?: string) =>
      apiFetch<{ detail: string }>(`/colleges/reviews/${reviewId}/report/`, {
        method: "POST", body: JSON.stringify({ reason, detail: detail ?? "" }),
      }),

    /** Admin/super-admin moderation — pending (new) and flagged (reported) queues share one action endpoint. */
    admin: {
      pending: () => apiFetch<Review[]>("/colleges/reviews/pending/"),
      flagged: () => apiFetch<Review[]>("/colleges/reviews/flagged/"),
      history: () => apiFetch<Review[]>("/colleges/reviews/history/"),
      action: (reviewId: number, action: "approve" | "reject" | "remove", reason?: string) =>
        apiFetch<{ detail: string }>(`/colleges/reviews/${reviewId}/admin/`, {
          method: "PATCH", body: JSON.stringify({ action, reason }),
        }),
    },
  },

  myReviews: () => apiFetch<Review[]>("/colleges/reviews/mine/"),
  trending: () => apiFetch<Review[]>("/colleges/reviews/trending/"),
  recent:   () => apiFetch<Review[]>("/colleges/reviews/recent/"),

  /** Download the Excel import template */
  downloadTemplate: async () => {
    const token = getAccessToken();
    const res = await fetch(
      `${BASE_URL}/colleges/bulk-import/template/`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (!res.ok) {
      let detail = `Server returned ${res.status}`;
      try {
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("application/json")) {
          const body = await res.json() as Record<string, unknown>;
          detail = String(body.error ?? body.detail ?? detail);
        }
      } catch { /* swallow */ }
      throw new Error(detail);
    }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "darkdoctor_colleges_template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  },

  /** Upload an Excel file for bulk import */
  bulkImport: async (file: File): Promise<BulkImportResult> => {
    const token = getAccessToken();
    const form  = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE_URL}/colleges/bulk-import/`, {
      method:  "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body:    form,
    });
    const data = await res.json();
    if (!res.ok && res.status !== 422) {
      throw new Error((data as { error?: string }).error ?? "Import failed.");
    }
    return data as BulkImportResult;
  },
};
