import { z } from "zod";
import type { RecoveryGrant } from "./recovery-grant.ts";

export const recoveryPasswordSchema = z.object({ password: z.string().min(12).max(128), confirmPassword: z.string().min(12).max(128) })
  .refine((value) => value.password === value.confirmPassword);

type Dependencies = {
  updatePassword: (password: string) => Promise<{ error: unknown }>;
  markChanged: () => Promise<void>;
  revokeSessions: () => Promise<{ error: unknown }>;
  clearSession: () => Promise<void>;
};

// Kept independent of HTTP/cookie transport so failure ordering is testable.
export async function completeRecovery(grant: RecoveryGrant, requiresMfa: boolean, body: unknown, dependencies: Dependencies) {
  if (requiresMfa) return { status: 403, body: { error: "Verify your authenticator before changing your password." } };
  if (grant.phase === "password") {
    const parsed = recoveryPasswordSchema.safeParse(body);
    if (!parsed.success) return { status: 400, body: { error: "Use matching passwords between 12 and 128 characters." } };
    const { error } = await dependencies.updatePassword(parsed.data.password);
    if (error) return { status: 400, body: { error: "That password could not be accepted. Choose a different password, or request a fresh recovery link." } };
    await dependencies.markChanged();
  }
  let revokeFailed = false;
  try { revokeFailed = !!(await dependencies.revokeSessions()).error; }
  catch { revokeFailed = true; }
  if (revokeFailed) return { status: 503, body: { passwordChanged: true,
    error: "Your password was updated, but we could not finish signing out your sessions. Please retry to finish." } };
  await dependencies.clearSession();
  return { status: 200, body: { success: true, redirectTo: "/login?passwordReset=success" } };
}
