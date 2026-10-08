import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/dal";

export default async function GuardianLayout({ children }: { children: ReactNode }) {
  await requireRole("guardian");
  return children;
}
