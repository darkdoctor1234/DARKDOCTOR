"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { profileApi } from "@/lib/profileApi";
import { type MyCommunity } from "@/lib/communitiesApi";
import AskQuestionModal from "@/components/colleges/AskQuestionModal";
import WriteReviewModal from "@/components/colleges/WriteReviewModal";

export type QuickAction = "ask" | "discuss" | "review";

/** Shared Ask/Discuss/Review trigger logic — used by both the desktop sidebar
 *  below and any other page that wants the same three actions without
 *  duplicating the "resolve the user's own college" flow. */
export function useQuickActions() {
  const [askState, setAskState]         = useState<{ kind: "question" | "discussion" } | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ id: number; name: string } | null>(null);
  const [checking, setChecking]         = useState(false);
  const [checkError, setCheckError]     = useState("");

  async function handleAction(action: QuickAction) {
    setCheckError("");
    if (action === "ask")     { setAskState({ kind: "question" }); return; }
    if (action === "discuss") { setAskState({ kind: "discussion" }); return; }
    setChecking(true);
    try {
      const p = await profileApi.get();
      const collegeId   = p.pg_college ?? p.ug_college;
      const collegeName = p.pg_college ? p.pg_college_name : p.ug_college_name;
      if (!collegeId) { setCheckError("Add your college on your profile first."); return; }
      setReviewTarget({ id: collegeId, name: collegeName || "Your College" });
    } catch {
      setCheckError("Couldn't check your profile. Try again.");
    } finally {
      setChecking(false);
    }
  }

  return { askState, setAskState, reviewTarget, setReviewTarget, checking, checkError, handleAction };
}

export function QuickActionsModals({
  askState, setAskState, reviewTarget, setReviewTarget,
}: {
  askState: { kind: "question" | "discussion" } | null;
  setAskState: (v: { kind: "question" | "discussion" } | null) => void;
  reviewTarget: { id: number; name: string } | null;
  setReviewTarget: (v: { id: number; name: string } | null) => void;
}) {
  return (
    <>
      {askState && (
        <AskQuestionModal
          initialKind={askState.kind}
          onClose={() => setAskState(null)}
          onSubmitted={() => setAskState(null)}
        />
      )}
      {reviewTarget && (
        <WriteReviewModal
          collegeId={reviewTarget.id}
          collegeName={reviewTarget.name}
          onClose={() => setReviewTarget(null)}
          onSubmitted={() => setReviewTarget(null)}
        />
      )}
    </>
  );
}

const ACTIONS: { id: QuickAction; label: string; color: string; bg: string; border: string; icon: React.ReactNode }[] = [
  {
    id: "ask", label: "Ask a Question",
    color: "var(--dd-teal)", bg: "var(--dd-teal-bg)", border: "var(--dd-teal-border)",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
      </svg>
    ),
  },
  {
    id: "discuss", label: "Start a Discussion",
    color: "#7c3aed", bg: "rgba(124,58,237,0.08)", border: "rgba(124,58,237,0.22)",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
  {
    id: "review", label: "Write a Review",
    color: "var(--dd-warning)", bg: "var(--dd-warning-bg)", border: "var(--dd-warning-border)",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
      </svg>
    ),
  },
];

function communityTypeLabel(type: MyCommunity["type"]): string {
  if (type === "national_overall") return "National";
  if (type === "department_national") return "Nationwide";
  return "Statewide";
}

/** The desktop-only sidebar (hidden below 1100px via the .feed-grid-sidebar
 *  CSS class — see globals or the page's own <style> block) that fills the
 *  gutter left over by a centered ~640-720px content column, instead of
 *  leaving it empty. Any page using this must also render the .feed-grid /
 *  .feed-grid-main / .feed-grid-sidebar CSS (see app/feed/page.tsx). */
export function QuickActionsSidebar({
  myCommunities, communitiesLoading, checking, checkError, onAction,
}: {
  myCommunities: MyCommunity[];
  communitiesLoading: boolean;
  checking: boolean;
  checkError: string;
  onAction: (action: QuickAction) => void;
}) {
  const router = useRouter();
  return (
    <aside className="feed-grid-sidebar">
      <div style={{ background: "var(--dd-surface)", border: "1px solid var(--dd-border)", borderRadius: "18px", padding: "18px" }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "14px" }}>
          Quick Actions
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {ACTIONS.map((a) => (
            <button
              key={a.id}
              onClick={() => onAction(a.id)}
              disabled={checking}
              style={{
                display: "flex", alignItems: "center", gap: "11px", textAlign: "left",
                padding: "10px 12px", borderRadius: "12px",
                background: "var(--dd-surface2)", border: "1px solid var(--dd-border)",
                cursor: checking ? "wait" : "pointer", transition: "all 0.15s", width: "100%",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = a.bg; e.currentTarget.style.borderColor = a.border; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.borderColor = "var(--dd-border)"; }}
            >
              <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: a.bg, border: `1px solid ${a.border}`, color: a.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {a.icon}
              </div>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--dd-text1)" }}>{a.label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => router.push("/colleges?all=1")}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", width: "100%", marginTop: "12px", padding: "9px", borderRadius: "10px", background: "none", border: "1px dashed var(--dd-border2)", color: "var(--dd-text3)", fontSize: "0.8125rem", cursor: "pointer", transition: "color 0.15s, border-color 0.15s" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-text2)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)"; }}
        >
          Browse all colleges
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 4l4 4-4 4"/></svg>
        </button>
        {checkError && (
          <p style={{ marginTop: "10px", fontSize: "0.75rem", color: "var(--dd-danger)", textAlign: "center" }}>{checkError}</p>
        )}
      </div>

      <div style={{ background: "var(--dd-surface)", border: "1px solid var(--dd-border)", borderRadius: "18px", padding: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
            Your Communities
          </span>
          {myCommunities.length > 0 && (
            <button onClick={() => router.push("/communities")} style={{ background: "none", border: "none", cursor: "pointer", color: "#7c3aed", fontSize: "0.75rem", fontWeight: 600, padding: 0 }}>
              View all
            </button>
          )}
        </div>

        {communitiesLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[1, 2].map((i) => <div key={i} style={{ height: "44px", borderRadius: "10px", background: "var(--dd-surface2)" }} />)}
          </div>
        ) : myCommunities.filter((c) => c.is_active).length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {myCommunities.filter((c) => c.is_active).slice(0, 3).map((c) => (
              <button
                key={c.id}
                onClick={() => router.push(`/communities/${c.id}`)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", width: "100%", padding: "9px 11px", borderRadius: "10px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border)", cursor: "pointer", textAlign: "left", transition: "background 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(124,58,237,0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; }}
              >
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--dd-text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                  <span style={{ display: "block", fontSize: "0.7rem", color: "var(--dd-text4)", marginTop: "1px" }}>{communityTypeLabel(c.type)} · {c.member_count} members</span>
                </span>
                {c.has_unread && <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#7c3aed", flexShrink: 0 }} />}
              </button>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: "0.8125rem", color: "var(--dd-text4)", lineHeight: 1.5, margin: 0 }}>
            Set your status to PG Student, Alumni, Working Professional or Faculty on your profile to join your specialty communities.
          </p>
        )}
      </div>
    </aside>
  );
}

/** Shared CSS for the two-column desktop layout (sidebar hidden below
 *  1100px). Render once per page via <style>{FEED_GRID_CSS}</style>. */
export const FEED_GRID_CSS = `
  .feed-grid-sidebar { display: none; }
  @media (min-width: 1100px) {
    .feed-grid { display: grid; grid-template-columns: minmax(0,1fr) 300px; gap: 36px; align-items: start; }
    .feed-grid-sidebar { display: flex; flex-direction: column; gap: 18px; position: sticky; top: 84px; }
  }
`;
