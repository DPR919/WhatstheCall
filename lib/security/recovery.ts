import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { serverSecret } from "./secrets";
import { matchesRecoverySession, readRecoveryGrant, signRecoveryGrant, type RecoveryGrant } from "./recovery-grant";

const cookieName = process.env.NODE_ENV === "production" ? "__Secure-wtc-recovery" : "wtc-recovery";
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const,
  path: "/api/auth/password-recovery" };

export async function recoverySecret() {
  const secret = await serverSecret("RATE_LIMIT_SECRET") || await serverSecret("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) throw new Error("Recovery is unavailable");
  return secret;
}

export async function writeRecoveryGrant(grant: RecoveryGrant) {
  (await cookies()).set(cookieName, signRecoveryGrant(await recoverySecret(), grant), {
    ...cookieOptions, maxAge: Math.max(0, Math.floor((grant.expires - Date.now()) / 1000)),
  });
}

export async function clearRecoveryGrant() {
  (await cookies()).set(cookieName, "", { ...cookieOptions, maxAge: 0 });
}

export async function recoveryContext() {
  const grant = readRecoveryGrant(await recoverySecret(), (await cookies()).get(cookieName)?.value);
  if (!grant) return null;
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user?.email_confirmed_at) return null;
  const { data: claims, error: claimsError } = await client.auth.getClaims();
  if (claimsError || !matchesRecoverySession(grant, user.id, claims?.claims.session_id)) return null;
  const { data: active, error: sessionError } = await (await getAdminClient()).rpc("password_recovery_session_is_active", {
    p_user_id: user.id, p_session_id: grant.sessionId,
  });
  if (sessionError) throw new Error("Recovery is unavailable");
  if (!active) return null;
  const { data: factors, error: factorError } = await client.auth.mfa.listFactors();
  const { data: level, error: levelError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (factorError || levelError) throw new Error("Recovery is unavailable");
  const verified = factors.totp.filter((factor) => factor.status === "verified");
  // Enrolled factors are preserved. Recovery email alone cannot bypass MFA.
  const requiresMfa = factors.all.some((factor) => factor.status === "verified") && level.currentLevel !== "aal2";
  return { client, grant, requiresMfa, factors: verified.map(({ id, friendly_name }) => ({ id, friendly_name })) };
}
