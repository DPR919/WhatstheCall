import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { applicationOrigin, clientAddress, isSameOriginMutation, privateLimitKey, readSmallJson } from "@/lib/security/policy";
import { enforceLimits } from "@/lib/security/requests";
import { recoverySecret } from "@/lib/security/recovery";
import { verifyCaptcha } from "@/lib/security/captcha";

const schema = z.object({ email: z.string().trim().toLowerCase().max(254).pipe(z.email()), captchaToken: z.string().max(2048).optional() });
const accepted = () => NextResponse.json({ message: "If an account exists for this email, you'll receive a password-reset link. Check your inbox and spam folder." });

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const limited = await enforceLimits("recovery-request", [{ name: "address", value: clientAddress(request.headers,
      process.env.TRUSTED_CLIENT_IP_HEADER), maximum: 10, seconds: 900 }]);
    if (limited) return limited;
    let body;
    try { body = schema.safeParse(await readSmallJson(request)); } catch { /* Invalid JSON has the same validation response. */ }
    if (!body?.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    const { email, captchaToken } = body.data;
    const authCaptcha = process.env.SUPABASE_CAPTCHA_ENABLED === "true";
    if (authCaptcha ? !captchaToken : !(await verifyCaptcha(captchaToken, "recovery", request))) {
      return NextResponse.json({ error: "Please complete the security check." }, { status: 400 });
    }
    const origin = applicationOrigin(request);
    if (!origin) throw new Error("Recovery origin unavailable");
    const { data: claimed, error: claimError } = await (await getAdminClient()).rpc("claim_password_recovery_email", {
      p_email_hash: privateLimitKey(await recoverySecret(), "recovery:email", email),
    });
    if (claimError) throw new Error("Recovery limiter unavailable");
    // Email limits have the same response for existing and unknown accounts.
    if (!claimed) return accepted();
    const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error } = await auth.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password/confirm`, captchaToken: authCaptcha ? captchaToken : undefined,
    });
    if (error?.code === "captcha_failed") return NextResponse.json({ error: "The security check expired. Please try again." }, { status: 400 });
    // Provider errors may depend on account existence; never expose them publicly.
    if (error) console.error("[recovery] Email request failed", { code: error.code });
    return accepted();
  } catch {
    return NextResponse.json({ error: "Password recovery is temporarily unavailable. Please try again later." }, { status: 503 });
  }
}
