"use client";

import { PASSWORD_RULES } from "@/lib/password";

export function PasswordRequirements({ password }: { password: string }) {
  return (
    <div style={{
      marginTop: "10px", display: "flex", flexDirection: "column", gap: "7px",
      padding: "11px 13px", borderRadius: "11px",
      background: "var(--dd-surface)", border: "1px solid var(--dd-border)",
    }}>
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <div key={rule.key} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "15px", height: "15px", borderRadius: "50%", flexShrink: 0,
              background: met ? "var(--dd-success)" : "var(--dd-border2)",
              transition: "background 0.15s",
            }}>
              {met && (
                <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8l4 4 6-7" />
                </svg>
              )}
            </span>
            <span style={{
              fontSize: "0.78rem", lineHeight: 1,
              color: met ? "var(--dd-text2)" : "var(--dd-text3)",
              fontWeight: met ? 500 : 400,
              transition: "color 0.15s",
            }}>
              {rule.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
