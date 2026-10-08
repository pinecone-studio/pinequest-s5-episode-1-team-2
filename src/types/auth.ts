export const ROLES = ["guardian", "child"] as const;

/** "child" is the person who talks to Milo (the "Хэрэглэгч" card on /role). */
export type Role = (typeof ROLES)[number];

/** A `users` row. Server-only: it holds the password hash, so never send it to the browser. */
export type UserRecord = {
  id: string;
  /** Unique and lowercased. */
  email: string;
  passwordHash: string;
  /** The name Milo uses (today: AssistantSettings.userName). */
  name: string;
  /** For the call buttons, which hard-code tel:+97600000000 today. Include the country code. */
  phone: string | null;
  /** null until the user picks one after their first login. */
  role: Role | null;
  createdAt: Date;
};

/** What the browser may see. */
export type User = Omit<UserRecord, "passwordHash">;

/** A guardian can read a child's data only while this row exists. Revoking deletes it. */
export type GuardianLink = {
  id: string;
  guardianId: string;
  childId: string;
  createdAt: Date;
};

/** Shown on the child's phone and typed on the guardian's. Redeeming deletes it, so it works once. */
export type PairingCode = {
  code: string;
  childId: string;
  expiresAt: Date;
};
