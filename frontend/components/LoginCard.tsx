"use client";

import { useState, FormEvent } from "react";

interface LoginCardProps {
  title: string;
  subtitle: string;
  accentColor: string;
  accentGlow: string;
  onSubmit: (email: string, password: string) => Promise<void>;
}

export default function LoginCard({
  title,
  subtitle,
  accentColor,
  accentGlow,
  onSubmit,
}: LoginCardProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onSubmit(email.trim(), password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "420px",
        borderRadius: "24px",
        background: "var(--dd-bg2)",
        border: "1px solid var(--dd-border)",
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
        boxShadow: "var(--dd-shadow-lg)",
        padding: "40px 36px",
      }}
    >
      {/* Icon */}
      <div
        className="mb-6 flex items-center justify-center"
        style={{
          width: "52px",
          height: "52px",
          borderRadius: "14px",
          background: `linear-gradient(135deg, ${accentColor} 0%, #7c3aed 100%)`,
          boxShadow: `0 0 32px ${accentGlow}, inset 0 1px 0 rgba(255,255,255,0.2)`,
        }}
      >
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <rect x="5" y="3" width="16" height="20" rx="3" stroke="white" strokeWidth="1.8" fill="none" />
          <circle cx="13" cy="13" r="3.5" stroke="white" strokeWidth="1.8" fill="none" />
          <line x1="13" y1="9.5" x2="13" y2="7" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="13" y1="16.5" x2="13" y2="19" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>

      {/* Heading */}
      <h1
        className="font-semibold mb-1"
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.5rem",
          letterSpacing: "-0.02em",
          color: "var(--dd-text1)",
        }}
      >
        {title}
      </h1>
      <p
        className="mb-8"
        style={{ fontSize: "0.875rem", color: "var(--dd-text2)", letterSpacing: "-0.01em" }}
      >
        {subtitle}
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            style={{ fontSize: "0.8125rem", color: "var(--dd-text2)", letterSpacing: "-0.01em" }}
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: "12px",
              background: "var(--dd-input-bg)",
              border: "1px solid var(--dd-border2)",
              color: "var(--dd-text1)",
              fontSize: "0.9375rem",
              letterSpacing: "-0.01em",
              outline: "none",
              transition: "border-color 0.15s, background 0.15s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = accentColor;
              e.currentTarget.style.background = "var(--dd-surface2)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--dd-border2)";
              e.currentTarget.style.background = "var(--dd-input-bg)";
            }}
          />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            style={{ fontSize: "0.8125rem", color: "var(--dd-text2)", letterSpacing: "-0.01em" }}
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "12px 44px 12px 14px",
                borderRadius: "12px",
                background: "var(--dd-input-bg)",
                border: "1px solid var(--dd-border2)",
                color: "var(--dd-text1)",
                fontSize: "0.9375rem",
                letterSpacing: "-0.01em",
                outline: "none",
                transition: "border-color 0.15s, background 0.15s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = accentColor;
                e.currentTarget.style.background = "var(--dd-surface2)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--dd-border2)";
                e.currentTarget.style.background = "var(--dd-input-bg)";
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--dd-text3)",
                padding: "4px",
                borderRadius: "6px",
              }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20C7 20 2.73 16.39 1 12c.79-1.96 2.07-3.67 3.67-5M9.9 4.24A9.12 9.12 0 0112 4c5 0 9.27 3.61 11 8-.43 1.07-1.01 2.06-1.71 2.94M1 1l22 22"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12C2.73 7.61 7 4 12 4s9.27 3.61 11 8c-1.73 4.39-6 8-11 8S2.73 16.39 1 12z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{
              background: "var(--dd-danger-bg)",
              border: "1px solid var(--dd-danger-border)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="var(--dd-danger)" strokeWidth="1.5" />
              <line x1="8" y1="5" x2="8" y2="9" stroke="var(--dd-danger)" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="11.5" r="0.75" fill="var(--dd-danger)" />
            </svg>
            <span style={{ fontSize: "0.8125rem", color: "var(--dd-danger)" }}>{error}</span>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: "4px",
            width: "100%",
            padding: "13px",
            borderRadius: "12px",
            background: loading
              ? "var(--dd-border2)"
              : `linear-gradient(135deg, ${accentColor} 0%, #7c3aed 100%)`,
            border: "none",
            color: "white",
            fontSize: "0.9375rem",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: loading ? "none" : `0 4px 24px ${accentGlow}`,
            transition: "all 0.2s ease",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
