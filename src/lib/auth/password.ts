import bcrypt from "bcryptjs";

const COST = 10;

// Checked against when no account matches, so "no such email" takes as long as "wrong password".
const dummyHash = bcrypt.hash("not-a-real-password", COST);

export function hashPassword(password: string) {
  return bcrypt.hash(password, COST);
}

/** Pass null when the account does not exist; the result is then always false. */
export async function verifyPassword(password: string, hash: string | null) {
  const matches = await bcrypt.compare(password, hash ?? (await dummyHash));
  return matches && hash !== null;
}
