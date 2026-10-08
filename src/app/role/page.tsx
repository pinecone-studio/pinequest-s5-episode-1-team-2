import { RoleHome } from "@/components/role-home";
import { requireUser } from "@/lib/auth/dal";

export default async function RolePage() {
  const user = await requireUser();
  return <RoleHome userName={user.name} />;
}
