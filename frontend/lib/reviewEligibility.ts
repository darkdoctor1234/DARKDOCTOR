import type { UserProfile } from "./profileApi";

export type ReviewerRole = "student" | "alumni" | "faculty";

export interface ReviewAffiliation {
  /** Still studying there, finished there, or (faculty) works there. */
  role: ReviewerRole;
  /** The year that goes with this college: `batch` is the UG year, `pg_batch` the PG year. Faculty reviewing their workplace have none. */
  batchYear: string;
  level: "UG" | "PG" | "Work";
}

type ReviewProfile = Pick<UserProfile, "current_status" | "ug_college" | "pg_college" | "work_college" | "batch" | "pg_batch">;

const PG_REVIEWER_STATUSES = ["pg_student", "working_professional", "alumni", "faculty"];
const UG_REVIEWER_STATUSES = ["ug_student", "pg_aspirant", "pg_student", "working_professional", "alumni", "faculty"];

/**
 * How this user relates to `collegeId` as a reviewer — or null if they can't
 * review it. Anyone studying or who has studied there can, whatever their
 * current status; faculty can also review the college they work at; an
 * aspirant's saved college is only a target, so it doesn't count. Where one
 * college is several of these, the most specific wins: workplace over PG
 * over UG. Mirrors UserProfile.review_roles() on the backend — keep the two
 * in sync.
 */
export function reviewAffiliation(p: ReviewProfile, collegeId: number): ReviewAffiliation | null {
  const s = p.current_status;
  if (p.work_college === collegeId && s === "faculty") {
    return { role: "faculty", batchYear: "", level: "Work" };
  }
  if (p.pg_college === collegeId && PG_REVIEWER_STATUSES.includes(s)) {
    return { role: s === "pg_student" ? "student" : "alumni", batchYear: p.pg_batch || "", level: "PG" };
  }
  if (p.ug_college === collegeId && UG_REVIEWER_STATUSES.includes(s)) {
    return { role: s === "ug_student" ? "student" : "alumni", batchYear: p.batch || "", level: "UG" };
  }
  return null;
}

export interface ReviewableCollege extends ReviewAffiliation {
  id: number;
  name: string;
}

/** Every college this user can review: workplace first, then PG, then UG. */
export function reviewableColleges(
  p: ReviewProfile & Pick<UserProfile, "ug_college_name" | "pg_college_name" | "work_college_name">,
): ReviewableCollege[] {
  const candidates: [number | null, string | null][] = [
    [p.work_college, p.work_college_name],
    [p.pg_college, p.pg_college_name],
    [p.ug_college, p.ug_college_name],
  ];
  const out: ReviewableCollege[] = [];
  for (const [id, name] of candidates) {
    if (!id || out.some((c) => c.id === id)) continue;
    const affiliation = reviewAffiliation(p, id);
    if (affiliation) out.push({ id, name: name || "Your College", ...affiliation });
  }
  return out;
}
