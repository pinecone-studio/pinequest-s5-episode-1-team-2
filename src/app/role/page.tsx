import { RoleHome } from "@/components/role-home";
import { homeFor } from "@/lib/auth/routes";
import { requireUser } from "@/lib/auth/dal";
import { redirect } from "next/navigation";

export default async function RolePage() {
  const user = await requireUser();
  if (user.role) redirect(homeFor(user.role));
  return <RoleHome />;
}
