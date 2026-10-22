import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isActiveMember } from "@/lib/supabase/access";
import { isSameOriginMutation, readSmallJson, needsAdminMfa } from "@/lib/security/policy";
import { enforceLimits, limitPublicAuth } from "@/lib/security/requests";
import { verifyCaptcha } from "@/lib/security/captcha";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(8).max(1024),
  captchaToken: z.string().max(2048).optional(),
});

export async function POST(req: Request) {
  if (!isSameOriginMutation(req)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const addressLimit = await limitPublicAuth(req, "login");
  if (addressLimit) return addressLimit;
  let body: unknown;
  try { body = await readSmallJson(req); }
  catch { return NextResponse.json({ error: "Invalid login data." }, { status: 400 }); }
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid login data." }, { status: 400 });
  }

  const { email, password, captchaToken } = parsed.data;
  const emailLimit = await enforceLimits("login", [{ value: email, name: "email", maximum: 10, seconds: 900 }]);
  if (emailLimit) return emailLimit;
  // A Turnstile token is single-use: either Auth or this server verifies it.
  const authVerifiesCaptcha = process.env.SUPABASE_CAPTCHA_ENABLED === "true";
  if (authVerifiesCaptcha ? !captchaToken : !(await verifyCaptcha(captchaToken, "login", req))) {
    return NextResponse.json({ error: "Please complete the security check." }, { status: 400 });
  }
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken: authVerifiesCaptcha ? captchaToken : undefined },
  });

  if (error) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
  }

  if (!data.user.email_confirmed_at || !(await isActiveMember(data.user.id))) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "Account is not active or email is unverified." }, { status: 403 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const requireMfa = assuranceError || needsAdminMfa(profile?.role, assurance?.currentLevel) ||
    (assurance?.nextLevel === "aal2" && assurance.currentLevel !== "aal2");
  return NextResponse.json({ success: true, redirectTo: requireMfa ? "/security" : "/main" });
}
