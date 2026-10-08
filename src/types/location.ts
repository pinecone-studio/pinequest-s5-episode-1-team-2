/** A document in `locations`: the latest position a child shared. `_id` is the child's user id, so there is one per child. */
export type LocationRecord = {
  _id: string;
  latitude: number;
  longitude: number;
  /** Metres, as reported by the phone. */
  accuracy: number;
  /**
   * When the phone measured this position, in server time (server clock minus the reading's age),
   * so neither a wrong phone clock nor a re-sent old reading can make it look fresh.
   */
  updatedAt: Date;
};

/** What a guardian's page receives for each linked child. */
export type ChildLocation = {
  childId: string;
  name: string;
  /** The child paused sharing on purpose. The position is then always null. */
  paused: boolean;
  /** null while the child is not sharing: paused, page closed, no reading yet, or nothing for a day. */
  position: { latitude: number; longitude: number; accuracy: number; updatedAt: string } | null;
};

/** The child's own view of their sharing: whether it is paused and how many guardians can see them. */
export type SharingState = {
  paused: boolean;
  watchers: number;
};
