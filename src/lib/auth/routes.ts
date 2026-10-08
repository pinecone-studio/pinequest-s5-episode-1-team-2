import type { Role } from "@/types/auth";

/** Where a signed-in user belongs. No role yet means they still have to choose one. */
export function homeFor(role: Role | null) {
  if (role === "guardian") return "/guardian";
  if (role === "child") return "/tracker";
  return "/role";
}
