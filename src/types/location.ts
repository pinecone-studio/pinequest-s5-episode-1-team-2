import type { SafeZone } from "@/types/safety";

/** A document in locations: the latest position a child shared. */
export type LocationRecord = {
  _id: string;
  latitude: number;
  longitude: number;
  /** Metres, as reported by the phone. */
  accuracy: number;
  updatedAt: Date;
};

/** A place a guardian marked as safe for one child. */
export type SafeZoneRecord = {
  _id: string;
  childId: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  createdBy: string;
  createdAt: Date;
};

/** What a guardian's page receives for each linked child. */
export type ChildLocation = {
  childId: string;
  name: string;
  zones: SafeZone[];
  paused: boolean;
  position: {
    latitude: number;
    longitude: number;
    accuracy: number;
    updatedAt: string;
  } | null;
  /** Estimated speed in km/h, when enough location data is available. */
  speedKmh?: number | null;
};

/** The child's own view of their sharing. */
export type SharingState = {
  paused: boolean;
  watchers: number;
};
