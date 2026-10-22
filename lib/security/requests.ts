import "server-only";
import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { clientAddress, privateLimitKey } from "./policy";
import { serverSecret } from "./secrets";

type Limit = { value: string; name: string; maximum: number; seconds: number };

export async function enforceLimits(action: string, limits: Limit[]): Promise<NextResponse | null> {
  // The dedicated key can be rotated separately; the server-only service key
  // provides a stable HMAC fallback across instances during initial rollout.
  let secret: string | undefined;
  try { secret = await serverSecret("RATE_LIMIT_SECRET") || await serverSecret("SUPABASE_SERVICE_ROLE_KEY"); }
  catch { return NextResponse.json({ error: "Please try again later." }, { status: 503 }); }
  if (!secret) return NextResponse.json({ error: "Please try again later." }, { status: 503 });
  for (const limit of limits) {
    const { data, error } = await (await getAdminClient()).rpc("consume_request_limit", {
      p_key_hash: privateLimitKey(secret, `${action}:${limit.name}`, limit.value),
      p_limit: limit.maximum,
      p_window_seconds: limit.seconds,
    });
    if (error) {
      console.error("[security] Rate limit storage unavailable", { code: error.code });
      return NextResponse.json({ error: "Please try again later." }, { status: 503 });
    }
    if (!data) return NextResponse.json({ error: "Too many attempts. Please try again later." }, {
      status: 429, headers: { "Retry-After": String(limit.seconds), "Cache-Control": "no-store" },
    });
  }
  return null;
}

export async function limitPublicAuth(request: Request, action: "login" | "signup", email?: string) {
  const limits: Limit[] = [{
    value: clientAddress(request.headers, process.env.TRUSTED_CLIENT_IP_HEADER),
    name: "address", maximum: action === "login" ? 100 : 30, seconds: 900,
  }];
  if (email) limits.push({ value: email.trim().toLowerCase(), name: "email", maximum: 10, seconds: 900 });
  return enforceLimits(action, limits);
}
