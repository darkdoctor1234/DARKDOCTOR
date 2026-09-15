"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { notificationsApi, type Notification } from "@/lib/notificationsApi";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function NotificationBell() {
  const router = useRouter();
  const [mounted, setMounted]         = useState(false);
  const [open, setOpen]               = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems]             = useState<Notification[]>([]);
  const [loading, setLoading]         = useState(false);
  const [loaded, setLoaded]           = useState(false);

  // Escapes the top nav's backdropFilter containing-block for position:fixed
  // descendants — same reason CreateMenu portals its overlay to document.body.
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    notificationsApi.list().then((d) => setUnreadCount(d.unread_count)).catch(() => {});
  }, [mounted]);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      setLoading(true);
      try {
        const d = await notificationsApi.list();
        setItems(d.results);
        setUnreadCount(d.unread_count);
        setLoaded(true);
      } catch {
        // best-effort — panel just shows the empty state on failure
      } finally {
        setLoading(false);
      }
    }
  }

  function handleItemClick(n: Notification) {
    setOpen(false);
    if (!n.is_read) {
      setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, is_read: true } : it)));
      setUnreadCount((c) => Math.max(c - 1, 0));
      notificationsApi.markRead(n.id).catch(() => {});
    }
    if (n.url) router.push(n.url);
  }

  function handleMarkAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    notificationsApi.markAllRead().catch(() => {});
  }

  const hasUnread = items.some((n) => !n.is_read);

  return (
    <div className="dd-nav-notif" style={{ display: "flex", alignItems: "center", flexShrink: 0, marginLeft: "8px" }}>
      <button
        title="Notifications"
        onClick={toggleOpen}
        style={{
          position: "relative", width: "32px", height: "32px", borderRadius: "8px",
          background: open ? "var(--dd-surface2)" : "none", border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: open ? "var(--dd-text1)" : "var(--dd-text2)", cursor: "pointer",
          transition: "color 0.15s, background 0.15s",
        }}
        onMouseEnter={(e) => { if (!open) { e.currentTarget.style.color = "var(--dd-text1)"; e.currentTarget.style.background = "var(--dd-surface2)"; } }}
        onMouseLeave={(e) => { if (!open) { e.currentTarget.style.color = "var(--dd-text2)"; e.currentTarget.style.background = "none"; } }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 3v6a4 4 0 008 0V3" />
          <path d="M11 13v2a5 5 0 0010 0v-2.5" />
          <circle cx="21" cy="10.5" r="1.6" />
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: "1px", right: "1px", minWidth: "15px", height: "15px", padding: "0 3px",
            borderRadius: "999px", background: "var(--dd-danger)", color: "#fff",
            fontSize: "0.625rem", fontWeight: 700, lineHeight: 1,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1.5px solid var(--dd-bg2)",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {mounted && open && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 250 }} />
          <div style={{
            position: "fixed", top: "58px", right: "16px", zIndex: 251,
            width: "380px", maxWidth: "calc(100vw - 24px)", maxHeight: "min(70vh, 520px)",
            display: "flex", flexDirection: "column", overflow: "hidden",
            background: "var(--dd-bg2)", border: "1px solid var(--dd-border)",
            borderRadius: "16px", boxShadow: "var(--dd-shadow-lg)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--dd-border)", flexShrink: 0 }}>
              <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--dd-text1)" }}>Notifications</span>
              {hasUnread && (
                <button onClick={handleMarkAllRead} style={{ background: "none", border: "none", color: "var(--dd-teal)", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", padding: 0 }}>
                  Mark all read
                </button>
              )}
            </div>

            <div style={{ overflowY: "auto" }}>
              {loading ? (
                <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--dd-text3)", fontSize: "0.8125rem" }}>Loading…</div>
              ) : items.length === 0 ? (
                <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--dd-text3)", fontSize: "0.8125rem" }}>No notifications yet.</div>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "12px 16px", background: n.is_read ? "none" : "var(--dd-teal-bg)",
                      border: "none", borderBottom: "1px solid var(--dd-border)", cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                      {!n.is_read && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--dd-teal)", flexShrink: 0, marginTop: "6px" }} />}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "0.8125rem", color: "var(--dd-text1)", lineHeight: 1.4 }}>{n.message}</div>
                        <div style={{ fontSize: "0.6875rem", color: "var(--dd-text3)", marginTop: "4px" }}>{timeAgo(n.created_at)}</div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
