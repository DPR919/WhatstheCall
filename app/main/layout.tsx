import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/accept-invite");

  const { data: profile } = await supabase.from("profiles")
    .select("id, status").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "active") redirect("/login");
  return children;
}
