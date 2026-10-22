import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { isSameOriginMutation, readSmallJson } from "@/lib/security/policy";
import { enforceLimits } from "@/lib/security/requests";
import { clearRecoveryGrant, recoveryContext, writeRecoveryGrant } from "@/lib/security/recovery";
import { completeRecovery } from "@/lib/security/recovery-flow";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const context = await recoveryContext();
    if (!context) return NextResponse.json({ error: "This recovery session expired. Request a new link." }, { status: 401 });
    const limited = await enforceLimits("recovery-update", [{ name: "session", value: context.grant.sessionId, maximum: 10, seconds: 900 }]);
    if (limited) return limited;
    let body: unknown;
    if (context.grant.phase === "password") {
      try { body = await readSmallJson(request); } catch { /* The workflow rejects invalid JSON. */ }
    }
    const result = await completeRecovery(context.grant, context.requiresMfa, body, {
      updatePassword: (password) => context.client.auth.updateUser({ password }),
      markChanged: () => writeRecoveryGrant({ ...context.grant, phase: "signout" }),
      revokeSessions: async () => {
        const { data: session } = await context.client.auth.getSession();
        if (!session.session) throw new Error("Signout session unavailable");
        return (await getAdminClient()).auth.admin.signOut(session.session.access_token, "global");
      },
      clearSession: async () => {
        await context.client.auth.signOut({ scope: "local" });
        await clearRecoveryGrant();
      },
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "Recovery is temporarily unavailable. Reload this page and try again." }, { status: 503 });
  }
}
