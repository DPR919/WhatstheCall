import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VideoUpload } from "../components/VideoUpload";

export default async function MainPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles")
    .select("display_name, role, status").eq("id", user.id).maybeSingle();
  const displayName = profile?.display_name ?? user.email?.split("@")[0] ?? "there";
  const canUpload = profile?.role === "admin" && profile.status === "active";

  return (
    <div className="member-content page-wrap">
      <header className="page-intro">
        <div>
          <p className="eyebrow">The referee&apos;s desk</p>
          <h1 className="page-title">Welcome back, <em>{displayName}.</em></h1>
          <p className="lede">Take your time with the action. Your call comes first.</p>
        </div>
        <span className="tag">Watch / Decide / Compare</span>
      </header>
      <VideoUpload canUpload={canUpload} />
    </div>
  );
}
