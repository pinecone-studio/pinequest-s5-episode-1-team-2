import { getCollections } from "@/lib/db/mongo";
import { getCurrentUser } from "@/lib/auth/dal";

/** The name and phone for the role this device acts as, so settings can show them. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not signed in." }, { status: 401 });
  if (!user.role) return Response.json({ role: null, name: "", phone: "" });

  const { users } = await getCollections();
  const record = await users.findOne({ _id: user.id }, { projection: { name: 1, phone: 1, childName: 1, childPhone: 1 } });
  const asChild = user.role === "child";
  return Response.json({
    role: user.role,
    name: (asChild ? record?.childName : undefined) ?? record?.name ?? "",
    phone: (asChild ? record?.childPhone : undefined) ?? record?.phone ?? "",
  });
}
