export const ROLES = ["guardian", "child"] as const;

/** "child" is the person who talks to Milo (the "Хэрэглэгч" card on /role). */
export type Role = (typeof ROLES)[number];

/**
 * A document in `users`. Server-only: it holds the password hash, so never send it
 * to the browser. Convert it with `toUser` first.
 */
export type UserRecord = {
  /** crypto.randomUUID(), not an ObjectId, so ids are plain strings everywhere. */
  _id: string;
  /** Unique and lowercased. */
  email: string;
  passwordHash: string;
  /** The name Milo uses (today: AssistantSettings.userName). */
  name: string;
  /** For the call buttons, which hard-code tel:+97600000000 today. Include the country code. */
  phone: string | null;
  /** null until the user picks one after their first login. */
  role: Role | null;
  /** The child paused location sharing. Missing means not paused, so older accounts need no update. */
  locationPaused?: boolean;
  createdAt: Date;
};

/** What the browser may see. */
export type User = Pick<UserRecord, "email" | "name" | "phone" | "role" | "createdAt"> & {
  id: string;
};

/** A document in `guardianLinks`. A guardian can read a child's data only while it exists. Revoking deletes it. */
export type GuardianLink = {
  _id: string;
  guardianId: string;
  childId: string;
  createdAt: Date;
};

/**
 * A document in `pairingCodes`. Shown on the child's phone and typed on the guardian's.
 * Redeeming deletes it, so it works once. `_id` is the child's user id, so a child has only one code.
 */
export type PairingCode = {
  _id: string;
  code: string;
  expiresAt: Date;
};

/** The only thing stored in the login cookie. The role is read from the database instead. */
export type SessionPayload = {
  userId: string;
};

/** A document in `rateLimits`: how many attempts a key made since the window opened. */
export type RateLimit = {
  _id: string;
  count: number;
  resetAt: Date;
};

/** What a form action returns to its form (via useActionState). Never contains passwords. */
export type FormState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
      /** Text fields to put back in the form after an error. */
      values?: Record<string, string>;
      code?: string;
      expiresAt?: string;
      success?: string;
    }
  | undefined;
