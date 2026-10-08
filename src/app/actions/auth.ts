"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { getSessionUserId, requireRole } from "@/lib/auth/dal";
import { createPairingCode, redeemPairingCode, removeLink } from "@/lib/auth/pairing";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { allowAttempt } from "@/lib/auth/rate-limit";
import { homeFor } from "@/lib/auth/routes";
import { LoginFormSchema, PairingCodeFormSchema, SetRoleFormSchema, SignupFormSchema } from "@/lib/auth/schemas";
import { createSession, deleteSession } from "@/lib/auth/session";
import { getCollections, isDuplicateKey } from "@/lib/db/mongo";
import type { FormState } from "@/types/auth";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function signup(_state: FormState, formData: FormData): Promise<FormState> {
  const values = { name: text(formData, "name"), email: text(formData, "email") };
  const parsed = SignupFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  const { name, email, password } = parsed.data;
  const { users } = await getCollections();
  const id = crypto.randomUUID();
  try {
    await users.insertOne({ _id: id, email, passwordHash: await hashPassword(password), name, phone: null, role: null, createdAt: new Date() });
  } catch (error) {
    if (isDuplicateKey(error)) return { errors: { email: ["Энэ имэйл бүртгэлтэй байна."] }, values };
    throw error;
  }

  await createSession(id);
  redirect(homeFor(null));
}

export async function login(_state: FormState, formData: FormData): Promise<FormState> {
  const values = { email: text(formData, "email") };
  const parsed = LoginFormSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  const { email, password } = parsed.data;
  if (!(await allowAttempt(`login:${email}`, 10, 15 * 60_000))) {
    return { message: "Хэт олон оролдлоо. Хэсэг хүлээгээд дахин оролдоно уу.", values };
  }

  const { users } = await getCollections();
  const user = await users.findOne({ email });
  // Always runs, even for an unknown email, so both failures look and feel the same.
  const passwordMatches = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !passwordMatches) return { message: "Имэйл эсвэл нууц үг буруу байна.", values };

  await createSession(user._id);
  redirect(homeFor(user.role));
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

export async function setRole(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const parsed = SetRoleFormSchema.safeParse({ role: formData.get("role") });
  if (!parsed.success) redirect("/role");

  const { users } = await getCollections();
  const result = await users.updateOne({ _id: userId }, { $set: { role: parsed.data.role } });
  if (result.matchedCount === 0) redirect("/login");
  redirect(homeFor(parsed.data.role));
}

/** Child: show a code for a guardian to type in. */
export async function generatePairingCode(): Promise<FormState> {
  const child = await requireRole("child");
  const { code, expiresAt } = await createPairingCode(child.id);
  return { code, expiresAt: expiresAt.toISOString() };
}

/** Guardian: type in the child's code to start watching them. */
export async function redeemCode(_state: FormState, formData: FormData): Promise<FormState> {
  const guardian = await requireRole("guardian");
  const parsed = PairingCodeFormSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  if (!(await allowAttempt(`pair:${guardian.id}`, 10, 10 * 60_000))) {
    return { message: "Хэт олон оролдлоо. Хэсэг хүлээгээд дахин оролдоно уу." };
  }
  const childId = await redeemPairingCode(parsed.data.code, guardian.id);
  if (!childId) return { message: "Код буруу эсвэл хугацаа нь дууссан байна." };

  revalidatePath("/guardian/link");
  return { success: "Амжилттай холбогдлоо." };
}

/** Either side may end a link. */
export async function unlink(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  await removeLink(text(formData, "linkId"), userId);
  revalidatePath("/guardian/link");
  revalidatePath("/tracker/code");
}
