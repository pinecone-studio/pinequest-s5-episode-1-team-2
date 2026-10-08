import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/dal";

export default async function TrackerLayout({ children }: { children: ReactNode }) {
  await requireRole("child");
  return children;
}
