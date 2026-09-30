"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getUser, clearSession, getRefreshToken, getAccessToken, isAuthenticated } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { usersApi, PlatformUser } from "@/lib/adminApi";
import BlockUserModal, { BlockTarget } from "@/components/superadmin/BlockUserModal";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Avatar({ name, email }: { name: string; email: string }) {
  const initials = name
    ? name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : email[0].toUpperCase();
  const hue = (email.charCodeAt(0) * 37 + (email.charCodeAt(1) ?? 0) * 17) % 360;
  return (
    <div style={{
      width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0,
      background: `hsl(${hue},60%,92%)`, border: `1px solid hsl(${hue},50%,78%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "0.75rem", fontWeight: 600, color: `hsl(${hue},55%,34%)`, letterSpacing: "0.02em",
    }}>
      {initials}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "3px 9px", borderRadius: "20px",
      background: active ? "var(--dd-success-bg)" : "var(--dd-danger-bg)",
      border: `1px solid ${active ? "var(--dd-success-border)" : "var(--dd-danger-border)"}`,
      color: active ? "var(--dd-success)" : "var(--dd-danger)",
      fontSize: "0.72rem", fontWeight: 500, letterSpacing: "0.01em", whiteSpace: "nowrap",
    }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "currentColor" }} />
      {active ? "Active" : "Blocked"}
    </span>
  );
}

export default function UserManagementPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ email: string; full_name: string } | null>(null);
  const [users, setUsers]             = useState<PlatformUser[]>([]);
  const [loading, setLoading]         = useState(true);
  const [fetchError, setFetchError]   = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [blockTarget, setBlockTarget] = useState<BlockTarget | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace("/superadmin"); return; }
    const u = getUser<{ email: string; full_name: string; role: string }>();
    if (u?.role !== "super_admin") { router.replace("/superadmin"); return; }
    setCurrentUser(u);
  }, [router]);

  const loadUsers = useCallback(async (q?: string) => {
    setLoading(true); setFetchError(null);
    try { setUsers(await usersApi.list(q)); }
    catch (err: unknown) { setFetchError(err instanceof Error ? err.message : "Failed to load users."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  useEffect(() => {
    const handle = setTimeout(() => loadUsers(searchQuery || undefined), 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  async function handleLogout() {
    try { await authApi.logout(getRefreshToken()!, getAccessToken()!); } catch {}
    finally { clearSession(); router.replace("/superadmin"); }
  }

  function handleBlockDone(id: number, is_active: boolean, blocked_reason: string) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, is_active, blocked_reason } : u)));
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--dd-bg)", color: "var(--dd-text1)" }}>

      <nav style={{
        position: "sticky", top: 0, zIndex: 30,
        background: "var(--dd-nav-bg)", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid var(--dd-border)", padding: "0 16px", height: "60px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, overflow: "hidden" }}>
          <button onClick={() => router.push("/superadmin/home")} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--dd-text2)", fontSize: "0.9375rem", fontWeight: 500, padding: 0,
          }}>Dashboard</button>
          <span style={{ color: "var(--dd-border2)" }}>/</span>
          <span style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--dd-text1)" }}>User Management</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <span className="dd-admin-nav-email" style={{ fontSize: "0.8125rem", color: "var(--dd-text3)" }}>{currentUser?.email}</span>
          <button onClick={handleLogout} style={{
            padding: "7px 14px", borderRadius: "8px",
            background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)",
            color: "var(--dd-text2)", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", flexShrink: 0,
          }}>Sign Out</button>
        </div>
      </nav>

      <main style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px 20px 64px" }}>
        <div style={{ marginBottom: "28px" }}>
          <button onClick={() => router.push("/superadmin/home")} style={{
            display: "inline-flex", alignItems: "center", gap: "5px",
            background: "none", border: "none", cursor: "pointer",
            color: "var(--dd-text3)", fontSize: "0.8125rem", fontWeight: 500, padding: 0, marginBottom: "16px",
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 12L6 8l4-4"/></svg>
            Back to Dashboard
          </button>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.6rem,4vw,2rem)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "6px", color: "var(--dd-text1)" }}>
            User Management
          </h1>
          <p style={{ fontSize: "0.9rem", color: "var(--dd-text3)" }}>
            Search any user on the platform and block or unblock their account. Blocking logs them out immediately.
          </p>
        </div>

        <div style={{ marginBottom: "16px", position: "relative" }}>
          <svg style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--dd-text3)", pointerEvents: "none" }}
            width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="9" cy="9" r="6"/><line x1="14" y1="14" x2="18" y2="18"/>
          </svg>
          <input id="users-search" name="search" type="search" placeholder="Search by name, username, or email…"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%", padding: "10px 14px 10px 36px", borderRadius: "10px",
              background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)",
              color: "var(--dd-text1)", fontSize: "0.875rem", outline: "none",
            }}
          />
        </div>

        <div style={{ borderRadius: "16px", border: "1px solid var(--dd-border)", overflow: "hidden", background: "var(--dd-surface)" }}>
          {loading && (
            <div style={{ padding: "52px", textAlign: "center", color: "var(--dd-text3)", fontSize: "0.9rem" }}>Loading users…</div>
          )}
          {!loading && fetchError && (
            <div style={{ padding: "36px", textAlign: "center" }}>
              <p style={{ color: "var(--dd-danger)", fontSize: "0.9rem", marginBottom: "12px" }}>{fetchError}</p>
              <button onClick={() => loadUsers(searchQuery || undefined)} style={{
                padding: "8px 16px", borderRadius: "8px",
                background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)",
                color: "var(--dd-text2)", fontSize: "0.875rem", cursor: "pointer",
              }}>Retry</button>
            </div>
          )}
          {!loading && !fetchError && users.length === 0 && (
            <div style={{ padding: "60px 32px", textAlign: "center" }}>
              <p style={{ color: "var(--dd-text3)", fontSize: "0.9rem" }}>
                {searchQuery ? "No users match your search." : "No users yet."}
              </p>
            </div>
          )}

          {!loading && !fetchError && users.length > 0 && (
            <>
              <div className="hidden md:grid" style={{
                gridTemplateColumns: "1.2fr 1.5fr 1.3fr 100px 120px 90px",
                padding: "11px 20px", borderBottom: "1px solid var(--dd-border)", background: "var(--dd-surface2)",
              }}>
                {["User", "Email", "College", "Status", "Joined", "Action"].map((h) => (
                  <span key={h} style={{ fontSize: "0.72rem", color: "var(--dd-text3)", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</span>
                ))}
              </div>

              {users.map((u, idx) => {
                const label = u.username || u.full_name || u.email;
                const college = u.pg_college_name || u.ug_college_name || "-";
                return (
                  <div key={u.id}>
                    {idx > 0 && <div style={{ height: "1px", background: "var(--dd-border)", margin: "0 20px" }} />}
                    <div className="hidden md:grid" style={{ gridTemplateColumns: "1.2fr 1.5fr 1.3fr 100px 120px 90px", padding: "13px 20px", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                        <Avatar name={u.full_name} email={u.email} />
                        <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--dd-text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {u.username || u.full_name || "-"}
                        </span>
                      </div>
                      <span style={{ fontSize: "0.875rem", color: "var(--dd-text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: "8px" }}>{u.email}</span>
                      <span style={{ fontSize: "0.8125rem", color: "var(--dd-text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: "8px" }}>{college}</span>
                      <StatusBadge active={u.is_active} />
                      <span style={{ fontSize: "0.8125rem", color: "var(--dd-text3)" }}>{formatDate(u.created_at)}</span>
                      <button
                        onClick={() => setBlockTarget({ id: u.id, label, is_active: u.is_active })}
                        style={{
                          padding: "6px 12px", borderRadius: "8px", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
                          background: u.is_active ? "var(--dd-danger-bg)" : "var(--dd-success-bg)",
                          border: `1px solid ${u.is_active ? "var(--dd-danger-border)" : "var(--dd-success-border)"}`,
                          color: u.is_active ? "var(--dd-danger)" : "var(--dd-success)",
                        }}
                      >{u.is_active ? "Block" : "Unblock"}</button>
                    </div>

                    <div className="flex flex-col md:hidden" style={{ padding: "16px 18px", gap: "10px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                          <Avatar name={u.full_name} email={u.email} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--dd-text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.username || u.full_name || "-"}</div>
                            <div style={{ fontSize: "0.8rem", color: "var(--dd-text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => setBlockTarget({ id: u.id, label, is_active: u.is_active })}
                          style={{
                            padding: "6px 12px", borderRadius: "8px", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", flexShrink: 0,
                            background: u.is_active ? "var(--dd-danger-bg)" : "var(--dd-success-bg)",
                            border: `1px solid ${u.is_active ? "var(--dd-danger-border)" : "var(--dd-success-border)"}`,
                            color: u.is_active ? "var(--dd-danger)" : "var(--dd-success)",
                          }}
                        >{u.is_active ? "Block" : "Unblock"}</button>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <StatusBadge active={u.is_active} />
                          <span style={{ fontSize: "0.8rem", color: "var(--dd-text3)" }}>{college}</span>
                        </div>
                        <span style={{ fontSize: "0.8rem", color: "var(--dd-text3)" }}>{formatDate(u.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </main>

      <BlockUserModal target={blockTarget} onClose={() => setBlockTarget(null)} onDone={handleBlockDone} />

      <style>{`
        @media (max-width: 560px) {
          .dd-admin-nav-email { display: none; }
        }
      `}</style>
    </div>
  );
}
