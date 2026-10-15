import { GoogleGenAI } from "@google/genai";
import { getSessionUserId } from "@/lib/auth/dal";
import { allowAttempt } from "@/lib/auth/rate-limit";
import { SCENE_LANDMARK_KINDS, SCENE_LANDMARK_SIDES, type SceneLandmark } from "@/types/vision";

export const runtime = "nodejs";

const MAX_DATA_URL_LENGTH = 1_500_000;
// Flash-lite answers in about two seconds with accurate boxes; the larger model is only a fallback.
const DEFAULT_VISION_MODEL = "gemini-3.5-flash-lite";
const FALLBACK_VISION_MODEL = "gemini-3.8-flash";
const PRIMARY_TIMEOUT_MS = 10_000;
const FALLBACK_TIMEOUT_MS = 8_000;

const MAX_LANDMARKS = 4;

const SCENE_SYSTEM_PROMPT = `Та SafePath нэртэй хүүхэд, гэр бүлийн аюулгүй навигацийн аппын орчны тайлбарлагч AI.
Таны тайлбарыг жижиг хүүхэд болон ахмад настан уншина. Маш энгийн, богино, ойлгомжтой үг хэрэглэ. Нарийн нэр томьёо, англи үг, тоо хэмжээ бүү хэрэглэ.
Нэг кадрт бодитоор ХАРАГДАЖ байгаа зүйлсийг л тайлбарла: барилга, дэлгүүр, сургууль, эмнэлэг, автобусны буудал, гарц, гэрлэн дохио, цэцэрлэгт хүрээлэн, тэмдэг зэрэг.
Хамгийн тод харагдаж, замаа олоход туслах ${MAX_LANDMARKS} хүртэлх зүйлийг "landmarks" жагсаалтад ойроос нь эхлэн оруул. Барилгыг заавал оруул. Машин, хүн, амьтан зэрэг хөдөлдөг зүйлсийг landmarks-д бүү оруул.
- "label": 2-3 үгтэй, 24 тэмдэгтээс богино нэр. Самбар, бичиг нь тод уншигдаж байвал түүн дээрх нэрийг яг тэр чигээр нь бич (жишээ: "Номин супермаркет"). Уншигдахгүй бол өнгө, хэлбэрээр нь нэрлэ (жишээ: "Шар өнгийн өндөр байр", "Улаан дээвэртэй байшин").
- "detail": хүүхэд ч таньж чадах нэг тод шинж, 60 тэмдэгтээс богино (жишээ: "Цэнхэр самбартай, том цонхтой").
- "kind": building, shop, school, hospital, bus_stop, crossing, traffic_light, park, sign, other-оос нэгийг сонго.
- "side": зураг дээр зүүн тал бол left, голд бол center, баруун тал бол right.
- "box_2d": тухайн зүйлийг хүрээлсэн дөрвөлжин [ymin, xmin, ymax, xmax], 0-1000 хооронд хэвийн болгосон.
"summary": Монгол кириллээр 1-2 богино өгүүлбэр, нийт 200 тэмдэгтээс ихгүй. Ойролцоох тод барилгыг ашиглан хаашаа явахыг энгийнээр хэл (жишээ: "Шар байрны хажуугаар чигээрээ яваарай.").
Зураг бүдэг, харанхуй эсвэл тодорхой бус бол summary-д үүнийг шууд хэлж, landmarks-ийг хоосон үлдээ; таамгаар нэр, хаяг, гудамж, байршил, зай, чиглэл зохиож болохгүй.
Доорх GPS маршрут нь чиглүүлэлтийн үндсэн эх сурвалж. Зурагт харагдахгүй зүйлсийг маршруттай холбоотой гэж бүү дүгнэ, GPS зааврыг өөрчилж болохгүй. Зураг маршрутын замтай таарч байгаа эсэх тодорхойгүй бол тодорхойгүй гэдгийг хэл.
Машин эсвэл зам харагдвал зөвхөн зурагт үндэслэн гарцаар гарах нь аюулгүй гэж хэзээ ч бүү хэл. Хүүхдэд замын захад зогсож, дохио болон асран хамгаалагчийн зааврыг шалгахыг сануул.
GPS болон тооцоолсон маршрут үндсэн чиглүүлэгч хэвээр; зураг дангаараа бодит байршил, замын аюулгүй байдлыг баталж чадахгүй.`;

const SCENE_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    landmarks: {
      type: "array",
      maxItems: MAX_LANDMARKS,
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          detail: { type: "string" },
          kind: { type: "string", enum: [...SCENE_LANDMARK_KINDS] },
          side: { type: "string", enum: [...SCENE_LANDMARK_SIDES] },
          box_2d: { type: "array", items: { type: "number" }, minItems: 4, maxItems: 4 },
        },
        required: ["label", "detail", "kind", "side", "box_2d"],
      },
    },
  },
  required: ["summary", "landmarks"],
};

type SceneRouteContext = {
  instruction: string;
  destinationName: string;
  remainingDistanceMeters: number | null;
  targetBearingDegrees: number | null;
  deviceHeadingDegrees: number | null;
  relativeBearingDegrees: number | null;
  routeReady: boolean;
};

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
  const routeContext = readSceneRouteContext(body.routeContext);
  const routeContextPrompt = routeContext
    ? [
        "GPS ROUTE CONTEXT (metadata only; it is not evidence about what the camera sees):",
        `Official route instruction: ${routeContext.instruction || instruction || "not available"}`,
        `Destination label: ${routeContext.destinationName || "safe destination"}`,
        `Remaining route distance in meters: ${routeContext.remainingDistanceMeters === null ? "unknown" : Math.round(routeContext.remainingDistanceMeters)}`,
        `Route shape available: ${routeContext.routeReady ? "yes" : "no"}`,
        `Bearing from current location toward route look-ahead point in degrees from north: ${routeContext.targetBearingDegrees === null ? "unknown" : Math.round(routeContext.targetBearingDegrees)}`,
        `Device compass heading in degrees: ${routeContext.deviceHeadingDegrees === null ? "unknown" : Math.round(routeContext.deviceHeadingDegrees)}`,
        `Route direction relative to device heading in degrees (-180 left / +180 right): ${routeContext.relativeBearingDegrees === null ? "unknown" : Math.round(routeContext.relativeBearingDegrees)}`,
        "Use this context only to make the visual description relevant. Do not invent route landmarks or claim the visible path is the calculated route unless unmistakable.",
      ].join("\n")
    : `Одоогийн маршрутын заавар (зөвхөн хамааралтай бол ашигла, зурагт харагдахгүй зүйл нэмж бүү хэл): ${instruction || "өгөөгүй"}`;
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json({ error: "AI үйлчилгээ тохируулаагүй байна. Сервер дээр GEMINI_API_KEY тохируулна уу." }, { status: 503 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const primaryModel = process.env.GEMINI_VISION_MODEL?.trim() || DEFAULT_VISION_MODEL;
    const describeWith = (model: string, timeoutMs: number) => ai.models.generateContent({
      model,
      contents: [
        {
          text: `${SCENE_SYSTEM_PROMPT}\n\n${routeContextPrompt}`,
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
        maxOutputTokens: 900,
        responseMimeType: "application/json",
        responseJsonSchema: SCENE_RESPONSE_SCHEMA,
        // An overloaded model can hang for minutes; give up quickly so the person is not left waiting.
        abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(timeoutMs)]),
      },
    });

    let response;
    try {
      response = await describeWith(primaryModel, PRIMARY_TIMEOUT_MS);
    } catch (error) {
      if (request.signal.aborted || primaryModel === FALLBACK_VISION_MODEL) throw error;
      console.warn("VISION_PRIMARY_MODEL_FAILED:", error instanceof Error ? error.message : "unknown error");
      response = await describeWith(FALLBACK_VISION_MODEL, FALLBACK_TIMEOUT_MS);
    }

    const { description, landmarks } = parseSceneResponse(response.text);
    if (!description) {
      return Response.json({ error: "Зургаас тодорхой тайлбар гаргаж чадсангүй. Гэрэл сайтай газар дахин оролдоно уу." }, { status: 502 });
    }

    return Response.json({
      description,
      landmarks,
      // Return validated GPS context separately from AI's visual observations so the UI
      // can display the navigation engine's instruction without asking vision to invent it.
      routeContext: routeContext
        ? {
            instruction: routeContext.instruction || instruction,
            destinationName: routeContext.destinationName,
            remainingDistanceMeters: routeContext.remainingDistanceMeters,
            relativeBearingDegrees: routeContext.relativeBearingDegrees,
          }
        : null,
    });
  } catch (error) {
    console.error("VISION_DESCRIPTION_ERROR:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "AI орчныг таних үйлчилгээ түр ажиллахгүй байна. Интернетээ шалгаад дахин оролдоно уу." }, { status: 502 });
  }
}

function readSceneRouteContext(value: unknown): SceneRouteContext | null {
  if (!isRecord(value)) return null;

  const cleanText = (input: unknown, limit: number) =>
    typeof input === "string"
      ? input.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit)
      : "";
  const boundedNumber = (input: unknown, min: number, max: number): number | null =>
    typeof input === "number" && Number.isFinite(input) && input >= min && input <= max
      ? input
      : null;

  return {
    instruction: cleanText(value.instruction, 160),
    destinationName: cleanText(value.destinationName, 80),
    remainingDistanceMeters: boundedNumber(value.remainingDistanceMeters, 0, 10_000_000),
    targetBearingDegrees: boundedNumber(value.targetBearingDegrees, 0, 360),
    deviceHeadingDegrees: boundedNumber(value.deviceHeadingDegrees, 0, 360),
    relativeBearingDegrees: boundedNumber(value.relativeBearingDegrees, -180, 180),
    routeReady: value.routeReady === true,
  };
}

function normalizeDescription(value: string | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text || text.length > 500 || !/\p{Script=Cyrillic}/u.test(text)) return null;
  return text.slice(0, 350);
}

// Structured reply: a short spoken summary plus the landmarks to pin on the frozen frame.
function parseSceneResponse(value: string | undefined): { description: string | null; landmarks: SceneLandmark[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value ?? "");
  } catch {
    // Some model versions ignore the JSON mode; plain Mongolian text is still a usable description.
    return { description: normalizeDescription(value), landmarks: [] };
  }
  if (!isRecord(parsed)) return { description: null, landmarks: [] };

  const description = normalizeDescription(typeof parsed.summary === "string" ? parsed.summary : undefined);
  const landmarks = Array.isArray(parsed.landmarks)
    ? parsed.landmarks.map(readLandmark).filter((landmark): landmark is SceneLandmark => landmark !== null).slice(0, MAX_LANDMARKS)
    : [];
  return { description, landmarks };
}

function readLandmark(value: unknown): SceneLandmark | null {
  if (!isRecord(value)) return null;
  const cleanText = (input: unknown, limit: number) =>
    typeof input === "string" ? input.replace(/\s+/g, " ").trim().slice(0, limit) : "";

  const label = cleanText(value.label, 48);
  if (!label) return null;

  const kind = SCENE_LANDMARK_KINDS.find((candidate) => candidate === value.kind) ?? "other";
  const box = readBox(value.box_2d);
  // The box is more reliable than the model's own left/right word, so derive the side from it when present.
  const side = box
    ? sideFromBox(box)
    : SCENE_LANDMARK_SIDES.find((candidate) => candidate === value.side) ?? "center";
  return { label, detail: cleanText(value.detail, 80), kind, side, box };
}

function sideFromBox([, xmin, , xmax]: [number, number, number, number]): SceneLandmark["side"] {
  const centerX = (xmin + xmax) / 2;
  if (centerX < 333) return "left";
  if (centerX > 667) return "right";
  return "center";
}

function readBox(value: unknown): SceneLandmark["box"] {
  if (!Array.isArray(value) || value.length !== 4) return null;
  if (!value.every((entry) => typeof entry === "number" && Number.isFinite(entry))) return null;
  const [ymin, xmin, ymax, xmax] = (value as number[]).map((entry) => Math.min(1000, Math.max(0, Math.round(entry))));
  if (ymax - ymin < 10 || xmax - xmin < 10) return null;
  return [ymin, xmin, ymax, xmax];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
