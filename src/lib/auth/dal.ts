import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCollections } from "@/lib/db/mongo";
import { homeFor } from "@/lib/auth/routes";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { toUser } from "@/lib/auth/user";
import type { Role, User } from "@/types/auth";

export const getSessionUserId = cache(async () => {
  const session = await verifySessionToken(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );

  console.log("=== SESSION DEBUG ===");
  console.log("session userId:", session?.userId ?? null);

  return session?.userId ?? null;
});

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const userId = await getSessionUserId();

  if (!userId) {
    console.log("CURRENT USER: NO SESSION");
    return null;
  }

  const { users } = await getCollections();

  const record = await users.findOne({ _id: userId });

  console.log("=== DATABASE USER DEBUG ===");
  console.log("userId:", userId);
  console.log("database user:", record);
  console.log("database role:", record?.role ?? null);

  return record ? toUser(record) : null;
});

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    console.log("REQUIRE USER: NO USER -> /login");
    redirect("/login");
  }

  return user;
}

export async function requireRole(role: Role) {
  const user = await requireUser();

  console.log("=== REQUIRE ROLE DEBUG ===");
  console.log("required role:", role);
  console.log("actual role:", user.role);
  console.log("user id:", user.id);
  console.log("user email:", user.email);

  if (user.role !== role) {
    const redirectPath = homeFor(user.role);

    console.log("!!! ROLE MISMATCH !!!");
    console.log("required:", role);
    console.log("actual:", user.role);
    console.log("redirecting to:", redirectPath);
    console.log("========================");

    redirect(redirectPath);
  }

  console.log("ROLE CHECK PASSED");
  console.log("========================");

  return user;
}