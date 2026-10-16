import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/dal";
import PushNotificationSetup from "@/components/push-notification-setup";
import OfflineSupport from "@/components/offline-support";

export default async function TrackerLayout({ children }: { children: ReactNode }) {
  await requireRole("child");
  return <><PushNotificationSetup /><OfflineSupport />{children}</>;
}
