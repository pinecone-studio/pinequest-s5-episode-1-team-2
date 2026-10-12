import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/dal";
import PushNotificationSetup from "@/components/push-notification-setup";

export default async function GuardianLayout({ children }: { children: ReactNode }) {
  await requireRole("guardian");
  return <><PushNotificationSetup />{children}</>;
}
