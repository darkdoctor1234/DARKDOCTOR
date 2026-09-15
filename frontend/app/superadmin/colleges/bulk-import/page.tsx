"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { collegeApi, BulkImportResult, BulkFailure } from "@/lib/collegeApi";

/* ── helpers ── */
function exportFailuresCSV(failures: BulkFailure[]) {
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const header = "Row,Name,Location,Errors";
  const rows   = failures.map((f) =>
    [f.row, escape(f.name), escape(f.location), escape(f.errors.join(" | "))].join(","),
  );
  const csv  = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `failed_colleges_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── stat card ── */
function StatCard({ value, label, color, bg, border }: {
  value: number; label: string; color: string; bg: string; border: string;
}) {
  return (
    <div style={{
      flex: 1, minWidth: "140px",
      padding: "20px 22px", borderRadius: "16px",
      background: bg, border: `1px solid ${border}`,
      textAlign: "center",
    }}>
      <div className="num" style={{ fontSize: "2rem", fontWeight: 700, color, letterSpacing: "-0.03em", lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: "0.78rem", color: "var(--dd-text3)", marginTop: "6px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
    </div>
  );
}

type Stage = "idle" | "uploading" | "done" | "error";

/* ══════════════════════════════════════════════════ PAGE ══ */
export default function BulkImportPage() {
  const router = useRouter();

  const [stage, setStage]           = useState<Stage>("idle");
  const [dragging, setDragging]     = useState(false);
  const [selectedFile, setSelected] = useState<File | null>(null);
  const [result, setResult]         = useState<BulkImportResult | null>(null);
  const [errorMsg, setErrorMsg]     = useState("");
  const [downloading, setDL]        = useState(false);
  const [templateError, setTplErr]  = useState("");
  const [expandedRow, setExpanded]  = useState<number | null>(null);
  const fileInputRef                = useRef<HTMLInputElement>(null);

  /* ── file selection ── */
  const acceptFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") {
      setErrorMsg("Only Excel files (.xlsx or .xls) are accepted.");
      setStage("error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("File size exceeds the 5 MB limit.");
      setStage("error");
      return;
    }
    setSelected(file);
    setStage("idle");
    setErrorMsg("");
  }, []);

  /* ── drag-drop ── */
  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) acceptFile(file);
  };

  /* ── upload ── */
  async function handleUpload() {
    if (!selectedFile) return;
    setStage("uploading");
    setResult(null);
    setErrorMsg("");
    setExpanded(null);
    try {
      const res = await collegeApi.bulkImport(selectedFile);
      setResult(res);
      setStage("done");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Import failed. Please try again.");
      setStage("error");
    }
  }

  /* ── template download ── */
  async function handleDownloadTemplate() {
    setDL(true);
    setTplErr("");
    try { await collegeApi.downloadTemplate(); }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Request failed.";
      setTplErr(`Could not download template: ${msg}`);
    }
    finally { setDL(false); }
  }

  /* ── reset ── */
  function reset() {
    setStage("idle"); setSelected(null); setResult(null);
    setErrorMsg(""); setTplErr(""); setExpanded(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /* ══════════════ render ══ */
  return (
    <div style={{ minHeight: "100vh", background: "var(--dd-bg)", color: "var(--dd-text1)" }}>

      {/* Ambient glow */}
      <div style={{ position: "fixed", top: "-200px", left: "50%", transform: "translateX(-50%)", width: "800px", height: "800px", background: "radial-gradient(circle, rgba(50,173,230,0.05) 0%, transparent 65%)", filter: "blur(60px)", pointerEvents: "none", zIndex: 0 }} />

      {/* Navbar */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 30,
        background: "var(--dd-nav-bg)",
        backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid var(--dd-border)",
        padding: "0 16px", height: "60px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", minWidth: 0 }}>
          <button onClick={() => router.push("/about")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Darkdoctor" draggable={false}
              style={{ height: "28px", width: "auto", objectFit: "contain" }} />
          </button>
          <span style={{ color: "var(--dd-border2)" }}>/</span>
          <span style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--dd-text2)" }}>Home</span>
          <span style={{ color: "var(--dd-border2)" }}>/</span>
          <span style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--dd-text2)" }}>Bulk Import</span>
        </div>
        <button onClick={() => router.push("/superadmin/home")} style={{ padding: "7px 13px", borderRadius: "8px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text2)", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-border2)"; e.currentTarget.style.color = "var(--dd-text1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text2)"; }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 12L6 8l4-4"/></svg>
          Home
        </button>
      </nav>

      {/* Main */}
      <main style={{ position: "relative", zIndex: 1, maxWidth: "800px", margin: "0 auto", padding: "40px 20px 80px" }}>

        {/* Page header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.5rem,4vw,1.9rem)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "6px", color: "var(--dd-text1)" }}>
            Bulk Import Colleges
          </h1>
          <p style={{ fontSize: "0.9rem", color: "var(--dd-text3)", lineHeight: 1.6 }}>
            Upload an Excel file to add multiple colleges at once. Valid records are imported immediately.
            Failed records are reported with specific error reasons. Export them, fix, and re-upload.
          </p>
        </div>

        {/* ── Step 1: Download template ── */}
        <div style={{ padding: "20px 22px", borderRadius: "16px", background: "var(--dd-bg2)", border: "1px solid var(--dd-border)", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "14px" }}>
          <div>
            <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--dd-text1)", marginBottom: "3px" }}>
              Step 1: Download the template
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--dd-text3)", lineHeight: 1.5 }}>
              The template has column headers, dropdowns, a sample row, and an Instructions tab.
              Read the Instructions tab carefully, especially the location (full address) format.
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "8px", flexShrink: 0 }}>
            <button
              onClick={handleDownloadTemplate}
              disabled={downloading}
              style={{
                padding: "9px 18px", borderRadius: "10px", cursor: downloading ? "wait" : "pointer",
                background: "linear-gradient(135deg,#32ade6 0%,#0d9488 100%)",
                border: "none", color: "#fff", fontSize: "0.8125rem", fontWeight: 600,
                display: "flex", alignItems: "center", gap: "7px",
                opacity: downloading ? 0.6 : 1, transition: "opacity 0.15s",
                boxShadow: "0 2px 12px rgba(50,173,230,0.3)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v9M4 8l4 4 4-4"/><line x1="2" y1="14" x2="14" y2="14"/>
              </svg>
              {downloading ? "Downloading…" : "Download Template (.xlsx)"}
            </button>
            {templateError && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" style={{ stroke: "var(--dd-danger)", flexShrink: 0, marginTop: "1px" }} strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="10" cy="10" r="8"/><line x1="10" y1="6" x2="10" y2="11"/><circle cx="10" cy="14" r="0.5" fill="var(--dd-danger)" stroke="none"/>
                </svg>
                <span style={{ fontSize: "0.75rem", color: "var(--dd-danger)", lineHeight: 1.45 }}>{templateError}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Step 2: Upload ── */}
        <div style={{ padding: "20px 22px", borderRadius: "16px", background: "var(--dd-bg2)", border: "1px solid var(--dd-border)", marginBottom: "24px" }}>
          <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--dd-text1)", marginBottom: "3px" }}>
            Step 2: Fill it in and upload
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--dd-text3)", marginBottom: "16px", lineHeight: 1.5 }}>
            Fill the template with your college data and upload it below. Max 500 rows, 5 MB.
            <br />
            <span style={{ color: "var(--dd-warning)" }}>
              Location must be a full street address (e.g. &quot;123 Main St, Chennai, Tamil Nadu 600083&quot;), not just a city name.
              It is shown to users and linked to Google Maps.
            </span>
          </div>

          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            style={{
              border: `2px dashed ${dragging ? "#32ade6" : selectedFile ? "#15803d" : "var(--dd-border2)"}`,
              borderRadius: "14px", padding: "36px 20px",
              textAlign: "center", cursor: "pointer",
              background: dragging ? "rgba(50,173,230,0.05)" : selectedFile ? "rgba(21,128,61,0.06)" : "var(--dd-surface)",
              transition: "all 0.18s",
            }}
          >
            <input
              id="bulk-import-file" name="file"
              ref={fileInputRef} type="file" accept=".xlsx,.xls"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) acceptFile(f); }}
            />
            {selectedFile ? (
              <>
                <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "var(--dd-success-bg)", border: "1px solid var(--dd-success-border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--dd-success)" }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><polyline points="9,15 12,18 15,15"/><line x1="12" y1="12" x2="12" y2="18"/></svg>
                </div>
                <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--dd-success)", marginBottom: "4px" }}>{selectedFile.name}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--dd-text3)" }}>{(selectedFile.size / 1024).toFixed(1)} KB · Click to change file</div>
              </>
            ) : (
              <>
                <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--dd-text2)" }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <div style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--dd-text2)", marginBottom: "4px" }}>
                  {dragging ? "Drop the file here" : "Drag & drop your Excel file here"}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--dd-text3)" }}>or click to browse · .xlsx or .xls · max 5 MB</div>
              </>
            )}
          </div>

          {/* Upload button */}
          {selectedFile && stage !== "uploading" && stage !== "done" && (
            <button
              onClick={handleUpload}
              style={{
                marginTop: "14px", width: "100%", padding: "12px",
                borderRadius: "12px", border: "none", cursor: "pointer",
                background: "linear-gradient(135deg,#32ade6 0%,#0d9488 100%)",
                color: "#fff", fontSize: "0.9375rem", fontWeight: 600,
                boxShadow: "0 4px 20px rgba(50,173,230,0.25)",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              Import Colleges
            </button>
          )}

          {/* Uploading state */}
          {stage === "uploading" && (
            <div style={{ marginTop: "14px", padding: "14px", borderRadius: "12px", background: "rgba(50,173,230,0.07)", border: "1px solid rgba(50,173,230,0.18)", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "18px", height: "18px", borderRadius: "50%", border: "2.5px solid rgba(50,173,230,0.3)", borderTopColor: "#32ade6", animation: "dd-spin 0.7s linear infinite", flexShrink: 0 }} />
              <span style={{ fontSize: "0.875rem", color: "#32ade6", fontWeight: 500 }}>Processing your file… please wait</span>
            </div>
          )}
        </div>

        {/* ── File-level error ── */}
        {stage === "error" && (
          <div style={{ padding: "18px 20px", borderRadius: "14px", background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)", marginBottom: "24px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ stroke: "var(--dd-danger)", flexShrink: 0, marginTop: "1px" }} strokeWidth="1.8" strokeLinecap="round">
              <circle cx="10" cy="10" r="8"/><line x1="10" y1="6" x2="10" y2="10"/><line x1="10" y1="14" x2="10" y2="14"/>
            </svg>
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--dd-danger)", marginBottom: "3px" }}>Import failed</div>
              <div style={{ fontSize: "0.8125rem", color: "var(--dd-text2)" }}>{errorMsg}</div>
              <button onClick={reset} style={{ marginTop: "10px", padding: "5px 12px", borderRadius: "8px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text2)", fontSize: "0.78rem", cursor: "pointer" }}>
                Try again
              </button>
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {stage === "done" && result && (
          <div>
            {/* Stats row */}
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "24px" }}>
              <StatCard value={result.total}    label="Total Processed" color="var(--dd-text1)"  bg="var(--dd-bg2)" border="var(--dd-border)" />
              <StatCard value={result.imported} label="Imported"        color="var(--dd-success)"  bg="var(--dd-success-bg)"   border="var(--dd-success-border)" />
              <StatCard value={result.failed}   label="Failed"          color={result.failed > 0 ? "var(--dd-danger)" : "var(--dd-text3)"} bg={result.failed > 0 ? "var(--dd-danger-bg)" : "var(--dd-surface)"} border={result.failed > 0 ? "var(--dd-danger-border)" : "var(--dd-border)"} />
            </div>

            {/* Success banner */}
            {result.imported > 0 && (
              <div style={{ padding: "14px 18px", borderRadius: "12px", background: "var(--dd-success-bg)", border: "1px solid var(--dd-success-border)", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ stroke: "var(--dd-success)" }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,8 6,12 14,4"/></svg>
                  <span style={{ fontSize: "0.875rem", color: "var(--dd-success)", fontWeight: 500 }}>
                    {result.imported} college{result.imported !== 1 ? "s" : ""} successfully imported and are now live in the platform.
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", paddingLeft: "26px" }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ stroke: "var(--dd-warning)", flexShrink: 0, marginTop: "1px" }} strokeWidth="1.7" strokeLinecap="round">
                    <circle cx="8" cy="8" r="7"/>
                    <line x1="8" y1="5.5" x2="8" y2="9.5"/>
                    <circle cx="8" cy="11.5" r="0.7" fill="var(--dd-warning)" stroke="none"/>
                  </svg>
                  <span style={{ fontSize: "0.78rem", color: "var(--dd-text2)", lineHeight: 1.55 }}>
                    Seat breakdowns are not part of this import. Open each college&apos;s detail page
                    and click <strong style={{ color: "var(--dd-text1)" }}>Intake Seats</strong> to add a program-level breakdown.
                    Or run <code style={{ background: "var(--dd-surface2)", padding: "1px 6px", borderRadius: "4px", fontSize: "0.75rem", color: "var(--dd-text1)" }}>python manage.py seed_seat_entries --apply</code> to auto-seed all at once.
                  </span>
                </div>
              </div>
            )}

            {/* Failures table */}
            {result.failures.length > 0 && (
              <div style={{ borderRadius: "16px", background: "var(--dd-bg2)", border: "1px solid var(--dd-border)", overflow: "hidden", marginBottom: "16px" }}>

                {/* Table header */}
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--dd-border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--dd-danger)" }}>
                      {result.failed} record{result.failed !== 1 ? "s" : ""} failed. Fix and re-upload
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--dd-text3)", marginTop: "2px" }}>
                      Click a row to see the specific errors. Export to CSV to fix in bulk.
                    </div>
                  </div>
                  <button
                    onClick={() => exportFailuresCSV(result.failures)}
                    style={{
                      padding: "7px 14px", borderRadius: "8px", cursor: "pointer",
                      background: "var(--dd-danger-bg)", border: "1px solid var(--dd-danger-border)",
                      color: "var(--dd-danger)", fontSize: "0.78rem", fontWeight: 600,
                      display: "flex", alignItems: "center", gap: "6px",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(185,28,28,0.16)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-danger-bg)"; }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 2v9M4 8l4 4 4-4"/><line x1="2" y1="14" x2="14" y2="14"/>
                    </svg>
                    Export failed records (.csv)
                  </button>
                </div>

                {/* Column labels */}
                <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr 36px", gap: "0", padding: "10px 20px", borderBottom: "1px solid var(--dd-border)", background: "var(--dd-surface)" }}>
                  {["Row", "College Name", "Location", ""].map((h) => (
                    <span key={h} style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--dd-text3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</span>
                  ))}
                </div>

                {/* Rows */}
                {result.failures.map((f) => (
                  <div key={f.row}>
                    <div
                      onClick={() => setExpanded(expandedRow === f.row ? null : f.row)}
                      style={{
                        display: "grid", gridTemplateColumns: "60px 1fr 1fr 36px",
                        gap: "0", padding: "13px 20px",
                        borderBottom: "1px solid var(--dd-border)",
                        cursor: "pointer", transition: "background 0.12s",
                        background: expandedRow === f.row ? "var(--dd-danger-bg)" : "transparent",
                        alignItems: "center",
                      }}
                      onMouseEnter={(e) => { if (expandedRow !== f.row) (e.currentTarget as HTMLElement).style.background = "var(--dd-surface2)"; }}
                      onMouseLeave={(e) => { if (expandedRow !== f.row) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <span className="num" style={{ fontSize: "0.8125rem", color: "var(--dd-danger)", fontWeight: 600 }}>#{f.row}</span>
                      <span style={{ fontSize: "0.8125rem", color: "var(--dd-text1)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: "12px" }}>{f.name}</span>
                      <span style={{ fontSize: "0.8125rem", color: "var(--dd-text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: "8px" }}>{f.location || "-"}</span>
                      <svg style={{ justifySelf: "center", transform: expandedRow === f.row ? "rotate(180deg)" : "none", transition: "transform 0.2s", color: "var(--dd-text3)" }}
                        width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="2,4 7,10 12,4"/>
                      </svg>
                    </div>

                    {/* Expanded error list */}
                    {expandedRow === f.row && (
                      <div style={{ padding: "12px 20px 14px 80px", borderBottom: "1px solid var(--dd-border)", background: "var(--dd-danger-bg)" }}>
                        {f.errors.map((err, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: i < f.errors.length - 1 ? "6px" : 0 }}>
                            <span style={{ color: "var(--dd-danger)", marginTop: "2px", flexShrink: 0 }}>•</span>
                            <span style={{ fontSize: "0.8125rem", color: "var(--dd-text2)", lineHeight: 1.55 }}>{err}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* All passed */}
            {result.failed === 0 && (
              <div style={{ padding: "14px 18px", borderRadius: "12px", background: "var(--dd-success-bg)", border: "1px solid var(--dd-success-border)", marginBottom: "16px", textAlign: "center" }}>
                <span style={{ fontSize: "0.875rem", color: "var(--dd-success)" }}>All records imported successfully. No failures.</span>
              </div>
            )}

            {/* Seat entry warnings */}
            {result.seat_entry_warnings?.length > 0 && (
              <div style={{ borderRadius: "14px", background: "var(--dd-warning-bg)", border: "1px solid var(--dd-warning-border)", overflow: "hidden", marginBottom: "16px" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--dd-warning-border)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ stroke: "var(--dd-warning)" }} strokeWidth="1.6" strokeLinecap="round">
                    <circle cx="8" cy="8" r="7"/><line x1="8" y1="5" x2="8" y2="9"/><circle cx="8" cy="11.5" r="0.7" fill="var(--dd-warning)" stroke="none"/>
                  </svg>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--dd-warning)" }}>
                    {result.seat_entry_warnings.length} seat entry item{result.seat_entry_warnings.length !== 1 ? "s" : ""} skipped
                  </span>
                </div>
                <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: "5px" }}>
                  {result.seat_entry_warnings.map((w, i) => (
                    <div key={i} style={{ fontSize: "0.8125rem", color: "var(--dd-text2)" }}>• {w}</div>
                  ))}
                  <p style={{ fontSize: "0.78rem", color: "var(--dd-text3)", marginTop: "6px" }}>
                    The affected colleges were still imported. Add their seat breakdowns from the college detail page → Intake Seats.
                  </p>
                </div>
              </div>
            )}

            {/* Fee entry warnings */}
            {(result.fee_entry_warnings?.length ?? 0) > 0 && (
              <div style={{ borderRadius: "14px", background: "var(--dd-warning-bg)", border: "1px solid var(--dd-warning-border)", overflow: "hidden", marginBottom: "16px" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--dd-warning-border)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ stroke: "var(--dd-warning)" }} strokeWidth="1.6" strokeLinecap="round">
                    <circle cx="8" cy="8" r="7"/><line x1="8" y1="5" x2="8" y2="9"/><circle cx="8" cy="11.5" r="0.7" fill="var(--dd-warning)" stroke="none"/>
                  </svg>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--dd-warning)" }}>
                    {result.fee_entry_warnings!.length} fee entry item{result.fee_entry_warnings!.length !== 1 ? "s" : ""} skipped
                  </span>
                </div>
                <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: "5px" }}>
                  {result.fee_entry_warnings!.map((w, i) => (
                    <div key={i} style={{ fontSize: "0.8125rem", color: "var(--dd-text2)" }}>• {w}</div>
                  ))}
                  <p style={{ fontSize: "0.78rem", color: "var(--dd-text3)", marginTop: "6px" }}>
                    The affected colleges were still imported. Add their fee breakdowns from the college detail page → Fee.
                  </p>
                </div>
              </div>
            )}

            {/* Stipend entry warnings */}
            {(result.stipend_entry_warnings?.length ?? 0) > 0 && (
              <div style={{ borderRadius: "14px", background: "var(--dd-warning-bg)", border: "1px solid var(--dd-warning-border)", overflow: "hidden", marginBottom: "16px" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--dd-warning-border)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ stroke: "var(--dd-warning)" }} strokeWidth="1.6" strokeLinecap="round">
                    <circle cx="8" cy="8" r="7"/><line x1="8" y1="5" x2="8" y2="9"/><circle cx="8" cy="11.5" r="0.7" fill="var(--dd-warning)" stroke="none"/>
                  </svg>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--dd-warning)" }}>
                    {result.stipend_entry_warnings!.length} stipend entry item{result.stipend_entry_warnings!.length !== 1 ? "s" : ""} skipped
                  </span>
                </div>
                <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: "5px" }}>
                  {result.stipend_entry_warnings!.map((w, i) => (
                    <div key={i} style={{ fontSize: "0.8125rem", color: "var(--dd-text2)" }}>• {w}</div>
                  ))}
                  <p style={{ fontSize: "0.78rem", color: "var(--dd-text3)", marginTop: "6px" }}>
                    The affected colleges were still imported. Add their stipend breakdowns from the college detail page → Stipend.
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button onClick={reset} style={{ padding: "9px 18px", borderRadius: "10px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", color: "var(--dd-text2)", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--dd-border2)"; e.currentTarget.style.color = "var(--dd-text1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text2)"; }}
              >
                Import another file
              </button>
              <button onClick={() => router.push("/colleges")} style={{ padding: "9px 18px", borderRadius: "10px", background: "var(--dd-teal-bg2)", border: "1px solid var(--dd-teal-border)", color: "var(--dd-teal)", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(13,148,136,0.2)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-teal-bg2)"; }}
              >
                View all colleges →
              </button>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes dd-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
