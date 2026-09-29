import { supabaseAdmin } from "./admin";

export async function isActiveMember(userId: string): Promise<boolean> {
  const { data: profile, error } = await supabaseAdmin.from("profiles")
    .select("id, status").eq("id", userId).maybeSingle();
  return !error && profile?.status === "active";
}
