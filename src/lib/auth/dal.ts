import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCollections } from "@/lib/db/mongo";
import { homeFor } from "@/lib/auth/routes";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { toUser } from "@/lib/auth/user";
import type { Role, User } from "@/types/auth";

/** The signed-in user's id, or null. Does not check that the account still exists. */
export const getSessionUserId = cache(async () => {
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  return session?.userId ?? null;
});

/** The signed-in user, read fresh from the database (so role changes apply immediately). */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const { users } = await getCollections();
  const record = await users.findOne({ _id: userId });
  return record ? toUser(record) : null;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Use at the top of a page or action that only one role may reach. */
export async function requireRole(role: Role) {
  const user = await requireUser();
  if (user.role !== role) redirect(homeFor(user.role));
  return user;
}
