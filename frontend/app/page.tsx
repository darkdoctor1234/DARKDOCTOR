"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

const REDIRECT_AFTER = 4;

export default function WelcomePage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(REDIRECT_AFTER);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && isAuthenticated()) router.replace("/feed");
  }, [mounted, router]);

  useEffect(() => {
    if (!mounted) return;
    const id = setInterval(() => setCountdown((p) => Math.max(p - 1, 0)), 1000);
    return () => clearInterval(id);
  }, [mounted]);

  useEffect(() => {
    if (countdown === 0) router.replace("/feed");
  }, [countdown, router]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "#0D1117",
      overflow: "hidden", userSelect: "none",
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand-icon.png"
        alt="DarkDoctor"
        draggable={false}
        className="dd-splash-icon"
      />

      <style>{`
        .dd-splash-icon {
          object-fit: contain;
          width: 60vw;
          height: 60vw;
          min-width: 240px;
          min-height: 240px;
          transform: translateY(8%);
        }
        @media (min-width: 640px) {
          .dd-splash-icon {
            width: 35vw;
            height: 35vw;
            min-width: 220px;
            min-height: 220px;
            transform: none;
          }
        }
      `}</style>
    </div>
  );
}
