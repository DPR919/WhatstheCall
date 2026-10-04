import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RecentClipsList } from "./RecentClipsList";

export default async function RecentClipsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: recentClipResponses } = await supabase
    .from("clip_responses")
    .select("id, clip_id, response, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const groupedRecentClips = (recentClipResponses ?? []).reduce<
    Record<
      string,
      Array<{
        id: string;
        clipId: string;
        response: string;
        createdAt: string;
      }>
    >
  >((acc, row) => {
    const dateKey = new Date(row.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }

    acc[dateKey].push({
      id: row.id,
      clipId: row.clip_id,
      response: row.response,
      createdAt: row.created_at,
    });

    return acc;
  }, {});

  return (
    <div className="member-content page-wrap">
      <header className="page-intro">
        <div><p className="eyebrow">Your perspective</p><h1 className="page-title">Recent clips.</h1><p className="lede">Revisit the actions you&apos;ve judged and the calls you made.</p></div>
        <span className="tag">Your history</span>
      </header>
      <div className="paper-panel"><RecentClipsList groupedRecentClips={groupedRecentClips} /></div>
    </div>
  );
}
