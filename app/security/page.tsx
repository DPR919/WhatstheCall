import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "../components/AuthShell";
import { MfaSettings } from "./MfaSettings";

export default async function SecurityPage() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user?.email_confirmed_at) redirect("/login");
  const { data: profile } = await client.from("profiles").select("role, status").eq("id", user.id).maybeSingle();
  if (profile?.status !== "active") redirect("/login");
  return <AuthShell eyebrow="Account security" heading="Protect your account."
    description={profile.role === "admin" ? "Administrators must verify an authenticator before entering the member desk." : "Verify your authenticator to continue."}>
    <MfaSettings />
  </AuthShell>;
}
