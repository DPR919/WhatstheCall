import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { clientAddress, isSameOriginMutation, readSmallJson } from "@/lib/security/policy";
import { enforceLimits } from "@/lib/security/requests";
import { clearRecoveryGrant, writeRecoveryGrant } from "@/lib/security/recovery";
import { RECOVERY_SECONDS } from "@/lib/security/recovery-grant";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const limited = await enforceLimits("recovery-verify", [{ name: "address", value: clientAddress(request.headers,
      process.env.TRUSTED_CLIENT_IP_HEADER), maximum: 20, seconds: 900 }]);
    if (limited) return limited;
    let body;
    try { body = z.object({ tokenHash: z.string().regex(/^[A-Za-z0-9_-]{20,512}$/) }).safeParse(await readSmallJson(request)); } catch { /* handled below */ }
    if (!body?.success) return NextResponse.json({ error: "This recovery link is invalid or expired. Request a new one." }, { status: 400 });
    await clearRecoveryGrant();
    const client = await createClient();
    // The caller cannot select invite, signup or magic-link token types.
    const { data, error } = await client.auth.verifyOtp({ token_hash: body.data.tokenHash, type: "recovery" });
    if (error || !data.user?.email_confirmed_at || !data.session) {
      return NextResponse.json({ error: "This recovery link is invalid, expired, or already used. Request a new one." }, { status: 400 });
    }
    const { data: claims, error: claimsError } = await client.auth.getClaims();
    const sessionId = claims?.claims.session_id;
    if (claimsError || typeof sessionId !== "string") throw new Error("Recovery session unavailable");
    const { data: active, error: activeError } = await (await getAdminClient()).rpc("password_recovery_session_is_active", {
      p_user_id: data.user.id, p_session_id: sessionId,
    });
    if (activeError) throw new Error("Recovery session unavailable");
    if (!active) {
      await client.auth.signOut({ scope: "local" });
      return NextResponse.json({ error: "Account recovery is unavailable. Please contact the site owner." }, { status: 403 });
    }
    await writeRecoveryGrant({ userId: data.user.id, sessionId, expires: Date.now() + RECOVERY_SECONDS * 1000, phase: "password" });
    return NextResponse.json({ redirectTo: "/reset-password" });
  } catch {
    return NextResponse.json({ error: "Recovery is temporarily unavailable. Please request a new link later." }, { status: 503 });
  }
}
