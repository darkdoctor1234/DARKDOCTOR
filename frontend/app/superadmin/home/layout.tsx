"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser, isAuthenticated } from "@/lib/auth";

export default function SuperAdminHomeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/superadmin");
      return;
    }
    const user = getUser<{ role: string }>();
    if (user?.role !== "super_admin") {
      router.replace("/superadmin");
    }
  }, [router]);

  return <>{children}</>;
}
