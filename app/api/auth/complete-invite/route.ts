import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { enforceLimits } from "@/lib/security/requests";
import { isSameOriginMutation } from "@/lib/security/policy";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user?.email_confirmed_at) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const limited = await enforceLimits("complete-invite", [{ name: "user", value: user.id, maximum: 10, seconds: 900 }]);
  if (limited) return limited;
  const { error: completionError } = await (await getAdminClient()).rpc("finish_own_member_registration", { p_user_id: user.id });
  if (completionError) return NextResponse.json({ error: "Your invitation needs support. Please try again later." }, { status: 503 });
  return NextResponse.json({ success: true });
}
