"use client";

export default function OfflinePage() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--dd-bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
        padding: "32px 24px",
        userSelect: "none",
      }}
    >
      {/* Icon */}
      <img
        src="/brand-icon.png"
        alt="Darkdoctor"
        draggable={false}
        style={{
          width: "96px",
          height: "96px",
          objectFit: "contain",
          opacity: 0.35,
        }}
      />

      {/* Message */}
      <div style={{ textAlign: "center" }}>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "var(--dd-text1)",
            letterSpacing: "-0.02em",
            marginBottom: "8px",
          }}
        >
          You&apos;re offline
        </h1>
        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--dd-text3)",
            maxWidth: "280px",
            lineHeight: 1.5,
          }}
        >
          Check your connection and try again. Pages you&apos;ve already visited
          are still available.
        </p>
      </div>

      {/* Retry */}
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: "4px",
          padding: "10px 24px",
          borderRadius: "12px",
          background: "var(--dd-surface2)",
          border: "1px solid var(--dd-border2)",
          color: "var(--dd-text1)",
          fontSize: "0.875rem",
          fontWeight: 500,
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--dd-border2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--dd-surface2)";
        }}
      >
        Try again
      </button>
    </div>
  );
}
