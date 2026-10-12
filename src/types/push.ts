/** A push token belongs to one app installation and one currently selected device role. */
export type PushPlatform = "android" | "ios";
export type PushRole = "guardian" | "child";

export type PushTokenRecord = {
  _id: string;
  token: string;
  userId: string;
  role: PushRole;
  platform: PushPlatform;
  updatedAt: Date;
};
