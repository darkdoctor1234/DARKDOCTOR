import { getAccessToken } from "./auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export type CommunityType = "national_overall" | "department_national" | "department_state";

export interface MyCommunity {
  id:            number;
  type:          CommunityType;
  name:          string;
  department:    string;
  state:         string;
  member_count:  number;
  has_unread:    boolean;
  is_active:     boolean;
  joined_at:     string;
}

export interface PollOption {
  id:            number;
  text:          string;
  display_order: number;
  vote_count:    number;
}

export interface CommunityComment {
  id:               number;
  post:             number;
  display_name:     string;  // the commenter's real name — Community is not anonymous
  author_department: string;
  is_mine:          boolean;
  content:          string;
  created_at:       string;
}

/** Super-admin moderation shapes — adds status/report_count/author_email on top of the public fields. */
export interface AdminDiscussionPost extends DiscussionPost {
  author_email: string;
  status:       "visible" | "flagged" | "removed";
  report_count: number;
}

export interface AdminCommunityComment extends CommunityComment {
  author_email: string;
  post_title:   string;
  status:       "visible" | "flagged" | "removed";
  report_count: number;
}

export interface DiscussionPost {
  id:                number;
  community:         number;
  community_name:    string;
  display_name:      string;
  author_department:  string;
  is_mine:           boolean;
  title:             string;
  content:           string;
  poll_options:      PollOption[];
  has_poll:          boolean;
  total_votes:       number;
  my_vote:           number | null;
  comment_count:     number;
  comments?:         CommunityComment[]; // present on detail view only
  created_at:        string;
  updated_at:        string;
}

export interface DiscussionPostPayload {
  community:     number;
  title:         string;
  content:       string;
  poll_options?: string[];
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers: { ...headers, ...options.headers } });

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
      for (const key of ["detail", "error", "content", "poll_options", "non_field_errors"]) {
        const v = d[key];
        if (Array.isArray(v) && v.length) return String(v[0]);
        if (typeof v === "string" && v) return v;
      }
      const first = Object.values(d)[0];
      return Array.isArray(first) ? String(first[0]) : "Something went wrong.";
    };
    throw new Error(pick(data as Record<string, unknown>));
  }
  return data as T;
}

export const communitiesApi = {
  /** The (up to 3) communities the current user belongs to — never a browsable directory. */
  mine: () => apiFetch<MyCommunity[]>("/communities/mine/"),

  join: (communityId: number) => apiFetch<MyCommunity>(`/communities/${communityId}/join/`, { method: "POST" }),
  exit: (communityId: number) => apiFetch<{ detail: string }>(`/communities/${communityId}/exit/`, { method: "POST" }),

  posts: {
    list: (communityId: number) =>
      apiFetch<DiscussionPost[]>(`/communities/posts/?community=${communityId}`),

    get: (id: number) => apiFetch<DiscussionPost>(`/communities/posts/${id}/`),

    create: (payload: DiscussionPostPayload) =>
      apiFetch<DiscussionPost>("/communities/posts/", { method: "POST", body: JSON.stringify(payload) }),

    mine: () => apiFetch<DiscussionPost[]>("/communities/posts/mine/"),

    vote: (postId: number, optionId: number) =>
      apiFetch<DiscussionPost>(`/communities/posts/${postId}/vote/`, {
        method: "POST", body: JSON.stringify({ option: optionId }),
      }),

    report: (postId: number, reason: string, detail: string) =>
      apiFetch<{ detail: string }>(`/communities/posts/${postId}/report/`, {
        method: "POST", body: JSON.stringify({ reason, detail }),
      }),

    // Super-admin moderation
    flagged: () => apiFetch<AdminDiscussionPost[]>("/communities/posts/flagged/"),
    adminAction: (postId: number, action: "approve" | "remove") =>
      apiFetch<{ detail: string }>(`/communities/posts/${postId}/admin/`, {
        method: "PATCH", body: JSON.stringify({ action }),
      }),
  },

  comments: {
    list: (postId: number) => apiFetch<CommunityComment[]>(`/communities/posts/${postId}/comments/`),

    create: (postId: number, content: string) =>
      apiFetch<CommunityComment>(`/communities/posts/${postId}/comments/`, {
        method: "POST", body: JSON.stringify({ content }),
      }),

    report: (commentId: number, reason: string, detail: string) =>
      apiFetch<{ detail: string }>(`/communities/comments/${commentId}/report/`, {
        method: "POST", body: JSON.stringify({ reason, detail }),
      }),

    // Super-admin moderation
    flagged: () => apiFetch<AdminCommunityComment[]>("/communities/comments/flagged/"),
    adminAction: (commentId: number, action: "approve" | "remove") =>
      apiFetch<{ detail: string }>(`/communities/comments/${commentId}/admin/`, {
        method: "PATCH", body: JSON.stringify({ action }),
      }),
  },
};
