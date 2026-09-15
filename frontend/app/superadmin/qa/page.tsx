"use client";

import QAModerationPage from "@/components/colleges/QAModerationPage";

export default function SuperAdminQAPage() {
  return <QAModerationPage strictSuperAdmin={true} homeHref="/superadmin/home" loginHref="/superadmin" />;
}
