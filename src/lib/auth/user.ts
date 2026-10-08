import type { User, UserRecord } from "@/types/auth";

/** Copies only the fields the browser may see, so the password hash never leaves the server. */
export function toUser(record: UserRecord): User {
  return {
    id: record._id,
    email: record.email,
    name: record.name,
    phone: record.phone,
    role: record.role,
    createdAt: record.createdAt,
  };
}
