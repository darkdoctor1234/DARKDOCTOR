"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getUser, clearSession, getRefreshToken, getAccessToken, isAuthenticated } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { communitiesApi, type AdminDiscussionPost, type AdminCommunityComment } from "@/lib/communitiesApi";

const REASON_MAP: Record<string, string> = {
  spam: "Spam or advertisement", offensive: "Offensive or inappropriate",
  misleading: "Medically misleading", harassment: "Harassment of another member",
  other: "Other",
};

type Tab = "posts" | "comments";

export default function FlaggedCommunityContentPage() {
  const router = useRouter();
  const [user,     setUser]     = useState<{ email: string; full_name: string; role: string } | null>(null);
  const [tab,       setTab]      = useState<Tab>("posts");
  const [posts,     setPosts]    = useState<AdminDiscussionPost[]>([]);
  const [comments,  setComments] = useState<AdminCommunityComment[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [acting,    setActing]   = useState<number | null>(null);
  const [toast,     setToast]    = useState("");

  useEffect(() => {
    if (!isAuthenticated()) { router.replace("/superadmin"); return; }
    const u = getUser<{ email: string; full_name: string; role: string }>();
    if (u?.role !== "super_admin") { router.replace("/superadmin"); return; }
    setUser(u);
  }, [router]);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([communitiesApi.posts.flagged(), communitiesApi.comments.flagged()])
      .then(([p, c]) => { setPosts(p); setComments(c); })
      .catch(() => { setPosts([]); setComments([]); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function handlePostAction(id: number, action: "approve" | "remove") {
    setActing(id);
    try {
      await communitiesApi.posts.adminAction(id, action);
      showToast(action === "approve" ? "Post restored" : "Post removed");
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch { showToast("Action failed"); }
    finally { setActing(null); }
  }

  async function handleCommentAction(id: number, action: "approve" | "remove") {
    setActing(id);
    try {
      await communitiesApi.comments.adminAction(id, action);
      showToast(action === "approve" ? "Comment restored" : "Comment removed");
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch { showToast("Action failed"); }
    finally { setActing(null); }
  }

  async function handleLogout() {
    try { await authApi.logout(getRefreshToken()!, getAccessToken()!); } catch {}
    finally { clearSession(); router.replace("/superadmin"); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--dd-bg)", color: "var(--dd-text1)" }}>

      {toast && (
        <div style={{ position: "fixed", top: "72px", left: "50%", transform: "translateX(-50%)", zIndex: 100, padding: "10px 20px", borderRadius: "12px", background: "var(--dd-bg2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text1)", fontSize: "0.875rem", fontWeight: 500, boxShadow: "var(--dd-shadow-lg)", backdropFilter: "blur(12px)" }}>
          {toast}
        </div>
      )}

      <nav style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--dd-nav-bg)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--dd-border)", padding: "0 16px", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, overflow: "hidden" }}>
          <button onClick={() => router.push("/superadmin/home")}
            style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "var(--dd-text2)", cursor: "pointer", fontSize: "0.875rem", padding: "6px 10px", borderRadius: "8px" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--dd-text2)"; }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 12L6 8l4-4"/></svg>
            Home
          </button>
          <span style={{ color: "var(--dd-border2)" }}>/</span>
          <span style={{ fontSize: "0.875rem", color: "var(--dd-text1)", fontWeight: 600 }}>Flagged Communities Content</span>
          <span style={{ fontSize: "0.6875rem", padding: "2px 8px", borderRadius: "20px", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.28)", color: "#7c3aed", fontWeight: 500 }}>SUPER ADMIN</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <span className="dd-admin-nav-email" style={{ fontSize: "0.8125rem", color: "var(--dd-text3)" }}>{user?.email}</span>
          <button onClick={handleLogout} style={{ padding: "7px 14px", borderRadius: "8px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text2)", fontSize: "0.8125rem", cursor: "pointer", flexShrink: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-text1)"; e.currentTarget.style.background = "var(--dd-border2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text2)"; e.currentTarget.style.background = "var(--dd-surface2)"; }}
          >Sign Out</button>
        </div>
      </nav>

      <main style={{ maxWidth: "860px", margin: "0 auto", padding: "40px 20px 80px" }}>

        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.5rem,4vw,2rem)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--dd-text1)", marginBottom: "6px" }}>
            Flagged Communities Content
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--dd-text3)" }}>
            Posts and comments auto-hidden after 5+ reports. Approve to restore or remove permanently.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
          <button onClick={() => setTab("posts")} style={{
            padding: "8px 18px", borderRadius: "20px", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
            background: tab === "posts" ? "rgba(124,58,237,0.12)" : "var(--dd-surface2)",
            border: `1px solid ${tab === "posts" ? "rgba(124,58,237,0.3)" : "var(--dd-border2)"}`,
            color: tab === "posts" ? "#7c3aed" : "var(--dd-text2)",
          }}>
            Posts <span className="num">({posts.length})</span>
          </button>
          <button onClick={() => setTab("comments")} style={{
            padding: "8px 18px", borderRadius: "20px", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
            background: tab === "comments" ? "rgba(124,58,237,0.12)" : "var(--dd-surface2)",
            border: `1px solid ${tab === "comments" ? "rgba(124,58,237,0.3)" : "var(--dd-border2)"}`,
            color: tab === "comments" ? "#7c3aed" : "var(--dd-text2)",
          }}>
            Comments <span className="num">({comments.length})</span>
          </button>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {[1,2,3].map((i) => (
              <div key={i} style={{ height: "150px", borderRadius: "18px", background: "var(--dd-surface2)", animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i*0.15}s` }} />
            ))}
            <style>{`@keyframes pulse{0%,100%{opacity:.25}50%{opacity:.55}}`}</style>
          </div>
        ) : tab === "posts" ? (
          posts.length === 0 ? (
            <EmptyState label="posts" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {posts.map((post) => (
                <div key={post.id} style={{ background: "var(--dd-warning-bg)", borderRadius: "18px", border: "1px solid var(--dd-warning-border)", padding: "20px 22px" }}>
                  <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600, color: "var(--dd-text1)", fontSize: "0.9rem" }}>{post.display_name}</span>
                        <span style={{ fontSize: "0.75rem", color: "var(--dd-text3)" }}>{post.author_email}</span>
                        <span style={{ fontSize: "0.75rem", color: "var(--dd-text3)" }}>· {post.community_name}</span>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "var(--dd-text4)", marginTop: "2px" }}>
                        {new Date(post.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div style={{ background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", borderRadius: "10px", padding: "6px 12px", textAlign: "center", flexShrink: 0 }}>
                      <div className="num" style={{ fontSize: "1rem", fontWeight: 700, color: "var(--dd-danger)", lineHeight: 1 }}>{post.report_count}</div>
                      <div style={{ fontSize: "0.6rem", color: "var(--dd-danger)", opacity: 0.7 }}>reports</div>
                    </div>
                  </div>

                  <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "0.9375rem", fontWeight: 700, color: "var(--dd-text1)", marginBottom: "6px" }}>{post.title}</h3>
                  <p style={{ fontSize: "0.875rem", color: "var(--dd-text2)", lineHeight: 1.6, marginBottom: "16px" }}>{post.content}</p>

                  <ActionRow
                    acting={acting === post.id}
                    onApprove={() => handlePostAction(post.id, "approve")}
                    onRemove={() => handlePostAction(post.id, "remove")}
                  />
                </div>
              ))}
            </div>
          )
        ) : comments.length === 0 ? (
          <EmptyState label="comments" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {comments.map((c) => (
              <div key={c.id} style={{ background: "var(--dd-warning-bg)", borderRadius: "18px", border: "1px solid var(--dd-warning-border)", padding: "20px 22px" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, color: "var(--dd-text1)", fontSize: "0.9rem" }}>{c.display_name}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--dd-text3)" }}>{c.author_email}</span>
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "var(--dd-text4)", marginTop: "2px" }}>
                      On &ldquo;{c.post_title}&rdquo; · {new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div style={{ background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", borderRadius: "10px", padding: "6px 12px", textAlign: "center", flexShrink: 0 }}>
                    <div className="num" style={{ fontSize: "1rem", fontWeight: 700, color: "var(--dd-danger)", lineHeight: 1 }}>{c.report_count}</div>
                    <div style={{ fontSize: "0.6rem", color: "var(--dd-danger)", opacity: 0.7 }}>reports</div>
                  </div>
                </div>

                <p style={{ fontSize: "0.875rem", color: "var(--dd-text2)", lineHeight: 1.6, marginBottom: "16px" }}>{c.content}</p>

                <ActionRow
                  acting={acting === c.id}
                  onApprove={() => handleCommentAction(c.id, "approve")}
                  onRemove={() => handleCommentAction(c.id, "remove")}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      <style>{`
        @media (max-width: 560px) {
          .dd-admin-nav-email { display: none; }
        }
      `}</style>
    </div>
  );
}

function ActionRow({ acting, onApprove, onRemove }: { acting: boolean; onApprove: () => void; onRemove: () => void }) {
  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "center", paddingTop: "14px", borderTop: "1px solid var(--dd-border)" }}>
      <button
        onClick={onApprove}
        disabled={acting}
        style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 18px", borderRadius: "10px", background: "var(--dd-success-bg)", border: "1px solid var(--dd-success-border)", color: "var(--dd-success)", fontSize: "0.875rem", fontWeight: 600, cursor: acting ? "not-allowed" : "pointer", transition: "all 0.15s" }}
        onMouseEnter={(e) => { if (!acting) e.currentTarget.style.background = "rgba(21,128,61,0.16)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-success-bg)"; }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="3 8 6 11 13 4"/></svg>
        {acting ? "Processing…" : "Approve & Restore"}
      </button>
      <button
        onClick={onRemove}
        disabled={acting}
        style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 18px", borderRadius: "10px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", color: "var(--dd-danger)", fontSize: "0.875rem", fontWeight: 600, cursor: acting ? "not-allowed" : "pointer", transition: "all 0.15s" }}
        onMouseEnter={(e) => { if (!acting) e.currentTarget.style.background = "rgba(185,28,28,0.14)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-danger-bg)"; }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
        Remove
      </button>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{ textAlign: "center", padding: "64px 0" }}>
      <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.1rem", fontWeight: 600, color: "var(--dd-text1)", marginBottom: "6px" }}>All clear</h2>
      <p style={{ color: "var(--dd-text3)", fontSize: "0.875rem" }}>No flagged {label} at the moment.</p>
    </div>
  );
}
