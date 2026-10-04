import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteBrand } from "../components/SiteBrand";
import { MemberNavigation } from "../components/MemberNavigation";
import { LogoutButton } from "../components/LogoutButton";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  async function handleLogout() {
    "use server";
    const client = await createClient();
    await client.auth.signOut();
    redirect("/");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/accept-invite");

  const { data: profile } = await supabase.from("profiles")
    .select("id, status, role, display_name").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "active") redirect("/login");
  const displayName = profile.display_name ?? user.email ?? "Member";
  const canUpload = profile.role === "admin";

  return (
    <div className="member-shell">
      <aside className="member-sidebar">
        <div className="member-sidebar-head"><SiteBrand href="/main" /></div>
        <MemberNavigation canUpload={canUpload} />
        <div className="member-sidebar-bottom">
          <div className="member-identity"><span className="member-avatar" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span><span className="member-name">{displayName}</span></div>
          <form action={handleLogout}><LogoutButton /></form>
        </div>
      </aside>
      <div className="member-main">
        <div className="member-topbar"><span>What&apos;s The Call? / Member desk</span><span>One action. Many calls.</span></div>
        <main>{children}</main>
      </div>
    </div>
  );
}
