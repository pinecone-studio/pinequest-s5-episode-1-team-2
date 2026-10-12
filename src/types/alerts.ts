export type SafetyAlertType = "OUTSIDE_SAFE_ZONES" | "ZONE_EXIT" | "ZONE_ENTER" | "SOS";

/** The latest known geofence state for one child's location sharing. */
export type GeofenceStateRecord = {
  _id: string;
  childId: string;
  isInside: boolean;
  insideZoneId: string | null;
  updatedAt: Date;
};

/** A small safety event; coordinates are deliberately not copied into the event history. */
export type SafetyAlertRecord = {
  _id: string;
  childId: string;
  type: SafetyAlertType;
  /** Unique transition identity; makes overlapping location reports idempotent. */
  transitionKey: string;
  zoneName?: string;
  message: string;
  createdAt: Date;
  readBy: string[];
};

/** Safe response shape returned to one authenticated guardian. */
export type GuardianSafetyAlert = {
  id: string;
  childId: string;
  childName: string;
  type: SafetyAlertType;
  zoneName: string | null;
  message: string;
  createdAt: string;
  read: boolean;
};
