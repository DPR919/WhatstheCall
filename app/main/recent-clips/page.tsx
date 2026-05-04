import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "../../components/Container";
import { Section } from "../../components/Section";
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
    <Section variant="gray" className="min-h-screen py-10 md:py-12">
      <Container size="xl">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-3xl text-gray-900">My recent clips</h1>
            <Link
              href="/main"
              className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-800 transition hover:bg-gray-50"
            >
              Back to main page
            </Link>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <RecentClipsList groupedRecentClips={groupedRecentClips} />
          </div>
        </div>
      </Container>
    </Section>
  );
}