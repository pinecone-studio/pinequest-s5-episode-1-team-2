import type { Binary } from "mongodb";
import type { SafeZone } from "@/types/safety";
import type { SceneLandmarkKind } from "@/types/vision";
import type { RewardId } from "@/types/rewards";

/** A document in locations: the latest position a child shared. */
export type LocationRecord = {
  _id: string;
  latitude: number;
  longitude: number;
  /** Metres, as reported by the phone. */
  accuracy: number;
  /** Battery charge 0–1 at the time of the report, when the phone shares it. */
  batteryLevel?: number | null;
  charging?: boolean | null;
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

/** A document in checkpoints: a place a guardian asked the child to reach, with a reward for getting there. */
export type CheckpointRecord = {
  _id: string;
  childId: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  reward: RewardId;
  /** When the child's phone first reported a good fix inside; reaching needs them to stay a moment. */
  insideSince: Date | null;
  reachedAt: Date | null;
  createdBy: string;
  createdAt: Date;
};

/** A document in childRewards, keyed by child id: everything the child has earned. */
export type ChildRewardsRecord = {
  _id: string;
  items: RewardId[];
  updatedAt: Date;
};

/** A document in scenePhotos: what the child's camera saw when it opened. */
export type ScenePhotoRecord = {
  _id: string;
  childId: string;
  /** JPEG bytes, about 640 px on the long side. */
  image: Binary;
  latitude: number;
  longitude: number;
  takenAt: Date;
};

/** A checkpoint as the guardian's and child's pages receive it. */
export type Checkpoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  reward: RewardId;
  reachedAt: string | null;
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
    /** Battery charge 0–1 with the last report, so a guardian knows if the phone may switch off. */
    batteryLevel: number | null;
    charging: boolean | null;
  } | null;
  /** Notable places the child's camera saw in the last day, newest first. */
  landmarks: SeenLandmark[];
  /** The newest surroundings photo from the child's camera, if any in the last day. */
  photo: { id: string; takenAt: string } | null;
  /** Checkpoints the child has not reached yet, shown on the guardian's map. */
  checkpoints: Checkpoint[];
  /** Estimated speed in km/h, when enough location data is available. */
  speedKmh?: number | null;
};

/** The child's own view of their sharing. */
export type SharingState = {
  paused: boolean;
  watchers: number;
};
