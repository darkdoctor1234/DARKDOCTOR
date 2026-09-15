"use client";

import { useRouter } from "next/navigation";
import type { DiscussionPost } from "@/lib/communitiesApi";

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

/** Compact, read-only poll preview shown on the feed card — full interactive voting lives on the detail page. */
function PollPreview({ post }: { post: DiscussionPost }) {
  const sorted = [...post.poll_options].sort((a, b) => b.vote_count - a.vote_count);
  const top = sorted.slice(0, 3);
  return (
    <div style={{ marginTop: "12px", padding: "12px 14px", borderRadius: "12px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--dd-teal)" strokeWidth="2.2" strokeLinecap="round">
          <path d="M18 20V10M12 20V4M6 20v-6"/>
        </svg>
        <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--dd-teal)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
          Poll · {post.total_votes} vote{post.total_votes !== 1 ? "s" : ""}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {top.map((o) => {
          const pct = post.total_votes > 0 ? Math.round((o.vote_count / post.total_votes) * 100) : 0;
          const mine = post.my_vote === o.id;
          return (
            <div key={o.id} style={{ position: "relative", borderRadius: "7px", overflow: "hidden", background: "var(--dd-surface2)", height: "26px" }}>
              <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: mine ? "var(--dd-teal-bg2)" : "var(--dd-border2)", transition: "width 0.3s" }} />
              <div style={{ position: "relative", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px" }}>
                <span style={{ fontSize: "0.78rem", color: "var(--dd-text2)", fontWeight: mine ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.text}</span>
                <span className="num" style={{ fontSize: "0.72rem", color: "var(--dd-text3)", flexShrink: 0, marginLeft: "8px" }}>{pct}%</span>
              </div>
            </div>
          );
        })}
        {post.poll_options.length > 3 && (
          <span style={{ fontSize: "0.72rem", color: "var(--dd-text4)" }}>+{post.poll_options.length - 3} more option{post.poll_options.length - 3 !== 1 ? "s" : ""}</span>
        )}
      </div>
    </div>
  );
}

export default function PostCard({ post, communityId }: { post: DiscussionPost; communityId: number }) {
  const router = useRouter();
  return (
    <div
      onClick={() => router.push(`/communities/${communityId}/posts/${post.id}`)}
      style={{
        padding: "18px 20px", borderRadius: "16px",
        background: "var(--dd-bg2)", border: "1px solid var(--dd-border)",
        cursor: "pointer", transition: "all 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--dd-border2)"; e.currentTarget.style.boxShadow = "var(--dd-shadow-sm)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--dd-border)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
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

      <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.0625rem", fontWeight: 600, color: "var(--dd-text1)", letterSpacing: "-0.01em", marginBottom: "6px", lineHeight: 1.35 }}>
        {post.title}
      </h3>
      <p style={{
        fontSize: "0.875rem", color: "var(--dd-text2)", lineHeight: 1.6,
        display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
      }}>
        {post.content}
      </p>

      {post.has_poll && <PollPreview post={post} />}

      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--dd-border)" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--dd-text3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
        </svg>
        <span style={{ fontSize: "0.8125rem", color: "var(--dd-text3)" }}>
          {post.comment_count} comment{post.comment_count !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
