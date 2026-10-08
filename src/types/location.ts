/** A document in `locations`: the latest position a child shared. `_id` is the child's user id, so there is one per child. */
export type LocationRecord = {
  _id: string;
  latitude: number;
  longitude: number;
  /** Metres, as reported by the phone. */
  accuracy: number;
  /** When the server received it, so a wrong phone clock cannot make an old position look fresh. */
  updatedAt: Date;
};
