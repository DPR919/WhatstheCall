import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";

const signupSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  displayName: z.string().trim().min(2).max(50),
  inviteCode: z.string().trim().min(3).max(100).transform((value) => value.toUpperCase()),
});

function inviteRedirectUrl(): string | null {
  const configuredSiteUrl = process.env.SITE_URL?.trim();
  const siteUrl = configuredSiteUrl ||
    (process.env.NODE_ENV === "production" ? null : "http://localhost:3000");
  if (!siteUrl) return null;

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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid signup data." }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid signup data." }, { status: 400 });
  }

  const { email, displayName, inviteCode } = parsed.data;
  const redirectTo = inviteRedirectUrl();
  if (!redirectTo) {
    console.error("[auth/signup] SITE_URL must be the HTTPS origin of this deployment");
    return NextResponse.json({ error: "Signup is not configured for this site." }, { status: 500 });
  }

  const { data: existingName, error: nameError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("display_name", displayName)
    .limit(1);
  if (nameError) {
    return NextResponse.json({ error: "Could not validate display name." }, { status: 500 });
  }
  if (existingName?.length) {
    return NextResponse.json({ error: "Display name is already taken." }, { status: 400 });
  }

  // The database locks the invite row while claiming its one available use.
  const { data: invite, error: claimError } = await supabaseAdmin
    .rpc("claim_member_invite", { p_code: inviteCode });
  if (claimError?.code === "P0001") {
    return NextResponse.json({ error: "Invite code is invalid or already used." }, { status: 400 });
  }
  if (claimError || !invite) {
    console.error("[auth/signup] Could not claim invite", claimError);
    return NextResponse.json({ error: "Could not validate invite code." }, { status: 500 });
  }

  try {
    const { data: invited, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { display_name: displayName },
      });

    if (inviteError || !invited.user) {
      console.error("[auth/signup] Could not send invitation", inviteError);
      return NextResponse.json(
        { error: "Could not send an invitation to this email address." },
        { status: 400 },
      );
    }

    const { error: completeError } = await supabaseAdmin.rpc("complete_member_invite", {
      p_invite_id: invite.id,
      p_user_id: invited.user.id,
      p_email: email,
      p_display_name: displayName,
    });

    if (completeError) {
      console.error("[auth/signup] Could not complete invitation", completeError);
      return NextResponse.json({ error: "Could not complete signup. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[auth/signup] Unexpected invitation error", error);
    return NextResponse.json({ error: "Could not complete signup. Please try again." }, { status: 500 });
  } finally {
    // Once redeemed, release_member_invite leaves the code consumed.
    const { error: releaseError } = await supabaseAdmin.rpc("release_member_invite", {
      p_invite_id: invite.id,
    });
    if (releaseError) console.error("[auth/signup] Could not release invite claim", releaseError);
  }
}
