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
