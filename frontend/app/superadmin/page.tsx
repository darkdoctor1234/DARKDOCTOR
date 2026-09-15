"use client";

import { useRouter } from "next/navigation";
import LoginCard from "@/components/LoginCard";
import { authApi } from "@/lib/api";
import { saveSession } from "@/lib/auth";

export default function SuperAdminLoginPage() {
  const router = useRouter();

  async function handleLogin(email: string, password: string) {
    const data = await authApi.superAdminLogin({ email, password });
    saveSession(data.access, data.refresh, data.user);
    router.push("/superadmin/home");
  }

  return (
    <main
      className="relative min-h-screen flex flex-col items-center justify-center px-5 py-12 overflow-hidden"
      style={{
        background: "var(--dd-bg)",
      }}
    >
      {/* Ambient glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: "600px",
          height: "600px",
          top: "-200px",
          left: "50%",
          transform: "translateX(-50%)",
          background:
            "radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center w-full">
        {/* Back to home */}
        <a
          href="/"
          className="mb-10 flex items-center gap-1.5"
          style={{
            color: "var(--dd-text2)",
            fontSize: "0.875rem",
            textDecoration: "none",
            letterSpacing: "-0.01em",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--dd-text1)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--dd-text2)")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8l4-4" />
          </svg>
          Back to Darkdoctor
        </a>

        <LoginCard
          title="Super Admin Sign In"
          subtitle="Restricted access. Authorized personnel only."
          accentColor="#7c3aed"
          accentGlow="rgba(124,58,237,0.3)"
          onSubmit={handleLogin}
        />
      </div>
    </main>
  );
}
