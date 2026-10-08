"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createZone, deleteZone, MAX_ZONES_PER_CHILD, ZoneFormSchema } from "@/lib/child-zones";
import type { FormState } from "@/types/auth";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Guardian: add a safe zone for one of their children. */
export async function addZone(_state: FormState, formData: FormData): Promise<FormState> {
  const guardian = await requireRole("guardian");
  const values = { name: text(formData, "name") };
  const parsed = ZoneFormSchema.safeParse({
    childId: formData.get("childId"),
    name: formData.get("name"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    radiusMeters: formData.get("radiusMeters"),
  });
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  const result = await createZone(guardian.id, parsed.data);
  if (result === "not-linked") return { message: "Энэ хүүхэд тантай холбогдоогүй байна.", values };
  if (result === "too-many") return { message: `Нэг хүүхдэд хамгийн ихдээ ${MAX_ZONES_PER_CHILD} бүс нэмэх боломжтой.`, values };

  revalidatePath("/guardian/zones");
  return { success: "Бүс нэмэгдлээ." };
}

/** Guardian: delete one of their children's safe zones. */
export async function removeZone(formData: FormData) {
  const guardian = await requireRole("guardian");
  await deleteZone(guardian.id, text(formData, "zoneId"));
  revalidatePath("/guardian/zones");
}
