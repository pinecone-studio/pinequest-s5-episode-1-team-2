"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { requireRole } from "@/lib/auth/dal";
import { CheckpointFormSchema, createCheckpoint, deleteCheckpoint, MAX_ACTIVE_CHECKPOINTS } from "@/lib/checkpoints";
import type { FormState } from "@/types/auth";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Guardian: give one of their children a place to reach, with a reward. */
export async function addCheckpoint(_state: FormState, formData: FormData): Promise<FormState> {
  const guardian = await requireRole("guardian");
  const values = { name: text(formData, "name") };
  const parsed = CheckpointFormSchema.safeParse({
    childId: formData.get("childId"),
    name: formData.get("name"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    radiusMeters: formData.get("radiusMeters"),
    reward: formData.get("reward"),
  });
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  const result = await createCheckpoint(guardian.id, parsed.data);
  if (result === "not-linked") return { message: "Энэ хүүхэд тантай холбогдоогүй байна.", values };
  if (result === "too-many") return { message: `Нэг хүүхдэд нэг дор хамгийн ихдээ ${MAX_ACTIVE_CHECKPOINTS} шалгах цэг өгөх боломжтой.`, values };

  revalidatePath("/guardian/checkpoints");
  return { success: "Шалгах цэг нэмэгдлээ." };
}

/** Guardian: remove a checkpoint. */
export async function removeCheckpoint(formData: FormData) {
  const guardian = await requireRole("guardian");
  await deleteCheckpoint(guardian.id, text(formData, "checkpointId"));
  revalidatePath("/guardian/checkpoints");
}
