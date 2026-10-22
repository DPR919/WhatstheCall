import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateInviteCode } from "@/lib/utils/generateInviteCode";
import { enforceLimits } from "@/lib/security/requests";
import { isSameOriginMutation } from "@/lib/security/policy";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.email_confirmed_at) {
    return NextResponse.json({ error: "Verified account required." }, { status: 401 });
  }
  const limited = await enforceLimits("generate-invite", [{ name: "user", value: user.id, maximum: 10, seconds: 3600 }]);
  if (limited) return limited;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: invite, error } = await (await getAdminClient()).rpc("create_member_invite", {
      p_user_id: user.id,
      p_code: generateInviteCode(),
    });
    if (!error && invite) return NextResponse.json({ code: invite.code });
    if (error?.code === "23505") continue;
    if (error?.code === "P0001") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[invites/generate] Could not create invite", error);
    return NextResponse.json({ error: "Could not create invite code." }, { status: 500 });
  }
  return NextResponse.json({ error: "Could not create a unique code." }, { status: 500 });
}
