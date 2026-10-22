import "server-only";
import { createClient } from "@/lib/supabase/server";
import { needsAdminMfa } from "./policy";

export async function hasVerifiedAdminSession(client: Awaited<ReturnType<typeof createClient>>) {
  // getUser validates the token with Auth before local AAL claims are trusted.
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user?.email_confirmed_at) return false;
  const { data: profile } = await client.from("profiles").select("role, status").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin" || profile.status !== "active") return false;
  const { data, error: levelError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  return !levelError && !needsAdminMfa(profile.role, data?.currentLevel);
}
