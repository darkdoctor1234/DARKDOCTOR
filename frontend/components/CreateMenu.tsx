"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { profileApi } from "@/lib/profileApi";
import AskQuestionModal from "@/components/colleges/AskQuestionModal";
import WriteReviewModal from "@/components/colleges/WriteReviewModal";

type SheetAction = "ask" | "discuss" | "review";

const ACTIONS: {
  id: SheetAction; label: string; description: string;
  color: string; bg: string; border: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "ask", label: "Ask a Question", description: "Get answers from students and alumni at any college.",
    color: "var(--dd-teal)", bg: "var(--dd-teal-bg)", border: "var(--dd-teal-border)",
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
      </svg>
    ),
  },
  {
    id: "discuss", label: "Start a Discussion", description: "Open up a conversation about any college.",
    color: "#7c3aed", bg: "rgba(124,58,237,0.08)", border: "rgba(124,58,237,0.22)",
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
  {
    id: "review", label: "Write a Review", description: "Share your experience at your own college.",
    color: "var(--dd-warning)", bg: "var(--dd-warning-bg)", border: "var(--dd-warning-border)",
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
      </svg>
    ),
  },
];

function PlusIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round">
      <line x1="12" y1="4" x2="12" y2="20"/><line x1="4" y1="12" x2="20" y2="12"/>
    </svg>
  );
}

export default function CreateMenu() {
  const router = useRouter();
  const [mounted, setMounted]       = useState(false);
  const [sheetOpen, setSheetOpen]   = useState(false);
  const [askState, setAskState]     = useState<{ kind: "question" | "discussion" } | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ id: number; name: string } | null>(null);
  const [checking, setChecking]     = useState(false);
  const [checkError, setCheckError] = useState("");

  // The trigger buttons live inside the top <nav>, which sets
  // backdropFilter — a property that (like `filter`/`transform`) creates a
  // new containing block for `position: fixed` descendants. Left in place,
  // the FAB and the action sheet below would be "fixed" relative to the
  // nav bar's own box instead of the viewport. Portalling them to
  // document.body escapes that.
  useEffect(() => { setMounted(true); }, []);

  function handleTrigger() {
    if (!isAuthenticated()) { router.push("/login"); return; }
    setCheckError("");
    setSheetOpen(true);
  }

  async function handleAction(action: SheetAction) {
    if (action === "ask")     { setSheetOpen(false); setAskState({ kind: "question" }); return; }
    if (action === "discuss") { setSheetOpen(false); setAskState({ kind: "discussion" }); return; }

    // "review" needs the user's own college resolved first — reviews are
    // affiliation-gated, unlike Ask/Discuss, so there's no free picker.
    setChecking(true);
    setCheckError("");
    try {
      const p = await profileApi.get();
      const collegeId   = p.pg_college ?? p.ug_college;
      const collegeName = p.pg_college ? p.pg_college_name : p.ug_college_name;
      if (!collegeId) {
        setCheckError("Add your college on your profile first.");
        return;
      }
      setSheetOpen(false);
      setReviewTarget({ id: collegeId, name: collegeName || "Your College" });
    } catch {
      setCheckError("Couldn't check your profile. Try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      {/* ── Desktop trigger — lives in the top nav's right zone ── */}
      <button
        className="dd-create-desktop-btn"
        onClick={handleTrigger}
        style={{
          alignItems: "center", gap: "6px",
          // This button is a direct child of the top <nav>, which is a flex
          // container with the default align-items: stretch (unlike
          // .dd-nav-right's buttons, which sit inside a wrapper that
          // explicitly centers them) — without this, it stretches to the
          // nav's full height instead of sizing to its own content.
          alignSelf: "center",
          padding: "7px 14px 7px 12px", borderRadius: "9px",
          background: "linear-gradient(135deg,#7c3aed 0%,#0d9488 100%)",
          border: "none", color: "#fff", fontSize: "0.8125rem", fontWeight: 600,
          cursor: "pointer", boxShadow: "0 2px 12px rgba(124,58,237,0.28)",
          whiteSpace: "nowrap",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
          <line x1="7" y1="1" x2="7" y2="13"/><line x1="1" y1="7" x2="13" y2="7"/>
        </svg>
        New
      </button>

      {mounted && createPortal(
        <>
      {/* ── Mobile FAB — raised center of the bottom tab bar. display/position/
           bottom/left/transform are set ONLY via the .dd-create-fab CSS class
           below (never inline) — inline styles beat media queries, so if
           they lived here the "hidden on desktop" rule could never win. ── */}
      <button
        className="dd-create-fab"
        onClick={handleTrigger}
        aria-label="Create"
        style={{
          width: "56px", height: "56px", borderRadius: "50%",
          background: "linear-gradient(135deg,#7c3aed 0%,#0d9488 100%)",
          border: "3px solid var(--dd-bottom-bg)",
          alignItems: "center", justifyContent: "center",
          cursor: "pointer", boxShadow: "0 8px 20px rgba(124,58,237,0.4)",
        }}
      >
        <PlusIcon />
      </button>

      {/* ── Action sheet (bottom sheet on mobile, centered modal on desktop) ── */}
      {sheetOpen && (
        <div
          className="dd-create-backdrop"
          onClick={() => setSheetOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)", display: "flex", justifyContent: "center" }}
        >
          <div
            className="dd-create-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--dd-bg2)", border: "1px solid var(--dd-border)", width: "100%", maxWidth: "420px", padding: "20px", boxShadow: "var(--dd-shadow-lg)" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.05rem", fontWeight: 600, color: "var(--dd-text1)", letterSpacing: "-0.01em" }}>
                Create
              </h2>
              <button onClick={() => setSheetOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dd-text3)", padding: "4px" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-text1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)"; }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {ACTIONS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleAction(a.id)}
                  disabled={checking}
                  style={{
                    display: "flex", alignItems: "center", gap: "14px", textAlign: "left",
                    padding: "14px", borderRadius: "14px",
                    background: "var(--dd-surface)", border: "1px solid var(--dd-border)",
                    cursor: checking ? "wait" : "pointer", transition: "all 0.15s", width: "100%",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = a.bg; e.currentTarget.style.borderColor = a.border; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface)"; e.currentTarget.style.borderColor = "var(--dd-border)"; }}
                >
                  <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: a.bg, border: `1px solid ${a.border}`, color: a.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {a.icon}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--dd-text1)", marginBottom: "2px" }}>{a.label}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--dd-text3)", lineHeight: 1.4 }}>{a.description}</div>
                  </div>
                </button>
              ))}
            </div>

            {checkError && (
              <p style={{ marginTop: "12px", fontSize: "0.8125rem", color: "var(--dd-danger)", textAlign: "center" }}>{checkError}</p>
            )}
          </div>
        </div>
      )}

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

      <style>{`
        .dd-create-desktop-btn {
          display: flex;
        }
        .dd-create-fab {
          display: none;
          position: fixed; left: 50%; z-index: 60;
          bottom: calc(14px + env(safe-area-inset-bottom, 0px));
          transform: translateX(-50%);
        }
        .dd-create-backdrop { align-items: center; }
        .dd-create-sheet { border-radius: 22px; animation: dd-sheet-in-desktop 0.18s ease; }
        @keyframes dd-sheet-in-desktop { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
        @keyframes dd-sheet-in-mobile { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 767px) {
          .dd-create-desktop-btn { display: none; }
          .dd-create-fab { display: flex; }
          .dd-create-backdrop { align-items: flex-end; }
          .dd-create-sheet {
            max-width: 100%;
            border-radius: 22px 22px 0 0;
            padding-bottom: calc(20px + env(safe-area-inset-bottom, 4px));
            animation: dd-sheet-in-mobile 0.2s cubic-bezier(0.22,1,0.36,1);
          }
        }
      `}</style>
        </>,
        document.body
      )}
    </>
  );
}
