"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { communitiesApi, type DiscussionPost, type CommunityComment } from "@/lib/communitiesApi";
import UserShell from "@/components/UserShell";
import ReportButton from "@/components/communities/ReportButton";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Interactive poll — click an option to vote (or change your vote). */
function InteractivePoll({ post, onVoted }: { post: DiscussionPost; onVoted: (updated: DiscussionPost) => void }) {
  const [voting, setVoting] = useState<number | null>(null);
  const hasVoted = post.my_vote !== null;

  async function vote(optionId: number) {
    setVoting(optionId);
    try {
      const updated = await communitiesApi.posts.vote(post.id, optionId);
      onVoted(updated);
    } catch { /* silent — leave state as-is */ }
    finally { setVoting(null); }
  }

  return (
    <div style={{ marginTop: "18px", padding: "16px 18px", borderRadius: "14px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--dd-teal)" strokeWidth="2.2" strokeLinecap="round">
          <path d="M18 20V10M12 20V4M6 20v-6"/>
        </svg>
        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--dd-teal)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
          Poll · {post.total_votes} vote{post.total_votes !== 1 ? "s" : ""}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {post.poll_options.map((o) => {
          const pct = post.total_votes > 0 ? Math.round((o.vote_count / post.total_votes) * 100) : 0;
          const mine = post.my_vote === o.id;
          return (
            <button
              key={o.id}
              onClick={() => vote(o.id)}
              disabled={voting !== null}
              style={{
                position: "relative", borderRadius: "9px", overflow: "hidden",
                border: `1px solid ${mine ? "var(--dd-teal-border)" : "var(--dd-border2)"}`,
                height: "38px", cursor: "pointer",
                background: "var(--dd-bg2)", width: "100%", textAlign: "left",
                opacity: voting !== null && voting !== o.id ? 0.6 : 1,
              }}
            >
              {hasVoted && (
                <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: mine ? "var(--dd-teal-bg2)" : "var(--dd-surface2)", transition: "width 0.3s" }} />
              )}
              <div style={{ position: "relative", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px" }}>
                <span style={{ fontSize: "0.875rem", color: mine ? "var(--dd-teal-hover)" : "var(--dd-text1)", fontWeight: mine ? 600 : 500, display: "flex", alignItems: "center", gap: "6px" }}>
                  {mine && (
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><polyline points="3 8 6 11 13 4"/></svg>
                  )}
                  {o.text}
                </span>
                {hasVoted && <span className="num" style={{ fontSize: "0.8rem", color: "var(--dd-text3)", flexShrink: 0, marginLeft: "8px" }}>{pct}%</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CommentBox({ postId, onPosted }: { postId: number; onPosted: (c: CommunityComment) => void }) {
  const [content,   setContent]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return setError("Write something before posting.");
    setSubmitting(true);
    setError("");
    try {
      const comment = await communitiesApi.comments.create(postId, content.trim());
      onPosted(comment);
      setContent("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to post comment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <textarea
        id="comment-content" name="content"
        value={content} onChange={(e) => setContent(e.target.value)}
        placeholder="Reply to the group…"
        rows={3}
        style={{
          width: "100%", padding: "12px 14px", borderRadius: "12px",
          background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)",
          color: "var(--dd-text1)", fontSize: "0.875rem", outline: "none",
          resize: "vertical", minHeight: "72px", boxSizing: "border-box", fontFamily: "inherit",
        }}
      />
      {error && <span style={{ fontSize: "0.78rem", color: "var(--dd-danger)" }}>{error}</span>}
      <button type="submit" disabled={submitting}
        style={{
          alignSelf: "flex-end", padding: "9px 20px", borderRadius: "10px",
          background: submitting ? "var(--dd-border2)" : "linear-gradient(135deg,#7c3aed 0%,#0d9488 100%)",
          border: "none", color: submitting ? "var(--dd-text4)" : "#fff", fontSize: "0.8125rem", fontWeight: 600,
          cursor: submitting ? "not-allowed" : "pointer",
        }}
      >
        {submitting ? "Posting…" : "Post"}
      </button>
    </form>
  );
}

export default function DiscussionPostPage() {
  const router = useRouter();
  const params = useParams();
  const communityId = Number(params.communityId);
  const postId = Number(params.postId);

  const [post,    setPost]    = useState<DiscussionPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const load = useCallback(() => {
    setLoading(true);
    communitiesApi.posts.get(postId)
      .then(setPost)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "This discussion could not be found."))
      .finally(() => setLoading(false));
  }, [postId]);

  useEffect(() => { if (!isNaN(postId)) load(); }, [postId, load]);

  return (
    <UserShell>
      <div style={{ minHeight: "100vh", background: "var(--dd-bg)" }}>
        <main style={{ maxWidth: "700px", margin: "0 auto", padding: "32px 20px 80px" }}>

          <button onClick={() => router.push(`/communities/${communityId}`)} style={{
            display: "inline-flex", alignItems: "center", gap: "5px",
            background: "none", border: "none", cursor: "pointer",
            color: "var(--dd-text3)", fontSize: "0.8125rem", fontWeight: 500, padding: 0, marginBottom: "20px",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-text2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)"; }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 12L6 8l4-4"/></svg>
            {post?.community_name ?? "Back"}
          </button>

          {loading ? (
            <div style={{ height: "260px", borderRadius: "18px", background: "var(--dd-surface2)", animation: "dd-pulse 1.4s ease-in-out infinite" }}>
              <style>{`@keyframes dd-pulse{0%,100%{opacity:.35}50%{opacity:.65}}`}</style>
            </div>
          ) : error || !post ? (
            <div style={{ textAlign: "center", padding: "64px 20px", borderRadius: "18px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)" }}>
              <p style={{ color: "var(--dd-text3)", fontSize: "0.9rem" }}>{error || "Discussion not found."}</p>
            </div>
          ) : (
            <>
              {/* Post */}
              <div style={{ padding: "22px 24px", borderRadius: "18px", background: "var(--dd-bg2)", border: "1px solid var(--dd-border)", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--dd-text1)" }}>{post.display_name}</span>
                  {post.author_department && (
                    <span style={{ fontSize: "0.72rem", fontWeight: 500, padding: "2px 9px", borderRadius: "20px", background: "var(--dd-surface2)", color: "var(--dd-text2)" }}>
                      {post.author_department}
                    </span>
                  )}
                  {post.is_mine && (
                    <span style={{ fontSize: "0.68rem", fontWeight: 600, padding: "1px 7px", borderRadius: "20px", background: "var(--dd-teal-bg2)", color: "var(--dd-teal)" }}>You</span>
                  )}
                  <span style={{ fontSize: "0.75rem", color: "var(--dd-text4)", marginLeft: "auto" }}>{timeAgo(post.created_at)}</span>
                </div>

                <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.4rem", fontWeight: 700, color: "var(--dd-text1)", letterSpacing: "-0.02em", lineHeight: 1.3, marginBottom: "12px" }}>
                  {post.title}
                </h1>
                <p style={{ fontSize: "0.9375rem", color: "var(--dd-text2)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {post.content}
                </p>

                {post.has_poll && <InteractivePoll post={post} onVoted={setPost} />}

                {!post.is_mine && (
                  <div style={{ marginTop: "14px" }}>
                    <ReportButton onReport={(reason, detail) => communitiesApi.posts.report(post.id, reason, detail).then(() => {})} />
                  </div>
                )}
              </div>

              {/* Comments */}
              <div style={{ marginBottom: "16px" }}>
                <h2 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--dd-text1)", marginBottom: "14px" }}>
                  {post.comments?.length ?? 0} Comment{(post.comments?.length ?? 0) !== 1 ? "s" : ""}
                </h2>

                {post.comments && post.comments.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" }}>
                    {post.comments.map((c) => (
                      <div key={c.id} style={{ padding: "13px 16px", borderRadius: "12px", background: "var(--dd-bg2)", border: "1px solid var(--dd-border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--dd-text2)" }}>{c.display_name}</span>
                          {c.author_department && (
                            <span style={{ fontSize: "0.68rem", fontWeight: 500, padding: "1px 7px", borderRadius: "20px", background: "var(--dd-surface2)", color: "var(--dd-text3)" }}>
                              {c.author_department}
                            </span>
                          )}
                          {c.is_mine && (
                            <span style={{ fontSize: "0.65rem", fontWeight: 600, padding: "1px 6px", borderRadius: "20px", background: "var(--dd-teal-bg2)", color: "var(--dd-teal)" }}>You</span>
                          )}
                          <span style={{ fontSize: "0.72rem", color: "var(--dd-text4)" }}>{timeAgo(c.created_at)}</span>
                        </div>
                        <p style={{ fontSize: "0.875rem", color: "var(--dd-text2)", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: c.is_mine ? 0 : "4px" }}>{c.content}</p>
                        {!c.is_mine && (
                          <ReportButton onReport={(reason, detail) => communitiesApi.comments.report(c.id, reason, detail).then(() => {})} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isAuthenticated() && (
                <CommentBox
                  postId={post.id}
                  onPosted={(c) => setPost((prev) => prev ? { ...prev, comments: [...(prev.comments ?? []), c], comment_count: prev.comment_count + 1 } : prev)}
                />
              )}
            </>
          )}
        </main>
      </div>
    </UserShell>
  );
}
