import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(50),
  inviteCode: z.string().min(3).max(100),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid signup data." },
      { status: 400 }
    );
  }

  const { email, password, displayName, inviteCode } = parsed.data;

  // 1) Validate invite code
  const { data: invite, error: inviteError } = await supabaseAdmin
    .from("invite_codes")
    .select("*")
    .eq("code", inviteCode)
    .eq("is_active", true)
    .maybeSingle();

  if (inviteError) {
    return NextResponse.json(
      { error: "Failed to validate invite code." },
      { status: 500 }
    );
  }

  if (!invite) {
    return NextResponse.json(
      { error: "Invite code is invalid." },
      { status: 400 }
    );
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "Invite code has expired." },
      { status: 400 }
    );
  }

  if (invite.use_count >= invite.max_uses) {
    return NextResponse.json(
      { error: "Invite code has already been used up." },
      { status: 400 }
    );
  }

  // 2) Ensure display name is not already taken
  const { data: existingDisplayNames, error: displayNameCheckError } =
    await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("display_name", displayName)
      .limit(1);

  if (displayNameCheckError) {
    return NextResponse.json(
      { error: "Failed to validate display name." },
      { status: 500 }
    );
  }

  if (existingDisplayNames && existingDisplayNames.length > 0) {
    return NextResponse.json(
      { error: "Display name is already taken." },
      { status: 400 }
    );
  }

  // 3) Create auth user
  const { data: createdUser, error: createUserError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createUserError || !createdUser.user) {
    return NextResponse.json(
      { error: createUserError?.message ?? "Failed to create user." },
      { status: 400 }
    );
  }

  const newUserId = createdUser.user.id;
  const inviterId = invite.created_by_user_id ?? null;

  // 4) Create profile row
  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: newUserId,
    email,
    display_name: displayName,
    invited_by_user_id: inviterId,
    invite_code_used_id: invite.id,
    referral_limit: 5,
    referral_generated_count: 0,
    status: "active",
  });

  if (profileError) {
    // cleanup auth user if profile creation fails
    await supabaseAdmin.auth.admin.deleteUser(newUserId);
    return NextResponse.json(
      { error: "Failed to create profile." },
      { status: 500 }
    );
  }

  // 5) Record redemption
  const { error: redemptionError } = await supabaseAdmin
    .from("invite_redemptions")
    .insert({
      invite_code_id: invite.id,
      redeemed_by_user_id: newUserId,
    });

  if (redemptionError) {
    await supabaseAdmin.from("profiles").delete().eq("id", newUserId);
    await supabaseAdmin.auth.admin.deleteUser(newUserId);
    return NextResponse.json(
      { error: "Failed to record invite redemption." },
      { status: 500 }
    );
  }

  // 6) Increment invite usage
  const { error: updateInviteError } = await supabaseAdmin
    .from("invite_codes")
    .update({ use_count: invite.use_count + 1 })
    .eq("id", invite.id);

  if (updateInviteError) {
    return NextResponse.json(
      { error: "User created, but invite code update failed. Please contact admin." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}