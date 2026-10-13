import { GoogleGenAI } from "@google/genai";
import { getSessionUserId } from "@/lib/auth/dal";
import { allowAttempt } from "@/lib/auth/rate-limit";

export const runtime = "nodejs";

const MAX_DATA_URL_LENGTH = 1_500_000;
const DEFAULT_VISION_MODEL = "gemini-3.8-flash";

const SCENE_SYSTEM_PROMPT = `Та SafePath нэртэй хүүхэд, гэр бүлийн аюулгүй навигацийн аппын орчны тайлбарлагч AI.
Нэг кадрт бодитоор ХАРАГДАЖ байгаа зүйлсийг л тайлбарла: явган зам, гарц, гэрлэн дохио, автобусны буудал, тэмдэг, барилга зэрэг.
Монгол кириллээр 1-3 богино өгүүлбэр, нийт 350 тэмдэгтээс ихгүй хариул.
Зураг бүдэг, харанхуй эсвэл тодорхой бус бол үүнийг шууд хэл; таамгаар нэр, хаяг, гудамж, байршил, зай, чиглэл зохиож болохгүй.
Машин эсвэл зам харагдвал зөвхөн зурагт үндэслэн гарцаар гарах нь аюулгүй гэж хэзээ ч бүү хэл. Хүүхдэд замын захад зогсож, дохио болон асран хамгаалагчийн зааврыг шалгахыг сануул.
GPS болон тооцоолсон маршрут үндсэн чиглүүлэгч хэвээр; зураг дангаараа бодит байршил, замын аюулгүй байдлыг баталж чадахгүй.`;

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return Response.json({ error: "Нэвтрэх шаардлагатай. SafePath-д дахин нэвтэрнэ үү." }, { status: 401 });
  }

  let allowed = false;
  try {
    allowed = await allowAttempt(`vision:${userId}`, 10, 60_000);
  } catch {
    return Response.json({ error: "Үйлчилгээнд түр холбогдож чадсангүй. Дахин оролдоно уу." }, { status: 503 });
  }
  if (!allowed) {
    return Response.json({ error: "Орчин таних хүсэлт олширлоо. Нэг минутын дараа дахин оролдоно уу." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Зургийн хүсэлт буруу байна." }, { status: 400 });
  }

  if (!isRecord(body) || typeof body.image !== "string" || body.image.length > MAX_DATA_URL_LENGTH) {
    return Response.json({ error: "Зураг хоосон эсвэл хэт том байна. Дахин зураг авч үзнэ үү." }, { status: 413 });
  }

  const imageMatch = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(body.image);
  if (!imageMatch) {
    return Response.json({ error: "Зөвхөн JPEG, PNG эсвэл WebP зураг дэмжинэ." }, { status: 400 });
  }

  const instruction = typeof body.instruction === "string"
    ? body.instruction.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 160)
    : "";
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json({ error: "AI үйлчилгээ тохируулаагүй байна. Сервер дээр GEMINI_API_KEY тохируулна уу." }, { status: 503 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_VISION_MODEL?.trim() || DEFAULT_VISION_MODEL,
      contents: [
        {
          text: `${SCENE_SYSTEM_PROMPT}\n\nОдоогийн маршрутын заавар (зөвхөн хамааралтай бол ашигла, зурагт харагдахгүй зүйл нэмж бүү хэл): ${instruction || "өгөөгүй"}`,
        },
        {
          inlineData: {
            mimeType: imageMatch[1],
            data: imageMatch[2],
          },
        },
      ],
      config: {
        temperature: 0.2,
        maxOutputTokens: 180,
      },
    });

    const description = normalizeDescription(response.text);
    if (!description) {
      return Response.json({ error: "Зургаас тодорхой тайлбар гаргаж чадсангүй. Гэрэл сайтай газар дахин оролдоно уу." }, { status: 502 });
    }

    return Response.json({ description });
  } catch (error) {
    console.error("VISION_DESCRIPTION_ERROR:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "AI орчныг таних үйлчилгээ түр ажиллахгүй байна. Интернетээ шалгаад дахин оролдоно уу." }, { status: 502 });
  }
}

function normalizeDescription(value: string | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text || text.length > 500 || !/\p{Script=Cyrillic}/u.test(text)) return null;
  return text.slice(0, 350);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
