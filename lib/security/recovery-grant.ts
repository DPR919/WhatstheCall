import { createHmac, timingSafeEqual } from "node:crypto";

export const RECOVERY_SECONDS = 15 * 60;
export type RecoveryGrant = { userId: string; sessionId: string; expires: number; phase: "password" | "signout" };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export function signRecoveryGrant(secret: string, grant: RecoveryGrant): string {
  const payload = Buffer.from(JSON.stringify(grant)).toString("base64url");
  const signature = createHmac("sha256", secret).update(`password-recovery-v1\0${payload}`).digest("base64url");
  return `${payload}.${signature}`;
}

export function readRecoveryGrant(secret: string, value: string | undefined, now = Date.now()): RecoveryGrant | null {
  if (!value || value.length > 2048) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const expected = createHmac("sha256", secret).update(`password-recovery-v1\0${parts[0]}`).digest();
  const actual = Buffer.from(parts[1], "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const grant = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!uuid.test(grant.userId) || !uuid.test(grant.sessionId) ||
      !Number.isSafeInteger(grant.expires) || grant.expires <= now ||
      grant.expires > now + RECOVERY_SECONDS * 1000 || !["password", "signout"].includes(grant.phase)) return null;
    return grant;
  } catch { return null; }
}

export function matchesRecoverySession(grant: RecoveryGrant, userId: string, sessionId: unknown): boolean {
  return grant.userId === userId && grant.sessionId === sessionId;
}
