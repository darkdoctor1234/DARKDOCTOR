"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, getUser } from "@/lib/auth";

export default function AdminReviewsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/admin");
      return;
    }
    const user = getUser<{ role: string }>();
    if (user?.role !== "admin" && user?.role !== "super_admin") {
      router.replace("/admin");
    }
  }, [router]);

  return <>{children}</>;
}
