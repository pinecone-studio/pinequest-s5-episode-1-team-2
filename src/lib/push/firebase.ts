import { importPKCS8, SignJWT } from "jose";
import { getCollections } from "@/lib/db/mongo";
import type { SafetyAlertType } from "@/types/alerts";
import { SAFETY_NOTIFICATION_CHANNEL_ID, SOS_NOTIFICATION_CHANNEL_ID } from "@/lib/push/channels";

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_TOKENS_PER_EVENT = 50;

type FcmConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

type SafetyPushInput = {
  alertId: string;
  type: SafetyAlertType;
  message: string;
};

type CachedToken = { token: string; expiresAt: number };
const globalForFcm = globalThis as typeof globalThis & {
  fcmAccessToken?: CachedToken;
  fcmAccessTokenPromise?: Promise<string>;
};

function getConfig(): FcmConfig | null {
  const projectId = process.env.FCM_PROJECT_ID?.trim();
  const clientEmail = process.env.FCM_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

async function mintAccessToken(config: FcmConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const signingKey = await importPKCS8(config.privateKey, "RS256");
  const assertion = await new SignJWT({ scope: FCM_SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(config.clientEmail)
    .setAudience(GOOGLE_TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3_600)
    .sign(signingKey);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as
    | { access_token?: unknown; expires_in?: unknown }
    | null;
  if (!response.ok || typeof data?.access_token !== "string") {
    throw new Error("FCM_ACCESS_TOKEN_FAILED");
  }

  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3_600;
  globalForFcm.fcmAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1_000,
  };
  return data.access_token;
}

async function getAccessToken(config: FcmConfig): Promise<string> {
  const cached = globalForFcm.fcmAccessToken;
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;
  if (globalForFcm.fcmAccessTokenPromise) return globalForFcm.fcmAccessTokenPromise;

  const pending = mintAccessToken(config);
  globalForFcm.fcmAccessTokenPromise = pending;
  try {
    return await pending;
  } finally {
    if (globalForFcm.fcmAccessTokenPromise === pending) {
      globalForFcm.fcmAccessTokenPromise = undefined;
    }
  }
}

function pushTitle(type: SafetyAlertType) {
  if (type === "SOS") return "🆘 SafePath — SOS";
  if (type === "ZONE_EXIT" || type === "OUTSIDE_SAFE_ZONES") return "SafePath — Аюулгүй бүсийн дохио";
  return "SafePath — Аюулгүй бүс";
}

type GuardianPush = {
  title: string;
  body: string;
  /** Read by the app when the notification is tapped. Values must be strings. */
  data: Record<string, string>;
  channelId: string;
  priority: "HIGH" | "NORMAL";
};

/**
 * Best-effort Android/iOS FCM delivery to guardian-role devices currently linked to a child.
 * Callers never include exact GPS coordinates in the notification payload.
 */
async function pushToGuardians(childId: string, push: GuardianPush) {
  const config = getConfig();
  if (!config) return { status: "not-configured" as const, sent: 0, attempted: 0 };

  const { guardianLinks, pushTokens } = await getCollections();
  const links = await guardianLinks.find({ childId }, { projection: { guardianId: 1 } }).toArray();
  const guardianIds = [...new Set(links.map((link) => link.guardianId))];
  if (guardianIds.length === 0) return { status: "no-guardians" as const, sent: 0, attempted: 0 };

  const tokens = await pushTokens.find({ userId: { $in: guardianIds }, role: "guardian" })
    .sort({ updatedAt: -1 })
    .limit(MAX_TOKENS_PER_EVENT)
    .toArray();
  if (tokens.length === 0) return { status: "no-devices" as const, sent: 0, attempted: 0 };

  const accessToken = await getAccessToken(config);
  const endpoint = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/messages:send`;
  let sent = 0;

  await Promise.all(tokens.map(async (device) => {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          message: {
            token: device.token,
            notification: {
              title: push.title,
              body: push.body.slice(0, 200),
            },
            data: { ...push.data, childId, target: "guardian" },
            android: {
              priority: push.priority,
              ttl: "300s",
              notification: {
                channel_id: push.channelId,
                sound: "default",
              },
            },
          },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });

      if (response.ok) {
        sent += 1;
        return;
      }

      // Prune a token only when FCM explicitly identifies it as unregistered.
      const data = (await response.json().catch(() => null)) as {
        error?: { details?: Array<{ errorCode?: string }> };
      } | null;
      const isUnregistered = data?.error?.details?.some((detail) => detail.errorCode === "UNREGISTERED") ?? false;
      if (isUnregistered) {
        await pushTokens.deleteOne({ _id: device._id });
      }
    } catch {
      // Try other registered devices if this one is offline or FCM times out.
    }
  }));

  return { status: sent === tokens.length ? "sent" as const : sent > 0 ? "partial" as const : "failed" as const, sent, attempted: tokens.length };
}

/** A safety alert (SOS, zone, battery) to the child's guardians. */
export async function sendSafetyAlertPush(childId: string, alert: SafetyPushInput) {
  return pushToGuardians(childId, {
    title: pushTitle(alert.type),
    body: alert.message,
    data: { type: "SAFETY_ALERT", alertId: alert.alertId, alertType: alert.type },
    channelId: alert.type === "SOS" ? SOS_NOTIFICATION_CHANNEL_ID : SAFETY_NOTIFICATION_CHANNEL_ID,
    priority: alert.type === "ZONE_ENTER" ? "NORMAL" : "HIGH",
  });
}

/** Good news for the guardians: the child walked to a checkpoint they set and won its reward. */
export async function sendCheckpointReachedPush(childId: string, checkpointName: string) {
  return pushToGuardians(childId, {
    title: "SafePath — Шагналтай газар",
    body: `Хүүхэд ${checkpointName} хүртэл алхаж очоод шагналаа авлаа.`,
    data: { type: "CHECKPOINT_REACHED" },
    channelId: SAFETY_NOTIFICATION_CHANNEL_ID,
    priority: "NORMAL",
  });
}
