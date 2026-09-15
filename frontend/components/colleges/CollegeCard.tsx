"use client";

import { useRouter } from "next/navigation";
import { College } from "@/lib/collegeApi";

interface Props {
  college: College;
  isSuperAdmin: boolean;
  onEdit: (college: College) => void;
  onDelete: (college: College) => void;
}

export default function CollegeCard({ college, isSuperAdmin, onEdit, onDelete }: Props) {
  const router = useRouter();

  const isGovt      = college.college_type === "govt";
  const accentColor = isGovt ? "#0d9488" : "#7c3aed";
  const accentBg    = isGovt ? "rgba(13,148,136,0.10)" : "rgba(124,58,237,0.10)";
  const accentBorder= isGovt ? "rgba(13,148,136,0.25)" : "rgba(124,58,237,0.25)";

  const courses = [
    ...(college.has_mbbs    ? ["MBBS"]   : []),
    ...(college.has_dental  ? ["BDS"]    : []),
    ...(college.has_nursing ? ["BSc Nursing"] : []),
  ];

  return (
    <div
      onClick={() => router.push(`/colleges/${college.id}`)}
      style={{
        background: "var(--dd-surface)",
        border: "1px solid var(--dd-border)",
        borderRadius: "18px",
        padding: "18px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: "0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        transition: "box-shadow 0.18s ease, border-color 0.18s ease, transform 0.18s ease",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "0 8px 24px rgba(0,0,0,0.10)";
        el.style.borderColor = accentBorder;
        el.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)";
        el.style.borderColor = "var(--dd-border)";
        el.style.transform = "translateY(0)";
      }}
    >
      {/* Top row: badge + star rating */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "4px",
            padding: "3px 10px", borderRadius: "100px",
            background: accentBg, border: `1px solid ${accentBorder}`,
            color: accentColor, fontSize: "0.72rem", fontWeight: 700,
            letterSpacing: "0.04em", textTransform: "uppercase", flexShrink: 0,
          }}>
            {isGovt ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M4 21V10l8-6 8 6v11M9 21v-7h6v7"/>
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 21v-4h6v4M9 8h.01M15 8h.01M9 12h.01M15 12h.01"/>
              </svg>
            )}
            {isGovt ? "Govt" : "Private"}
          </span>

          {typeof college.avg_rating === "number" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 20 20" fill="var(--dd-warning)" stroke="none">
                <path d="M10 1.5l2.59 5.25 5.79.84-4.19 4.08.99 5.77L10 14.77l-5.18 2.67.99-5.77L1.62 7.59l5.79-.84L10 1.5z"/>
              </svg>
              <span className="num" style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--dd-text1)" }}>{college.avg_rating.toFixed(1)}</span>
            </span>
          )}
        </div>

        {isSuperAdmin && (
          <div style={{ display: "flex", gap: "5px" }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(college); }}
              title="Edit"
              style={{ width: "26px", height: "26px", borderRadius: "7px", background: "var(--dd-surface2)", border: "1px solid var(--dd-border2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--dd-text3)", cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(13,148,136,0.12)"; e.currentTarget.style.color = "#0d9488"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--dd-surface2)"; e.currentTarget.style.color = "var(--dd-text3)"; }}
            >
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-9 9L3 17l1.586-4.414 9-9z"/>
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(college); }}
              title="Delete"
              style={{ width: "26px", height: "26px", borderRadius: "7px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.18)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2,4 14,4"/><path d="M5 4V2h6v2"/><path d="M3 4l1 10h8l1-10"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* College name */}
      <h3 style={{
        fontSize: "1rem", fontWeight: 700, color: "var(--dd-text1)",
        lineHeight: "1.35", letterSpacing: "-0.02em",
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        overflow: "hidden", marginBottom: "6px",
      }}>
        {college.name}
      </h3>

      {/* Location */}
      <a
        href={college.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(college.name + (college.state ? `, ${college.state}` : ""))}`}
        target="_blank" rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px", color: "var(--dd-text3)", fontSize: "0.8rem", textDecoration: "none" }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "#0d9488"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text3)"; }}
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M8 14S3 9.5 3 6a5 5 0 0110 0c0 3.5-5 8-5 8z"/><circle cx="8" cy="6" r="1.5"/>
        </svg>
        {college.state || college.location}
      </a>

      {college.university && (
        <p style={{ fontSize: "0.75rem", color: "var(--dd-text4)", marginBottom: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {college.university}
        </p>
      )}

      {/* Footer: Est · Seats · Courses */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "12px", borderTop: "1px solid var(--dd-border)", marginTop: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "0.65rem", color: "var(--dd-text4)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Est.</span>
            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--dd-text1)" }}>{college.established_year}</span>
          </div>
          <div style={{ width: "1px", height: "28px", background: "var(--dd-border)" }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "0.65rem", color: "var(--dd-text4)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Seats</span>
            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--dd-text1)" }}>{college.intake_seats}</span>
          </div>
          <div style={{ width: "1px", height: "28px", background: "var(--dd-border)" }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "0.65rem", color: "var(--dd-text4)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "3px" }}>Courses</span>
            <div style={{ display: "flex", gap: "4px" }}>
              {courses.length > 0 ? courses.map((c) => (
                <span key={c} style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--dd-text2)", background: "var(--dd-surface2)", padding: "1px 6px", borderRadius: "5px" }}>{c}</span>
              )) : (
                <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--dd-text2)", background: "var(--dd-surface2)", padding: "1px 6px", borderRadius: "5px" }}>PG</span>
              )}
            </div>
          </div>
        </div>

        {college.website_url && (
          <a
            href={college.website_url} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Visit website"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "30px", height: "30px", borderRadius: "9px", background: "rgba(13,148,136,0.08)", border: "1px solid rgba(13,148,136,0.2)", color: "#0d9488", flexShrink: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(13,148,136,0.18)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(13,148,136,0.08)"; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}
