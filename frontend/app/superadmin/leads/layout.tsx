"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, getUser } from "@/lib/auth";

export default function LeadsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const user = getUser<{ role: string }>();
    if (!isAuthenticated() || user?.role !== "super_admin") {
      router.replace("/superadmin");
    }
  }, [router]);

  return <>{children}</>;
}
