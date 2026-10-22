import { getAdminClient } from "./admin";

export async function isActiveMember(userId: string): Promise<boolean> {
  const { data: profile, error } = await (await getAdminClient()).from("profiles")
    .select("id, status").eq("id", userId).maybeSingle();
  return !error && profile?.status === "active";
}
