import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/dal";
import PushNotificationSetup from "@/components/push-notification-setup";

export default async function TrackerLayout({ children }: { children: ReactNode }) {
  await requireRole("child");
  return <><PushNotificationSetup />{children}</>;
}
