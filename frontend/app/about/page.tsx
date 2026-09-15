"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { aboutApi, AboutData } from "@/lib/aboutApi";

/* ── Social platform icon map ──────────────────────────────────────────── */
function SocialIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();

  if (p.includes("instagram"))
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5"/>
        <circle cx="12" cy="12" r="5"/>
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
      </svg>
    );

  if (p.includes("twitter") || p.includes(" x ") || p === "x")
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    );

  if (p.includes("linkedin"))
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
        <circle cx="4" cy="4" r="2"/>
      </svg>
    );

  if (p.includes("youtube"))
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 001.46 6.42 29 29 0 001 12a29 29 0 00.46 5.58 2.78 2.78 0 001.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.96A29 29 0 0023 12a29 29 0 00-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/>
      </svg>
    );

  if (p.includes("facebook"))
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
      </svg>
    );

  if (p.includes("whatsapp"))
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    );

  if (p.includes("telegram"))
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    );

  if (p.includes("github"))
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
      </svg>
    );

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
    </svg>
  );
}

/* ── Shared label style ─────────────────────────────────────────────────── */
const LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "var(--dd-text3)",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  marginBottom: "14px",
};

/* ── Mission / Vision — single-sentence, high-presence ─────────────────── */
function BriefSection({ label, text }: { label: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <div style={{ padding: "28px 0", borderBottom: "1px solid var(--dd-border)" }}>
      <p style={LABEL_STYLE}>{label}</p>
      <p style={{
        fontSize: "1rem",
        color: "var(--dd-text1)",
        lineHeight: 1.8,
        whiteSpace: "pre-wrap",
        margin: 0,
      }}>
        {text}
      </p>
    </div>
  );
}

/* ── About Us — multi-paragraph with pivot-sentence emphasis ────────────── */
function ExtendedSection({ label, text }: { label: string; text: string }) {
  if (!text.trim()) return null;

  // Split on blank lines; fall back to single block if none present
  const rawParts = text.split(/\n\n+/);
  const paragraphs = rawParts.length > 1
    ? rawParts.map((p) => p.trim()).filter(Boolean)
    : [text];

  return (
    <div style={{ padding: "32px 0 40px", borderBottom: "1px solid var(--dd-border)" }}>
      <p style={{ ...LABEL_STYLE, marginBottom: "20px" }}>{label}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {paragraphs.map((para, i) => {
          // Short standalone lines (< 80 chars) are pivot sentences — give them emphasis
          const isPivot = para.length < 80;
          return (
            <p
              key={i}
              style={{
                fontSize: isPivot ? "1.0625rem" : "1rem",
                color: isPivot ? "var(--dd-text1)" : "var(--dd-text2)",
                lineHeight: 1.8,
                fontWeight: isPivot ? 500 : 400,
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {para}
            </p>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ PAGE ══ */
export default function AboutPage() {
  const router  = useRouter();
  const [data,    setData]    = useState<AboutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    aboutApi.get()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function retry() {
    setLoading(true);
    setError(null);
    aboutApi.get().then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }

  const about   = data?.about;
  const handles = data?.social_handles ?? [];
  const hasContent = about && (
    about.mission || about.vision || about.about || about.contact_email
  );

  return (
    /* Fix 8 — softer near-black instead of pure #000 */
    <div style={{ minHeight: "100vh", background: "var(--dd-bg)", color: "var(--dd-text1)" }}>

      {/* ── Sticky header ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 30,
        background: "var(--dd-nav-bg)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid var(--dd-border)",
        height: "56px", padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <button
          onClick={() => router.back()}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "none", border: "none", cursor: "pointer",
            color: "var(--dd-text2)", fontSize: "0.875rem", fontWeight: 500, padding: 0,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--dd-text1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dd-text2)"; }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M10 12L6 8l4-4"/>
          </svg>
          Back
        </button>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Darkdoctor"
          draggable={false}
          style={{ height: "24px", width: "auto", objectFit: "contain", opacity: 0.85 }}
        />

        <div style={{ width: "52px" }} />
      </header>

      {/* ── Body ── */}
      <main style={{ maxWidth: "680px", margin: "0 auto", padding: "56px 24px 96px" }}>

        {/* ── Hero ── */}
        <div style={{ textAlign: "center", marginBottom: "56px" }}>
          {/* Fix 2 & 9 — responsive icon size, explicit block centering */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand-icon.png"
            alt="Darkdoctor"
            draggable={false}
            style={{
              display: "block",
              margin: "0 auto 24px",
              width: "clamp(80px, 10vw, 112px)",
              height: "clamp(80px, 10vw, 112px)",
              objectFit: "contain",
            }}
          />
          {/* Fix 5 — logo removed from hero (already in header); tagline carries the identity */}
          <p style={{ fontSize: "0.9375rem", color: "var(--dd-text3)", letterSpacing: "0.01em", margin: 0 }}>
            Verified Reviews by India&apos;s Medical Students
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--dd-text3)" }}>
            Loading…
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <p style={{ color: "var(--dd-danger)", marginBottom: "12px" }}>{error}</p>
            <button
              onClick={retry}
              style={{
                padding: "8px 16px", borderRadius: "8px",
                background: "var(--dd-surface)",
                border: "1px solid var(--dd-border)",
                color: "var(--dd-text2)", cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <>
            {/* Empty state */}
            {!hasContent && handles.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px 0", color: "var(--dd-text3)" }}>
                Content coming soon.
              </div>
            )}

            {/* Fix 7 — borderTop removed; hero margin already provides separation */}
            {hasContent && (
              <div>
                {/* Fix 3, 6, 10 — BriefSection for Mission/Vision: brighter body, compact padding */}
                <BriefSection label="Our Mission" text={about!.mission} />
                <BriefSection label="Our Vision"  text={about!.vision}  />
                {/* Fix 4, 6 — ExtendedSection for About Us: paragraph split + pivot emphasis */}
                <ExtendedSection label="About Us"  text={about!.about}  />
              </div>
            )}

            {/* Contact + socials footer */}
            {(about?.contact_email || handles.length > 0) && (
              <div style={{
                marginTop: "48px",
                padding: "32px",
                borderRadius: "18px",
                background: "var(--dd-surface)",
                border: "1px solid var(--dd-border)",
                display: "flex",
                flexDirection: "column",
                gap: "24px",
              }}>

                {about?.contact_email && (
                  <div>
                    {/* Fix 1 — label size raised to 0.75rem, color to #8e8e93 */}
                    <p style={{ ...LABEL_STYLE, marginBottom: "10px" }}>Contact Us</p>
                    <a
                      href={`mailto:${about.contact_email}`}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: "8px",
                        color: "#0d9488", fontSize: "0.9375rem", textDecoration: "none",
                        transition: "opacity 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.75"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                      </svg>
                      {about.contact_email}
                    </a>
                  </div>
                )}

                {handles.length > 0 && (
                  <div>
                    <p style={{ ...LABEL_STYLE, marginBottom: "14px" }}>Follow Us</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                      {handles.map((h) => (
                        <a
                          key={h.id}
                          href={h.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={h.platform}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: "8px",
                            padding: "8px 16px", borderRadius: "100px",
                            background: "var(--dd-surface)",
                            border: "1px solid var(--dd-border)",
                            color: "var(--dd-text2)", fontSize: "0.8125rem", fontWeight: 500,
                            textDecoration: "none", transition: "all 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background   = "var(--dd-surface2)";
                            e.currentTarget.style.color        = "var(--dd-text1)";
                            e.currentTarget.style.borderColor  = "var(--dd-border2)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background   = "var(--dd-surface)";
                            e.currentTarget.style.color        = "var(--dd-text2)";
                            e.currentTarget.style.borderColor  = "var(--dd-border)";
                          }}
                        >
                          <SocialIcon platform={h.platform} />
                          {h.platform}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Fix 3 — CTA: converts trust into action */}
            <div style={{ marginTop: "48px", textAlign: "center" }}>
              <button
                onClick={() => router.push("/colleges")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  padding: "11px 26px", borderRadius: "100px",
                  background: "var(--dd-surface)",
                  border: "1px solid var(--dd-border)",
                  color: "var(--dd-text2)", fontSize: "0.875rem", fontWeight: 500,
                  cursor: "pointer", transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background  = "var(--dd-surface2)";
                  e.currentTarget.style.color       = "var(--dd-text1)";
                  e.currentTarget.style.borderColor = "var(--dd-border2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background  = "var(--dd-surface)";
                  e.currentTarget.style.color       = "var(--dd-text2)";
                  e.currentTarget.style.borderColor = "var(--dd-border)";
                }}
              >
                Explore Colleges
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M3 8h10M9 4l4 4-4 4"/>
                </svg>
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
