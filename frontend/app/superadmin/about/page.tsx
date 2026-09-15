"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getUser, clearSession, getRefreshToken, getAccessToken } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { aboutApi, AboutUs, SocialHandle } from "@/lib/aboutApi";

/* ── Social icon (same map as public page) ─────────────────────────────── */
function SocialIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  if (p.includes("instagram"))
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>;
  if (p.includes("twitter") || p === "x")
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
  if (p.includes("linkedin"))
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>;
  if (p.includes("youtube"))
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 001.46 6.42 29 29 0 001 12a29 29 0 00.46 5.58 2.78 2.78 0 001.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.96A29 29 0 0023 12a29 29 0 00-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>;
  if (p.includes("facebook"))
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>;
  if (p.includes("whatsapp"))
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>;
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>;
}

/* ── Editable section card ─────────────────────────────────────────────── */
type AboutField = "mission" | "vision" | "about" | "contact_email";

function EditableSection({
  label, field, value, onSave,
}: {
  label: string; field: AboutField; value: string;
  onSave: (field: AboutField, val: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  async function save() {
    setSaving(true); setErr(null);
    try { await onSave(field, draft.trim()); setEditing(false); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "Save failed."); }
    finally { setSaving(false); }
  }

  function cancel() { setDraft(value); setEditing(false); setErr(null); }

  const isEmail = field === "contact_email";

  return (
    <div style={{
      borderRadius: "16px", border: "1px solid var(--dd-border)",
      background: "var(--dd-surface)", overflow: "hidden",
    }}>
      {/* Section header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 22px", borderBottom: editing ? "1px solid var(--dd-border)" : "none",
      }}>
        <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {label}
        </p>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              background: "none", border: "1px solid var(--dd-border2)",
              borderRadius: "8px", padding: "5px 12px", cursor: "pointer",
              color: "var(--dd-text2)", fontSize: "0.78rem", fontWeight: 500, transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--dd-text2)"; }}
          >
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-9 9L3 17l1.586-4.414 9-9z"/>
            </svg>
            Edit
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "0 22px 22px" }}>
        {editing ? (
          <div style={{ paddingTop: "16px" }}>
            {isEmail ? (
              <input
                id={`about-${field}`} name={field}
                ref={ref as React.RefObject<HTMLInputElement>}
                type="email" value={draft} onChange={(e) => setDraft(e.target.value)}
                placeholder="contact@example.com"
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: "10px",
                  background: "var(--dd-input-bg)", border: "1px solid rgba(124,58,237,0.4)",
                  color: "var(--dd-text1)", fontSize: "0.9375rem", outline: "none", boxSizing: "border-box",
                }}
              />
            ) : (
              <textarea
                id={`about-${field}`} name={field}
                ref={ref as React.RefObject<HTMLTextAreaElement>}
                value={draft} onChange={(e) => setDraft(e.target.value)}
                rows={6}
                placeholder={`Write your ${label.toLowerCase()} here…`}
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: "10px",
                  background: "var(--dd-input-bg)", border: "1px solid rgba(124,58,237,0.4)",
                  color: "var(--dd-text1)", fontSize: "0.9375rem", outline: "none",
                  resize: "vertical", lineHeight: 1.7, boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
            )}
            {err && <p style={{ color: "var(--dd-danger)", fontSize: "0.8rem", marginTop: "8px" }}>{err}</p>}
            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <button onClick={save} disabled={saving} style={{
                padding: "8px 18px", borderRadius: "9px",
                background: saving ? "rgba(124,58,237,0.35)" : "linear-gradient(135deg,#7c3aed 0%,#0d9488 100%)",
                border: "none", color: "#fff", fontSize: "0.875rem", fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
              }}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={cancel} disabled={saving} style={{
                padding: "8px 18px", borderRadius: "9px",
                background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)",
                color: "var(--dd-text2)", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
              }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ paddingTop: "14px" }}>
            {value.trim() ? (
              isEmail ? (
                <a href={`mailto:${value}`} style={{ color: "var(--dd-teal)", fontSize: "0.9375rem", textDecoration: "none" }}>
                  {value}
                </a>
              ) : (
                <p style={{ color: "var(--dd-text2)", fontSize: "0.9375rem", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                  {value}
                </p>
              )
            ) : (
              <p style={{ color: "var(--dd-text4)", fontSize: "0.875rem", fontStyle: "italic" }}>
                Not set. Click Edit to add content.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Social handle row ─────────────────────────────────────────────────── */
const PLATFORM_OPTIONS = [
  "Instagram", "Twitter / X", "LinkedIn", "YouTube", "Facebook",
  "WhatsApp", "Telegram", "GitHub", "Website",
];

function HandleRow({
  handle, onUpdate, onDelete,
}: {
  handle: SocialHandle;
  onUpdate: (id: number, platform: string, url: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [editing,  setEditing]  = useState(false);
  const [platform, setPlatform] = useState(handle.platform);
  const [url,      setUrl]      = useState(handle.url);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err,      setErr]      = useState<string | null>(null);

  async function save() {
    if (!platform.trim() || !url.trim()) { setErr("Both fields are required."); return; }
    setSaving(true); setErr(null);
    try { await onUpdate(handle.id, platform.trim(), url.trim()); setEditing(false); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "Failed."); }
    finally { setSaving(false); }
  }

  async function del() {
    if (!confirm(`Remove "${handle.platform}"?`)) return;
    setDeleting(true);
    try { await onDelete(handle.id); }
    catch { setDeleting(false); }
  }

  if (editing) {
    return (
      <div style={{ padding: "14px 18px", borderRadius: "12px", background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.2)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "10px", marginBottom: "10px" }}>
          <select id={`social-platform-${handle.id}`} name="platform" value={platform} onChange={(e) => setPlatform(e.target.value)}
            style={{ padding: "9px 12px", borderRadius: "8px", background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)", color: "var(--dd-text1)", fontSize: "0.875rem", outline: "none", cursor: "pointer" }}>
            {PLATFORM_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            <option value={platform}>{platform}</option>
          </select>
          <input id={`social-url-${handle.id}`} name="url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://"
            style={{ padding: "9px 12px", borderRadius: "8px", background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)", color: "var(--dd-text1)", fontSize: "0.875rem", outline: "none" }} />
        </div>
        {err && <p style={{ color: "var(--dd-danger)", fontSize: "0.78rem", marginBottom: "8px" }}>{err}</p>}
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={save} disabled={saving} style={{ padding: "6px 16px", borderRadius: "8px", background: "linear-gradient(135deg,#7c3aed,#0d9488)", border: "none", color: "#fff", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={() => { setEditing(false); setPlatform(handle.platform); setUrl(handle.url); setErr(null); }} style={{ padding: "6px 16px", borderRadius: "8px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text2)", fontSize: "0.8125rem", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 16px", borderRadius: "12px",
      background: "var(--dd-bg2)", border: "1px solid var(--dd-border)",
      opacity: deleting ? 0.4 : 1, transition: "opacity 0.2s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
        <span style={{ color: "var(--dd-text2)", flexShrink: 0 }}><SocialIcon platform={handle.platform} /></span>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontWeight: 500, color: "var(--dd-text1)", fontSize: "0.875rem" }}>{handle.platform}</p>
          <a href={handle.url} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: "0.78rem", color: "var(--dd-text3)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", maxWidth: "260px" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-teal)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)"; }}
          >
            {handle.url}
          </a>
        </div>
      </div>
      <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
        <button onClick={() => setEditing(true)} title="Edit"
          style={{ width: "30px", height: "30px", borderRadius: "8px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-teal-bg2)"; e.currentTarget.style.color = "var(--dd-teal)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text2)"; }}
        >
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13.586 3.586a2 2 0 112.828 2.828l-9 9L3 17l1.586-4.414 9-9z"/></svg>
        </button>
        <button onClick={del} disabled={deleting} title="Delete"
          style={{ width: "30px", height: "30px", borderRadius: "8px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", color: "var(--dd-danger)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(185,28,28,0.16)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-danger-bg)"; }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,4 14,4"/><path d="M5 4V2h6v2"/><path d="M3 4l1 10h8l1-10"/></svg>
        </button>
      </div>
    </div>
  );
}

/* ── Add handle form ───────────────────────────────────────────────────── */
function AddHandleForm({ onAdd }: { onAdd: (platform: string, url: string) => Promise<void> }) {
  const [platform, setPlatform] = useState("Instagram");
  const [url,      setUrl]      = useState("");
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState<string | null>(null);

  async function submit() {
    if (!url.trim()) { setErr("URL is required."); return; }
    setSaving(true); setErr(null);
    try { await onAdd(platform, url.trim()); setUrl(""); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "Failed."); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ padding: "16px 18px", borderRadius: "12px", background: "var(--dd-success-bg)", border: "1px solid var(--dd-success-border)" }}>
      <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--dd-success)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "12px" }}>
        New Handle
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "10px", marginBottom: err ? "8px" : "12px" }}>
        <select id="new-social-platform" name="platform" value={platform} onChange={(e) => setPlatform(e.target.value)}
          style={{ padding: "9px 12px", borderRadius: "8px", background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)", color: "var(--dd-text1)", fontSize: "0.875rem", outline: "none", cursor: "pointer" }}>
          {PLATFORM_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input id="new-social-url" name="url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://instagram.com/darkdoctor"
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          style={{ padding: "9px 12px", borderRadius: "8px", background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)", color: "var(--dd-text1)", fontSize: "0.875rem", outline: "none" }} />
      </div>
      {err && <p style={{ color: "var(--dd-danger)", fontSize: "0.78rem", marginBottom: "8px" }}>{err}</p>}
      <button onClick={submit} disabled={saving} style={{
        padding: "7px 20px", borderRadius: "9px",
        background: saving ? "rgba(21,128,61,0.3)" : "var(--dd-success-bg)",
        border: "1px solid var(--dd-success-border)",
        color: "var(--dd-success)", fontSize: "0.875rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
      }}>
        {saving ? "Adding…" : "Add Handle"}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ PAGE ══ */
export default function SuperAdminAboutPage() {
  const router = useRouter();

  const [userEmail, setUserEmail] = useState<string>("");
  const [about,     setAbout]     = useState<AboutUs>({ mission: "", vision: "", about: "", contact_email: "", updated_at: "" });
  const [handles,   setHandles]   = useState<SocialHandle[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [showAdd,   setShowAdd]   = useState(false);

  useEffect(() => {
    const u = getUser<{ email: string; role: string }>();
    if (!u || u.role !== "super_admin") { router.replace("/superadmin"); return; }
    setUserEmail(u.email);

    aboutApi.get()
      .then((d) => { setAbout(d.about); setHandles(d.social_handles); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    try { await authApi.logout(getRefreshToken()!, getAccessToken()!); } catch {}
    finally { clearSession(); router.replace("/superadmin"); }
  }

  async function saveField(field: AboutField, value: string) {
    const updated = await aboutApi.updateAbout({ [field]: value });
    setAbout((prev) => ({ ...prev, ...updated }));
  }

  async function addHandle(platform: string, url: string) {
    const newHandle = await aboutApi.addSocial({ platform, url, display_order: handles.length });
    setHandles((prev) => [...prev, newHandle]);
    setShowAdd(false);
  }

  async function updateHandle(id: number, platform: string, url: string) {
    const updated = await aboutApi.updateSocial(id, { platform, url });
    setHandles((prev) => prev.map((h) => (h.id === id ? updated : h)));
  }

  async function deleteHandle(id: number) {
    await aboutApi.deleteSocial(id);
    setHandles((prev) => prev.filter((h) => h.id !== id));
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--dd-bg)", color: "var(--dd-text1)" }}>

      {/* ── Navbar ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 30,
        background: "var(--dd-nav-bg)",
        backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid var(--dd-border)",
        padding: "0 16px", height: "60px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, overflow: "hidden" }}>
          <button onClick={() => router.push("/about")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Darkdoctor" draggable={false} style={{ height: "28px", width: "auto", objectFit: "contain" }} />
          </button>
          <span style={{ color: "var(--dd-border2)" }}>/</span>
          <button onClick={() => router.push("/superadmin/home")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dd-text2)", fontSize: "0.9375rem", fontWeight: 500, padding: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-text1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text2)"; }}
          >Dashboard</button>
          <span style={{ color: "var(--dd-border2)" }}>/</span>
          <span style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--dd-text1)" }}>About Us</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <span className="dd-admin-nav-email" style={{ fontSize: "0.8125rem", color: "var(--dd-text3)" }}>{userEmail}</span>
          <button onClick={handleLogout} style={{ padding: "7px 14px", borderRadius: "8px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text2)", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", flexShrink: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-border2)"; e.currentTarget.style.color = "var(--dd-text1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text2)"; }}
          >Sign Out</button>
        </div>
      </nav>

      <main style={{ maxWidth: "780px", margin: "0 auto", padding: "40px 20px 80px" }}>

        {/* Page header */}
        <div style={{ marginBottom: "32px" }}>
          <button onClick={() => router.push("/superadmin/home")} style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "none", border: "none", cursor: "pointer", color: "var(--dd-text3)", fontSize: "0.8125rem", fontWeight: 500, padding: 0, marginBottom: "14px" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-text2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)"; }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 12L6 8l4-4"/></svg>
            Back to Dashboard
          </button>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.6rem,4vw,2rem)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "6px", color: "var(--dd-text1)" }}>
            About Us
          </h1>
          <p style={{ fontSize: "0.9rem", color: "var(--dd-text3)" }}>
            Manage your platform&apos;s public-facing about page. Changes are live immediately.
          </p>
        </div>

        {loading && <div style={{ padding: "60px", textAlign: "center", color: "var(--dd-text3)" }}>Loading…</div>}
        {!loading && error && <div style={{ padding: "40px", textAlign: "center", color: "var(--dd-danger)" }}>{error}</div>}

        {!loading && !error && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* ── Content sections ── */}
            <EditableSection label="Our Mission"   field="mission"       value={about.mission}       onSave={saveField} />
            <EditableSection label="Our Vision"    field="vision"        value={about.vision}        onSave={saveField} />
            <EditableSection label="About Us"      field="about"         value={about.about}         onSave={saveField} />
            <EditableSection label="Contact Email" field="contact_email" value={about.contact_email} onSave={saveField} />

            {/* ── Social handles ── */}
            <div style={{ borderRadius: "16px", border: "1px solid var(--dd-border)", background: "var(--dd-surface)", overflow: "hidden" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--dd-border)" }}>
                <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Social Media Handles
                </p>
                <button
                  onClick={() => setShowAdd((v) => !v)}
                  style={{
                    display: "flex", alignItems: "center", gap: "5px",
                    background: showAdd ? "var(--dd-success-bg)" : "none",
                    border: "1px solid var(--dd-success-border)",
                    borderRadius: "8px", padding: "5px 12px", cursor: "pointer",
                    color: "var(--dd-success)", fontSize: "0.78rem", fontWeight: 500, transition: "all 0.15s",
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    {showAdd
                      ? <><line x1="2" y1="6" x2="10" y2="6"/></>
                      : <><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></>
                    }
                  </svg>
                  {showAdd ? "Cancel" : "Add Handle"}
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {showAdd && (
                  <AddHandleForm onAdd={addHandle} />
                )}

                {handles.length === 0 && !showAdd && (
                  <p style={{ color: "var(--dd-text4)", fontSize: "0.875rem", fontStyle: "italic", padding: "8px 0" }}>
                    No social handles yet. Click &ldquo;Add Handle&rdquo; to add one.
                  </p>
                )}

                {handles.map((h) => (
                  <HandleRow
                    key={h.id} handle={h}
                    onUpdate={updateHandle}
                    onDelete={deleteHandle}
                  />
                ))}
              </div>
            </div>

            {/* Preview link */}
            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "4px" }}>
              <button
                onClick={() => window.open("/about", "_blank")}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--dd-text3)", fontSize: "0.8125rem", fontWeight: 500,
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-teal)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)"; }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1V9"/>
                  <polyline points="10 1 15 1 15 6"/><line x1="15" y1="1" x2="7" y2="9"/>
                </svg>
                Preview public page
              </button>
            </div>
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
