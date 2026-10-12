import { getCurrentUser } from "@/lib/auth/dal";
import { allowAttempt } from "@/lib/auth/rate-limit";
import { createChildSosAlert } from "@/lib/safety-alerts";

export const runtime = "nodejs";

/** The signed-in child can explicitly alert their linked guardians. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Нэвтэрч орно уу." }, { status: 401 });
  if (user.role !== "child") {
    return Response.json({ error: "SOS дохиог зөвхөн хүүхдийн аккаунтаас илгээж болно." }, { status: 403 });
  }

  if (!(await allowAttempt(`sos:${user.id}`, 1, 30_000))) {
    return Response.json(
      { error: "SOS дохиог саяхан илгээсэн байна. Шинээр илгээхээс өмнө 30 секунд хүлээнэ үү." },
      { status: 429 },
    );
  }

  try {
    const result = await createChildSosAlert(user.id);
    if (result === "no-guardians") {
      return Response.json(
        { error: "Тантай холбогдсон асран хамгаалагч алга байна. Утасны тусламжийн дугаар руу залгана уу." },
        { status: 409 },
      );
    }

    return Response.json(
      { success: true, message: "SOS дохиог холбогдсон асран хамгаалагчдад илгээлээ." },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("SAFEPATH_SOS_CREATE_FAILED", error);
    return Response.json(
      { error: "SOS дохио илгээж чадсангүй. Сүлжээгээ шалгаад дахин оролдоно уу. Шууд аюул тулгарвал орон нутгийн яаралтай тусламжтай холбогдоно уу." },
      { status: 500 },
    );
  }
}
