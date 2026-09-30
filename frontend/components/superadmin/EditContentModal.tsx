"use client";

import { useState, useEffect } from "react";

export interface RatingField {
  key: string;
  label: string;
  value: number;
}

interface Props {
  open: boolean;
  heading: string;
  initialTitle?: string;   // undefined = no title field (Answers/Comments have none)
  initialContent: string;
  ratings?: RatingField[]; // only Reviews pass this
  onClose: () => void;
  onSave: (values: { title?: string; content: string; ratings?: Record<string, number> }) => Promise<void>;
}

/** Shared super-admin "edit content in place" modal — reused for Reviews,
 * Questions, Answers, Discussion posts, and Community comments. */
export default function EditContentModal({ open, heading, initialTitle, initialContent, ratings, onClose, onSave }: Props) {
  const [title, setTitle] = useState(initialTitle ?? "");
  const [content, setContent] = useState(initialContent);
  const [ratingValues, setRatingValues] = useState<Record<string, number>>(
    Object.fromEntries((ratings ?? []).map((r) => [r.key, r.value])),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initialTitle ?? "");
    setContent(initialContent);
    setRatingValues(Object.fromEntries((ratings ?? []).map((r) => [r.key, r.value])));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSave() {
    if (!content.trim()) { setError("Content can't be empty."); return; }
    setLoading(true);
    setError(null);
    try {
      await onSave({
        title: initialTitle !== undefined ? title : undefined,
        content,
        ratings: ratings ? ratingValues : undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: "10px",
    background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)",
    color: "var(--dd-text1)", fontSize: "0.875rem", outline: "none", fontFamily: "inherit",
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", pointerEvents: "none" }}>
        <div style={{
          width: "100%", maxWidth: "480px", maxHeight: "88vh", overflowY: "auto",
          background: "var(--dd-bg2)", border: "1px solid var(--dd-border)", borderRadius: "20px",
          boxShadow: "var(--dd-shadow-lg)", padding: "26px 24px", pointerEvents: "auto",
          animation: "slideUp 0.18s ease",
        }}>
          <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.0625rem", fontWeight: 600, color: "var(--dd-text1)", letterSpacing: "-0.01em", marginBottom: "16px" }}>
            {heading}
          </h3>

          {initialTitle !== undefined && (
            <div style={{ marginBottom: "12px" }}>
              <label htmlFor="edit-title" style={{ display: "block", fontSize: "0.8125rem", color: "var(--dd-text3)", marginBottom: "6px" }}>Title</label>
              <input id="edit-title" name="edit-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
            </div>
          )}

          <div style={{ marginBottom: ratings ? "16px" : "18px" }}>
            <label htmlFor="edit-content" style={{ display: "block", fontSize: "0.8125rem", color: "var(--dd-text3)", marginBottom: "6px" }}>Content</label>
            <textarea id="edit-content" name="edit-content" rows={6} value={content} onChange={(e) => setContent(e.target.value)} style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          {ratings && ratings.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "18px" }}>
              {ratings.map((r) => (
                <div key={r.key}>
                  <label htmlFor={`edit-${r.key}`} style={{ display: "block", fontSize: "0.75rem", color: "var(--dd-text3)", marginBottom: "5px" }}>{r.label}</label>
                  <input id={`edit-${r.key}`} name={`edit-${r.key}`} type="number" min={1} max={5}
                    value={ratingValues[r.key] ?? 1}
                    onChange={(e) => setRatingValues((prev) => ({ ...prev, [r.key]: Number(e.target.value) }))}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div style={{ marginBottom: "14px", padding: "9px 12px", borderRadius: "8px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)" }}>
              <span style={{ fontSize: "0.8125rem", color: "var(--dd-danger)" }}>{error}</span>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onClose} style={{
              flex: 1, padding: "10px", borderRadius: "10px",
              background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)",
              color: "var(--dd-text2)", fontSize: "0.9375rem", fontWeight: 500, cursor: "pointer",
            }}>Cancel</button>
            <button onClick={handleSave} disabled={loading} style={{
              flex: 1, padding: "10px", borderRadius: "10px",
              background: loading ? "var(--dd-border2)" : "linear-gradient(135deg,#ac2430 0%,#0d9488 100%)",
              border: "none", color: "white", fontSize: "0.9375rem", fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, transition: "all 0.2s",
            }}>
              {loading ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(12px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }`}</style>
    </>
  );
}
