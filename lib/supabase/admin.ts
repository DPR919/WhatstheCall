import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverSecret } from "@/lib/security/secrets";

let cached: { key: string; client: SupabaseClient } | undefined;

export async function getAdminClient() {
  const key = await serverSecret("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("Server authentication is not configured");
  if (!cached || cached.key !== key) {
    cached = { key, client: createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    }) };
  }
  return cached.client;
}
