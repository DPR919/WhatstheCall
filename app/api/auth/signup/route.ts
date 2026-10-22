import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { isSameOriginMutation, readSmallJson } from "@/lib/security/policy";
import { enforceLimits, limitPublicAuth } from "@/lib/security/requests";
import { verifyCaptcha } from "@/lib/security/captcha";

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  displayName: z.string().trim().min(2).max(50),
  inviteCode: z.string().trim().min(3).max(100).transform((value) => value.toUpperCase()),
  captchaToken: z.string().max(2048).optional(),
});

function inviteRedirectUrl(): string | null {
  const configuredSiteUrl = process.env.SITE_URL?.trim();
  const siteUrl = configuredSiteUrl ||
    (process.env.NODE_ENV === "production" ? "https://whatsthecall.net" : "http://localhost:3000");

  try {
    const baseUrl = new URL(siteUrl);
    if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") return null;
    if (process.env.NODE_ENV === "production" && baseUrl.protocol !== "https:") return null;
    if (baseUrl.username || baseUrl.password) return null;
    if (baseUrl.pathname !== "/" || baseUrl.search || baseUrl.hash) return null;
    return new URL("/accept-invite", baseUrl).toString();
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  if (!isSameOriginMutation(req)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const addressLimit = await limitPublicAuth(req, "signup");
  if (addressLimit) return addressLimit;
  let body: unknown;
  try {
    body = await readSmallJson(req);
  } catch {
    return NextResponse.json({ error: "Invalid signup data." }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid signup data." }, { status: 400 });
  }

  const { email, displayName, inviteCode, captchaToken } = parsed.data;
  const emailLimit = await enforceLimits("signup", [{ value: email, name: "email", maximum: 10, seconds: 900 }]);
  if (emailLimit) return emailLimit;
  if (!(await verifyCaptcha(captchaToken, "signup", req))) {
    return NextResponse.json({ error: "Please complete the security check and try again." }, { status: 400 });
  }
  const redirectTo = inviteRedirectUrl();
  if (!redirectTo) {
    console.error("[auth/signup] SITE_URL must be the HTTPS origin of this deployment");
    return NextResponse.json({ error: "Signup is not configured for this site." }, { status: 500 });
  }

  const { data: registration, error: claimError } = await (await getAdminClient())
    .rpc("reserve_member_registration", { p_code: inviteCode, p_email: email, p_display_name: displayName });
  if (claimError?.code === "P0001") {
    return NextResponse.json({ error: "Could not register with these details. Check your invite code and choose an available display name." }, { status: 400 });
  }
  if (claimError || !registration) {
    console.error("[auth/signup] Could not reserve registration", { code: claimError?.code });
    return NextResponse.json({ error: "Could not validate invite code." }, { status: 500 });
  }

  try {
    if (registration.send_email) {
      const { error: inviteError } = await (await getAdminClient()).auth.admin.inviteUserByEmail(email, {
        redirectTo, data: { display_name: displayName },
      });
      if (inviteError) {
        await (await getAdminClient()).rpc("mark_registration_delivery_failed", { p_registration_id: registration.id });
        console.error("[auth/signup] Invitation delivery needs review", { registrationId: registration.id, code: inviteError.code });
      }
    }
    const { data: completed, error: completeError } = await (await getAdminClient()).rpc("finish_member_registration", {
      p_registration_id: registration.id,
    });
    if (completeError) {
      console.error("[auth/signup] Registration completion needs retry", { registrationId: registration.id, code: completeError.code });
      return NextResponse.json({ error: "Your invitation is reserved. Please try again with the same details." }, { status: 503 });
    }
    if (!completed) return NextResponse.json({ error: "Your invitation is reserved. Check your email; if it has not arrived, contact support. Retrying will not send another email." }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch {
    console.error("[auth/signup] Registration needs reconciliation", { registrationId: registration.id });
    return NextResponse.json({ error: "Your invitation is reserved. Please try again with the same details." }, { status: 503 });
  }
}
