"use client";

import { useState } from "react";
import { communitiesApi, type DiscussionPost } from "@/lib/communitiesApi";

interface Props {
  communityId: number;
  communityName: string;
  onClose: () => void;
  onSubmitted: (post: DiscussionPost) => void;
}

export default function CreatePostModal({ communityId, communityName, onClose, onSubmitted }: Props) {
  const [title,      setTitle]      = useState("");
  const [content,    setContent]    = useState("");
  const [hasPoll,    setHasPoll]    = useState(false);
  const [options,    setOptions]    = useState<string[]>(["", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  function updateOption(i: number, value: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  }
  function addOption() {
    if (options.length >= 8) return;
    setOptions((prev) => [...prev, ""]);
  }
  function removeOption(i: number) {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim())     return setError("Please enter a title.");
    if (!content.trim())   return setError("Please write something for the group to see.");

    const cleanedOptions = hasPoll ? options.map((o) => o.trim()).filter(Boolean) : [];
    if (hasPoll && cleanedOptions.length < 2) {
      return setError("A poll needs at least 2 filled-in options (or turn the poll off).");
    }

    setSubmitting(true);
    try {
      const post = await communitiesApi.posts.create({
        community: communityId,
        title: title.trim(),
        content: content.trim(),
        poll_options: cleanedOptions,
      });
      onSubmitted(post);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to post.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--dd-bg2)", borderRadius: "22px", border: "1px solid var(--dd-border)", width: "100%", maxWidth: "540px", maxHeight: "90vh", overflowY: "auto", padding: "28px", boxShadow: "var(--dd-shadow-lg)" }}>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "22px" }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.2rem", fontWeight: 600, color: "var(--dd-text1)", letterSpacing: "-0.01em", marginBottom: "4px" }}>
              New Post
            </h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--dd-text3)" }}>Posting to <strong style={{ color: "var(--dd-text2)" }}>{communityName}</strong>, visible to the whole group.</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dd-text3)", padding: "4px" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-text1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)"; }}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

          <div>
            <label style={labelStyle}>Title</label>
            <input id="post-title" name="title" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 58F with sudden-onset chest pain, next step?"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Details</label>
            <textarea
              id="post-content" name="content"
              value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="Case details, a question for the group, whatever's on your mind…"
              rows={5}
              style={{ ...inputStyle, resize: "vertical", minHeight: "110px" }}
            />
          </div>

          {/* Poll toggle */}
          <div>
            <button
              type="button"
              onClick={() => setHasPoll((v) => !v)}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 14px", borderRadius: "10px", width: "100%",
                background: hasPoll ? "var(--dd-teal-bg2)" : "var(--dd-surface)",
                border: `1px solid ${hasPoll ? "var(--dd-teal-border)" : "var(--dd-border2)"}`,
                color: hasPoll ? "var(--dd-teal-hover)" : "var(--dd-text2)",
                fontSize: "0.875rem", fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 20V10M12 20V4M6 20v-6"/>
              </svg>
              {hasPoll ? "Poll added, tap to remove" : "Add a poll (optional)"}
            </button>

            {hasPoll && (
              <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {options.map((opt, i) => (
                  <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      id={`post-poll-option-${i}`} name={`poll-option-${i}`}
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    {options.length > 2 && (
                      <button type="button" onClick={() => removeOption(i)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dd-text3)", display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "38px", borderRadius: "8px", transition: "all 0.12s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-danger)"; e.currentTarget.style.background = "var(--dd-danger-bg)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)"; e.currentTarget.style.background = "none"; }}
                      >
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                          <line x1="2" y1="2" x2="12" y2="12"/><line x1="12" y1="2" x2="2" y2="12"/>
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                {options.length < 8 && (
                  <button type="button" onClick={addOption}
                    style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "8px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border)", color: "var(--dd-text2)", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer" }}
                  >
                    <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
                      <line x1="7" y1="1" x2="7" y2="13"/><line x1="1" y1="7" x2="13" y2="7"/>
                    </svg>
                    Add option
                  </button>
                )}
              </div>
            )}
          </div>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "10px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", color: "var(--dd-danger)", fontSize: "0.8125rem" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting}
            style={{
              padding: "13px", borderRadius: "12px",
              background: submitting ? "var(--dd-border2)" : "linear-gradient(135deg,#7c3aed 0%,#0d9488 100%)",
              border: "none", color: submitting ? "var(--dd-text4)" : "#fff", fontSize: "0.9375rem", fontWeight: 600,
              cursor: submitting ? "not-allowed" : "pointer",
              boxShadow: submitting ? "none" : "0 4px 20px rgba(124,58,237,0.3)",
            }}
          >
            {submitting ? "Posting…" : "Post to Group"}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.75rem", fontWeight: 600,
  color: "var(--dd-text3)", letterSpacing: "0.06em", textTransform: "uppercase",
  marginBottom: "8px",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 13px", borderRadius: "10px",
  background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)",
  color: "var(--dd-text1)", fontSize: "0.9rem", outline: "none",
  boxSizing: "border-box", transition: "border-color 0.15s",
};
