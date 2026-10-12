import { RoleHome } from "@/components/role-home";
import { requireUser } from "@/lib/auth/dal";

export default async function HomePage() {
  await requireUser();
  return <RoleHome />;
}
