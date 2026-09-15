"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { communitiesApi, type MyCommunity, type DiscussionPost } from "@/lib/communitiesApi";
import UserShell from "@/components/UserShell";
import SpecialtyIcon from "@/components/communities/SpecialtyIcon";
import PostCard from "@/components/communities/PostCard";
import CreatePostModal from "@/components/communities/CreatePostModal";

function GlobeIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15.3 15.3 0 014 9 15.3 15.3 0 01-4 9 15.3 15.3 0 01-4-9 15.3 15.3 0 014-9z" />
    </svg>
  );
}

export default function CommunityFeedPage() {
  const router = useRouter();
  const params = useParams();
  const communityId = Number(params.communityId);

  const [community, setCommunity] = useState<MyCommunity | null>(null);
  const [posts,       setPosts]     = useState<DiscussionPost[]>([]);
  const [loading,     setLoading]   = useState(true);
  const [error,       setError]     = useState("");
  const [showCreate,  setShowCreate] = useState(false);
  const [exiting,     setExiting]    = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([communitiesApi.mine(), communitiesApi.posts.list(communityId)])
      .then(([mine, list]) => {
        const found = mine.find((c) => c.id === communityId) ?? null;
        setCommunity(found);
        setPosts(list);
      })
      .catch(() => setError("Could not load this community. You may not be a member."))
      .finally(() => setLoading(false));
  }, [communityId]);

  useEffect(() => { if (!isNaN(communityId)) load(); }, [communityId, load]);

  async function handleJoin() {
    try { await communitiesApi.join(communityId); load(); } catch { /* silent */ }
  }

  async function handleExit() {
    if (exiting) return;
    setExiting(true);
    try { await communitiesApi.exit(communityId); router.push("/communities"); }
    catch { setExiting(false); }
  }

  return (
    <UserShell>
      <div style={{ minHeight: "100vh", background: "var(--dd-bg)" }}>
        <main style={{ maxWidth: "700px", margin: "0 auto", padding: "32px 20px 80px" }}>

          <button onClick={() => router.push("/communities")} style={{
            display: "inline-flex", alignItems: "center", gap: "5px",
            background: "none", border: "none", cursor: "pointer",
            color: "var(--dd-text3)", fontSize: "0.8125rem", fontWeight: 500, padding: 0, marginBottom: "20px",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-text2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)"; }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 12L6 8l4-4"/></svg>
            My Communities
          </button>

          {loading ? (
            <div style={{ height: "260px", borderRadius: "18px", background: "var(--dd-surface2)", animation: "dd-pulse 1.4s ease-in-out infinite" }}>
              <style>{`@keyframes dd-pulse{0%,100%{opacity:.35}50%{opacity:.65}}`}</style>
            </div>
          ) : !community || !community.is_active ? (
            <div style={{ textAlign: "center", padding: "56px 20px", borderRadius: "18px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)" }}>
              <p style={{ fontSize: "0.9rem", color: "var(--dd-text2)", lineHeight: 1.6, marginBottom: "16px" }}>
                {community ? "You've left this community." : (error || "This community isn't available to you.")}
              </p>
              {community && (
                <button onClick={handleJoin} style={{ padding: "9px 22px", borderRadius: "10px", background: "linear-gradient(135deg,#7c3aed 0%,#0d9488 100%)", border: "none", color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>
                  Rejoin
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Community header */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "13px", background: "var(--dd-teal-bg2)", color: "var(--dd-teal)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {community.type === "national_overall" ? <GlobeIcon /> : <SpecialtyIcon department={community.department} size={22} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.25rem", fontWeight: 700, color: "var(--dd-text1)", letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {community.name}
                  </h1>
                  <p style={{ fontSize: "0.8125rem", color: "var(--dd-text3)" }}>
                    <span className="num">{community.member_count}</span> member{community.member_count !== 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  onClick={handleExit}
                  disabled={exiting}
                  title="Exit community"
                  aria-label="Exit community"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0,
                    background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)",
                    color: "var(--dd-text3)", cursor: exiting ? "wait" : "pointer", transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-danger)"; e.currentTarget.style.borderColor = "var(--dd-danger-border)"; e.currentTarget.style.background = "var(--dd-danger-bg)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)"; e.currentTarget.style.borderColor = "var(--dd-border2)"; e.currentTarget.style.background = "var(--dd-surface2)"; }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>
                  </svg>
                </button>
                <button
                  onClick={() => setShowCreate(true)}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "9px 16px", borderRadius: "10px", flexShrink: 0,
                    background: "linear-gradient(135deg,#7c3aed 0%,#0d9488 100%)",
                    border: "none", color: "white", fontSize: "0.8125rem", fontWeight: 600,
                    cursor: "pointer", boxShadow: "0 4px 16px rgba(124,58,237,0.28)", whiteSpace: "nowrap",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <line x1="7" y1="1" x2="7" y2="13"/><line x1="1" y1="7" x2="13" y2="7"/>
                  </svg>
                  Post
                </button>
              </div>

              {posts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "56px 20px", borderRadius: "18px", background: "var(--dd-surface)", border: "1px solid var(--dd-border)" }}>
                  <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.05rem", fontWeight: 600, color: "var(--dd-text1)", marginBottom: "8px" }}>
                    No posts yet
                  </h3>
                  <p style={{ fontSize: "0.875rem", color: "var(--dd-text3)" }}>
                    Be the first to start a discussion in {community.name}.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {posts.map((post) => <PostCard key={post.id} post={post} communityId={communityId} />)}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {showCreate && community && (
        <CreatePostModal
          communityId={community.id}
          communityName={community.name}
          onClose={() => setShowCreate(false)}
          onSubmitted={(post) => {
            setShowCreate(false);
            setPosts((prev) => [post, ...prev]);
            router.push(`/communities/${communityId}/posts/${post.id}`);
          }}
        />
      )}
    </UserShell>
  );
}
