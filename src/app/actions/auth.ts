"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { getSessionUserId, requireRole, requireUser } from "@/lib/auth/dal";
import {
  createPairingCode,
  redeemPairingCode,
  linkToSelf,
  removeLink,
} from "@/lib/auth/pairing";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { allowAttempt } from "@/lib/auth/rate-limit";
import { homeFor } from "@/lib/auth/routes";
import {
  LoginFormSchema,
  NAME_MAX_LENGTH,
  PairingCodeFormSchema,
  ProfileFormSchema,
  SetRoleFormSchema,
  SignupFormSchema,
} from "@/lib/auth/schemas";
import { createSession, deleteSession } from "@/lib/auth/session";
import { getCollections, isDuplicateKey } from "@/lib/db/mongo";
import type { FormState } from "@/types/auth";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function signup(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = {
    email: text(formData, "email"),
  };

  const parsed = SignupFormSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      errors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }

  const { email, password } = parsed.data;
  // A placeholder until the person sets their real name in settings.
  const name = email.split("@")[0].slice(0, NAME_MAX_LENGTH) || "Хэрэглэгч";
  const { users } = await getCollections();
  const id = crypto.randomUUID();

  try {
    await users.insertOne({
      _id: id,
      email,
      passwordHash: await hashPassword(password),
      name,
      phone: null,
      createdAt: new Date(),
    });
  } catch (error) {
    if (isDuplicateKey(error)) {
      return {
        errors: {
          email: ["Энэ имэйл бүртгэлтэй байна."],
        },
        values,
      };
    }

    throw error;
  }

  // The guardian and child sides of a new account are already linked, with no code.
  await linkToSelf(id);
  // The role is picked per device on the home page, not stored on the account.
  await createSession(id);
  redirect("/role");
}

export async function login(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = {
    email: text(formData, "email"),
  };

  const parsed = LoginFormSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      errors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }

  const { email, password } = parsed.data;

  if (!(await allowAttempt(`login:${email}`, 10, 15 * 60_000))) {
    return {
      message: "Хэт олон оролдлоо. Хэсэг хүлээгээд дахин оролдоно уу.",
      values,
    };
  }

  const { users } = await getCollections();
  const user = await users.findOne({ email });

  const passwordMatches = await verifyPassword(
    password,
    user?.passwordHash ?? null,
  );

  if (!user || !passwordMatches) {
    return {
      message: "Имэйл эсвэл нууц үг буруу байна.",
      values,
    };
  }

  // The role is per device, so every login asks for it again on /role.
  await createSession(user._id);
  redirect("/role", "replace");
}

export async function logout(formData: FormData) {
  const userId = await getSessionUserId();
  const token = formData.get("pushToken");
  if (userId && typeof token === "string" && token.length >= 20 && token.length <= 4096) {
    try {
      const { pushTokens } = await getCollections();
      await pushTokens.deleteOne({ userId, token });
    } catch {
      // A logout must still complete when the database is briefly unavailable.
      console.error("SAFEPATH_LOGOUT_PUSH_TOKEN_CLEANUP_FAILED");
    }
  }
  await deleteSession();
  redirect("/login");
}

/**
 * Picks the role for this device only, so one account can be the guardian on one phone and
 * the child on another. Nothing about the role is stored on the account.
 */
export async function setRole(formData: FormData) {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const parsed = SetRoleFormSchema.safeParse({
    role: formData.get("role"),
  });

  if (!parsed.success) {
    redirect("/role");
  }

  const { role } = parsed.data;

  // Every account is both, so its guardian side always sees its own child side (idempotent).
  await linkToSelf(userId);
  await createSession(userId, role);

  // Push, not replace: the role picker stays in history so the back button returns to it.
  redirect(homeFor(role), "push");
}

/**
 * Saves the name and phone for the role this device acts as: the guardian's own, or the child's.
 * They are kept apart because one account is both, and each side shows the other's details.
 */
export async function updateProfile(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  if (!user.role) {
    redirect("/role");
  }

  const parsed = ProfileFormSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return {
      errors: z.flattenError(parsed.error).fieldErrors,
      values: { name: text(formData, "name"), phone: text(formData, "phone") },
    };
  }

  const { name, phone } = parsed.data;
  const { users } = await getCollections();
  await users.updateOne(
    { _id: user.id },
    {
      $set:
        user.role === "child"
          ? { childName: name, childPhone: phone }
          : { name, phone },
    },
  );

  revalidatePath("/guardian/link");
  revalidatePath("/tracker/code");
  revalidatePath("/guardian");

  return { success: "Хадгаллаа.", values: { name, phone } };
}

/** Child: show a code for a guardian to type in. */
export async function generatePairingCode(): Promise<FormState> {
  const child = await requireRole("child");

  const { code, expiresAt } = await createPairingCode(child.id);

  return {
    code,
    expiresAt: expiresAt.toISOString(),
  };
}

/** Guardian: type in the child's code to start watching them. */
export async function redeemCode(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const guardian = await requireRole("guardian");

  const parsed = PairingCodeFormSchema.safeParse({
    code: formData.get("code"),
  });

  if (!parsed.success) {
    return {
      errors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  if (!(await allowAttempt(`pair:${guardian.id}`, 10, 10 * 60_000))) {
    return {
      message: "Хэт олон оролдлоо. Хэсэг хүлээгээд дахин оролдоно уу.",
    };
  }

  const childId = await redeemPairingCode(
    parsed.data.code,
    guardian.id,
  );

  if (!childId) {
    return {
      message: "Код буруу эсвэл хугацаа нь дууссан байна.",
    };
  }

  revalidatePath("/guardian/link");

  return {
    success: "Амжилттай холбогдлоо.",
  };
}

/** Either side may end a link. */
export async function unlink(formData: FormData) {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  await removeLink(text(formData, "linkId"), userId);

  revalidatePath("/guardian/link");
  revalidatePath("/tracker/code");
}
