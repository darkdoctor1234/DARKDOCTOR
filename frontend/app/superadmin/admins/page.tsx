"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { superAdminApi, AdminUser } from "@/lib/adminApi";
import { getUser, clearSession, getRefreshToken, getAccessToken } from "@/lib/auth";
import { authApi } from "@/lib/api";
import CreateAdminModal from "@/components/superadmin/CreateAdminModal";
import EditAdminModal from "@/components/superadmin/EditAdminModal";
import DeleteAdminModal from "@/components/superadmin/DeleteAdminModal";

/* ──────────────────────────────────────── helpers ── */
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ────────────────────────────────────── sub-components ── */
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

function RoleBadge({ role }: { role: string }) {
  const isSuper = role === "super_admin";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "3px 9px", borderRadius: "20px",
      background: isSuper ? "var(--dd-teal-bg2)" : "var(--dd-surface2)",
      border: `1px solid ${isSuper ? "var(--dd-teal-border)" : "var(--dd-border2)"}`,
      color: isSuper ? "var(--dd-teal)" : "var(--dd-text3)",
      fontSize: "0.72rem", fontWeight: 500, letterSpacing: "0.01em", whiteSpace: "nowrap",
    }}>
      {isSuper ? "Super Admin" : "Admin"}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "3px 9px", borderRadius: "20px",
      background: active ? "var(--dd-success-bg)" : "var(--dd-warning-bg)",
      border: `1px solid ${active ? "var(--dd-success-border)" : "var(--dd-warning-border)"}`,
      color: active ? "var(--dd-success)" : "var(--dd-warning)",
      fontSize: "0.72rem", fontWeight: 500, letterSpacing: "0.01em", whiteSpace: "nowrap",
    }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "currentColor" }} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

type Variant = "default" | "danger" | "success" | "warning";
const ICON_COLORS: Record<Variant, { bg: string; hoverBg: string; border: string; color: string }> = {
  default: { bg: "var(--dd-surface2)",  hoverBg: "var(--dd-border2)",         border: "var(--dd-border2)",         color: "var(--dd-text2)" },
  danger:  { bg: "var(--dd-danger-bg)", hoverBg: "rgba(185,28,28,0.16)",      border: "var(--dd-danger-border)",   color: "var(--dd-danger)" },
  success: { bg: "var(--dd-success-bg)", hoverBg: "rgba(21,128,61,0.16)",     border: "var(--dd-success-border)",  color: "var(--dd-success)" },
  warning: { bg: "var(--dd-warning-bg)", hoverBg: "rgba(180,83,9,0.16)",      border: "var(--dd-warning-border)",  color: "var(--dd-warning)" },
};

function IconBtn({ onClick, title, disabled = false, children, variant = "default" }: {
  onClick: () => void; title: string; disabled?: boolean;
  children: React.ReactNode; variant?: Variant;
}) {
  const c = ICON_COLORS[variant];
  return (
    <button onClick={onClick} disabled={disabled} title={title} aria-label={title} style={{
      padding: "6px 7px", borderRadius: "8px",
      background: c.bg, border: `1px solid ${c.border}`,
      color: c.color, cursor: disabled ? "wait" : "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "background 0.15s", opacity: disabled ? 0.45 : 1, flexShrink: 0,
    }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = c.hoverBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = c.bg; }}
    >{children}</button>
  );
}

const EditIcon   = () => <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13.586 3.586a2 2 0 112.828 2.828l-9 9L3 17l1.586-4.414 9-9z"/></svg>;
const TrashIcon  = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,4 14,4"/><path d="M5 4V2h6v2"/><path d="M3 4l1 10h8l1-10"/></svg>;
const ActiveIcon = () => <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M20 12v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h9"/></svg>;
const InactiveIcon = () => <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="8"/><line x1="6" y1="10" x2="14" y2="10"/></svg>;
const LockIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>;

/* ════════════════════════════════════════════ PAGE ══ */
export default function AdminManagementPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser]   = useState<{ email: string; full_name: string } | null>(null);
  const [admins, setAdmins]             = useState<AdminUser[]>([]);
  const [loading, setLoading]           = useState(true);
  const [fetchError, setFetchError]     = useState<string | null>(null);
  const [searchQuery, setSearchQuery]   = useState("");
  const [createOpen, setCreateOpen]     = useState(false);
  const [editTarget, setEditTarget]     = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [togglingId, setTogglingId]     = useState<number | null>(null);

  useEffect(() => { setCurrentUser(getUser<{ email: string; full_name: string }>()); }, []);

  const loadAdmins = useCallback(async () => {
    setLoading(true); setFetchError(null);
    try { setAdmins(await superAdminApi.listAdmins()); }
    catch (err: unknown) { setFetchError(err instanceof Error ? err.message : "Failed to load admins."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAdmins(); }, [loadAdmins]);

  async function handleLogout() {
    try { await authApi.logout(getRefreshToken()!, getAccessToken()!); } catch {}
    finally { clearSession(); router.replace("/superadmin"); }
  }

  async function handleToggle(admin: AdminUser) {
    setTogglingId(admin.id);
    try {
      const updated = await superAdminApi.toggleActive(admin.id);
      setAdmins((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch {}
    finally { setTogglingId(null); }
  }

  const filtered = admins.filter(
    (a) => a.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
           a.full_name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  /* ── render ── */
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
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, overflow: "hidden" }}>
          <button onClick={() => router.push("/about")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Darkdoctor" draggable={false}
              style={{ height: "28px", width: "auto", objectFit: "contain" }} />
          </button>
          <span style={{ color: "var(--dd-border2)" }}>/</span>
          <button onClick={() => router.push("/superadmin/home")} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--dd-text2)", fontSize: "0.9375rem", fontWeight: 500, padding: 0,
          }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-text1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text2)"; }}
          >Dashboard</button>
          <span style={{ color: "var(--dd-border2)" }}>/</span>
          <span style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--dd-text1)" }}>Admin Management</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <span className="dd-admin-nav-email" style={{ fontSize: "0.8125rem", color: "var(--dd-text3)" }}>
            {currentUser?.email}
          </span>
          <button onClick={handleLogout} style={{
            padding: "7px 14px", borderRadius: "8px",
            background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)",
            color: "var(--dd-text2)", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", flexShrink: 0,
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-border2)"; e.currentTarget.style.color = "var(--dd-text1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text2)"; }}
          >Sign Out</button>
        </div>
      </nav>

      {/* ── Main ── */}
      <main style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px 20px 64px" }}>

        {/* Page header */}
        <div style={{ marginBottom: "28px" }}>
          <button onClick={() => router.push("/superadmin/home")} style={{
            display: "inline-flex", alignItems: "center", gap: "5px",
            background: "none", border: "none", cursor: "pointer",
            color: "var(--dd-text3)", fontSize: "0.8125rem", fontWeight: 500, padding: 0, marginBottom: "16px",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-text2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)"; }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 12L6 8l4-4"/></svg>
            Back to Dashboard
          </button>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.6rem,4vw,2rem)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "6px", color: "var(--dd-text1)" }}>
            Admin Management
          </h1>
          <p style={{ fontSize: "0.9rem", color: "var(--dd-text3)" }}>
            Create and manage admin accounts for the Darkdoctor platform.
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: "12px", marginBottom: "24px" }}>
          {[
            { label: "Total Accounts", value: admins.length,                                                  color: "#7c3aed" },
            { label: "Super Admins",   value: admins.filter((a) => a.role === "super_admin").length,           color: "var(--dd-teal)" },
            { label: "Active",         value: admins.filter((a) => a.is_active).length,                        color: "var(--dd-success)" },
            { label: "Inactive",       value: admins.filter((a) => !a.is_active).length,                       color: "var(--dd-warning)" },
          ].map((s) => (
            <div key={s.label} style={{
              padding: "16px 18px", borderRadius: "14px",
              background: "var(--dd-bg2)", border: "1px solid var(--dd-border)",
            }}>
              <div className="num" style={{ fontSize: "1.5rem", fontWeight: 700, color: s.color, letterSpacing: "-0.03em" }}>
                {loading ? "-" : s.value}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--dd-text3)", marginTop: "2px" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
          <div style={{ flex: 1, minWidth: "200px", position: "relative" }}>
            <svg style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--dd-text3)", pointerEvents: "none" }}
              width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="9" cy="9" r="6"/><line x1="14" y1="14" x2="18" y2="18"/>
            </svg>
            <input id="admins-search" name="search" type="search" placeholder="Search by name or email…"
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px 10px 36px", borderRadius: "10px",
                background: "var(--dd-input-bg)", border: "1px solid var(--dd-border2)",
                color: "var(--dd-text1)", fontSize: "0.875rem", outline: "none",
              }}
            />
          </div>
          <button onClick={() => setCreateOpen(true)} style={{
            display: "flex", alignItems: "center", gap: "7px",
            padding: "10px 18px", borderRadius: "10px",
            background: "linear-gradient(135deg,#7c3aed 0%,#0d9488 100%)",
            border: "none", color: "white", fontSize: "0.9rem", fontWeight: 600,
            cursor: "pointer", boxShadow: "0 4px 20px rgba(124,58,237,0.3)", whiteSpace: "nowrap",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="7" y1="1" x2="7" y2="13"/><line x1="1" y1="7" x2="13" y2="7"/>
            </svg>
            Add Admin
          </button>
        </div>

        {/* Table */}
        <div style={{
          borderRadius: "16px", border: "1px solid var(--dd-border)",
          overflow: "hidden", background: "var(--dd-surface)",
        }}>
          {loading && (
            <div style={{ padding: "52px", textAlign: "center", color: "var(--dd-text3)", fontSize: "0.9rem" }}>
              Loading admins…
            </div>
          )}
          {!loading && fetchError && (
            <div style={{ padding: "36px", textAlign: "center" }}>
              <p style={{ color: "var(--dd-danger)", fontSize: "0.9rem", marginBottom: "12px" }}>{fetchError}</p>
              <button onClick={loadAdmins} style={{
                padding: "8px 16px", borderRadius: "8px",
                background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)",
                color: "var(--dd-text2)", fontSize: "0.875rem", cursor: "pointer",
              }}>Retry</button>
            </div>
          )}
          {!loading && !fetchError && filtered.length === 0 && (
            <div style={{ padding: "60px 32px", textAlign: "center" }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "14px",
                background: "var(--dd-surface2)", border: "1px solid var(--dd-border)",
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px",
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--dd-text3)" }} strokeWidth="1.6" strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <p style={{ color: "var(--dd-text3)", fontSize: "0.9rem" }}>
                {searchQuery ? "No admins match your search." : "No admins yet. Create your first admin."}
              </p>
            </div>
          )}

          {!loading && !fetchError && filtered.length > 0 && (
            <>
              {/* Desktop header */}
              <div className="hidden md:grid" style={{
                gridTemplateColumns: "1.2fr 1.5fr 110px 100px 120px 130px",
                padding: "11px 20px",
                borderBottom: "1px solid var(--dd-border)",
                background: "var(--dd-surface2)",
              }}>
                {["Admin", "Email", "Role", "Status", "Created", "Actions"].map((h) => (
                  <span key={h} style={{ fontSize: "0.72rem", color: "var(--dd-text3)", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    {h}
                  </span>
                ))}
              </div>

              {filtered.map((admin, idx) => (
                <div key={admin.id}>
                  {idx > 0 && <div style={{ height: "1px", background: "var(--dd-border)", margin: "0 20px" }} />}

                  {/* Desktop row */}
                  <div className="hidden md:grid" style={{
                    gridTemplateColumns: "1.2fr 1.5fr 110px 100px 120px 130px",
                    padding: "13px 20px", alignItems: "center", transition: "background 0.12s",
                  }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--dd-surface2)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <Avatar name={admin.full_name} email={admin.email} />
                      <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--dd-text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {admin.full_name || "-"}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.875rem", color: "var(--dd-text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: "8px" }}>
                      {admin.email}
                    </span>
                    <RoleBadge role={admin.role} />
                    <StatusBadge active={admin.is_active} />
                    <span style={{ fontSize: "0.8125rem", color: "var(--dd-text3)" }}>{formatDate(admin.created_at)}</span>
                    {admin.role === "super_admin" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--dd-text4)" }} title="Super admin accounts are managed on the server, not from this screen">
                        <LockIcon />
                        <span style={{ fontSize: "0.75rem" }}>Managed via server</span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <IconBtn onClick={() => setEditTarget(admin)} title="Edit admin" variant="default"><EditIcon /></IconBtn>
                        <IconBtn onClick={() => handleToggle(admin)} disabled={togglingId === admin.id}
                          title={admin.is_active ? "Deactivate admin" : "Activate admin"}
                          variant={admin.is_active ? "warning" : "success"}>
                          {admin.is_active ? <InactiveIcon /> : <ActiveIcon />}
                        </IconBtn>
                        <IconBtn onClick={() => setDeleteTarget(admin)} title="Delete admin" variant="danger"><TrashIcon /></IconBtn>
                      </div>
                    )}
                  </div>

                  {/* Mobile card */}
                  <div className="flex flex-col md:hidden" style={{ padding: "16px 18px", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                        <Avatar name={admin.full_name} email={admin.email} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--dd-text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {admin.full_name || "-"}
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "var(--dd-text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {admin.email}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                        {admin.role === "super_admin" ? (
                          <span style={{ color: "var(--dd-text4)", display: "flex", alignItems: "center" }} title="Super admin accounts are managed on the server, not from this screen"><LockIcon /></span>
                        ) : (
                          <>
                            <IconBtn onClick={() => setEditTarget(admin)} title="Edit" variant="default"><EditIcon /></IconBtn>
                            <IconBtn onClick={() => handleToggle(admin)} disabled={togglingId === admin.id}
                              title={admin.is_active ? "Deactivate" : "Activate"}
                              variant={admin.is_active ? "warning" : "success"}>
                              {admin.is_active ? <InactiveIcon /> : <ActiveIcon />}
                            </IconBtn>
                            <IconBtn onClick={() => setDeleteTarget(admin)} title="Delete" variant="danger"><TrashIcon /></IconBtn>
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <RoleBadge role={admin.role} />
                        <StatusBadge active={admin.is_active} />
                      </div>
                      <span style={{ fontSize: "0.8rem", color: "var(--dd-text3)" }}>{formatDate(admin.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <p style={{ marginTop: "12px", fontSize: "0.8125rem", color: "var(--dd-text3)" }}>
            Showing {filtered.length} of {admins.length} admin{admins.length !== 1 ? "s" : ""}
          </p>
        )}
      </main>

      {/* ── Modals ── */}
      <CreateAdminModal open={createOpen} onClose={() => setCreateOpen(false)}
        onCreated={(admin) => setAdmins((prev) => [admin, ...prev])} />
      <EditAdminModal admin={editTarget} onClose={() => setEditTarget(null)}
        onUpdated={(updated) => setAdmins((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))} />
      <DeleteAdminModal admin={deleteTarget} onClose={() => setDeleteTarget(null)}
        onDeleted={(id) => setAdmins((prev) => prev.filter((a) => a.id !== id))} />

      <style>{`
        @media (max-width: 560px) {
          .dd-admin-nav-email { display: none; }
        }
      `}</style>
    </div>
  );
}
