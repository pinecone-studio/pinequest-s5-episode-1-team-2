import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCollections } from "@/lib/db/mongo";
import { homeFor } from "@/lib/auth/routes";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { toUser } from "@/lib/auth/user";
import type { Role, User } from "@/types/auth";

const getSession = cache(async () =>
  verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value),
);

export const getSessionUserId = cache(async () => (await getSession())?.userId ?? null);

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const userId = await getSessionUserId();

  if (!userId) {
    return null;
  }

  const { users } = await getCollections();

  const record = await users.findOne({ _id: userId });

  const session = await getSession();

  return record
    ? { ...toUser(record), role: record.role ?? session?.role ?? null }
    : null;
});

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireRole(role: Role) {
  const user = await requireUser();

  if (user.role !== role) {
    const redirectPath = homeFor(user.role);

    redirect(redirectPath);
  }

  return user;
}
