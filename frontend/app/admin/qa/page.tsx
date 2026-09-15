"use client";

import QAModerationPage from "@/components/colleges/QAModerationPage";

export default function AdminQAPage() {
  return <QAModerationPage strictSuperAdmin={false} homeHref="/admin/dashboard" loginHref="/admin" />;
}
