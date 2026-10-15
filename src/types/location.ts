import type { SafeZone } from "@/types/safety";
import type { SceneLandmarkKind } from "@/types/vision";

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

/** A document in seenLandmarks: a notable place the child's camera saw on the way. */
export type SeenLandmarkRecord = {
  _id: string;
  childId: string;
  label: string;
  detail: string;
  kind: SceneLandmarkKind;
  /** Roughly where the place is: a short way from the child, in the direction the camera faced. */
  latitude: number;
  longitude: number;
  seenAt: Date;
};

/** A seen landmark as the guardian's page receives it. */
export type SeenLandmark = {
  id: string;
  label: string;
  detail: string;
  kind: SceneLandmarkKind;
  latitude: number;
  longitude: number;
  seenAt: string;
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
  /** Notable places the child's camera saw in the last day, newest first. */
  landmarks: SeenLandmark[];
  /** Estimated speed in km/h, when enough location data is available. */
  speedKmh?: number | null;
};

/** The child's own view of their sharing. */
export type SharingState = {
  paused: boolean;
  watchers: number;
};
