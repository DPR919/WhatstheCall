import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateInviteCode } from "@/lib/utils/generateInviteCode";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, status, referral_limit, referral_generated_count")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: "Failed to fetch profile." },
      { status: 500 }
    );
  }

  if (!profile) {
    return NextResponse.json(
      { error: "Profile not found for current user." },
      { status: 400 }
    );
  }

  if (profile.status !== "active") {
    return NextResponse.json(
      { error: "Only active users can generate invite codes." },
      { status: 403 }
    );
  }

  if (profile.referral_generated_count >= profile.referral_limit) {
    return NextResponse.json(
      { error: "Referral generation limit reached." },
      { status: 403 }
    );
  }

  let code = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateInviteCode();
    const { data: existing, error: checkError } = await supabaseAdmin
      .from("invite_codes")
      .select("id")
      .eq("code", candidate)
      .maybeSingle();

    if (checkError) {
      return NextResponse.json(
        { error: "Failed to generate unique invite code." },
        { status: 500 }
      );
    }

    if (!existing) {
      code = candidate;
      break;
    }
  }

  if (!code) {
    return NextResponse.json(
      { error: "Could not generate a unique invite code. Please try again." },
      { status: 500 }
    );
  }

  const { error: insertInviteError } = await supabaseAdmin
    .from("invite_codes")
    .insert({
      code,
      created_by_user_id: user.id,
      max_uses: 1,
      use_count: 0,
      is_active: true,
    });

  if (insertInviteError) {
    return NextResponse.json(
      { error: "Failed to create invite code." },
      { status: 500 }
    );
  }

  const { error: updateProfileError } = await supabaseAdmin
    .from("profiles")
    .update({
      referral_generated_count: profile.referral_generated_count + 1,
    })
    .eq("id", user.id);

  if (updateProfileError) {
    return NextResponse.json(
      { error: "Invite code created, but profile update failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ code });
}
