import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "../../components/Container";
import { Section } from "../../components/Section";

export default async function UploadedVideosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/main");
  }

  const { data: uploadedClips } = await supabase
    .from("clips")
    .select(
      "id, title, event_name, left_fencer, right_fencer, weapon, source_url, score_at_touch, created_at",
    )
    .eq("uploaded_by_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <Section variant="gray" className="min-h-screen py-10 md:py-12">
      <Container size="xl">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-3xl text-gray-900">My uploaded videos</h1>
            <Link
              href="/main"
              className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-800 transition hover:bg-gray-50"
            >
              Back to main page
            </Link>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            {!uploadedClips || uploadedClips.length === 0 ? (
              <p className="text-sm text-gray-600">You have not uploaded any videos yet.</p>
            ) : (
              <div className="space-y-4">
                {uploadedClips.map((clip) => (
                  <div key={clip.id} className="rounded-lg border border-gray-200 p-4">
                    <h2 className="text-lg text-gray-900">{clip.title ?? "Untitled clip"}</h2>
                    <p className="mt-1 text-sm text-gray-600">
                      {new Date(clip.created_at).toLocaleString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-700 md:grid-cols-2">
                      <p>
                        <span className="font-medium">Event:</span> {clip.event_name ?? "—"}
                      </p>
                      <p>
                        <span className="font-medium">Weapon:</span> {clip.weapon ?? "—"}
                      </p>
                      <p>
                        <span className="font-medium">Left fencer:</span> {clip.left_fencer ?? "—"}
                      </p>
                      <p>
                        <span className="font-medium">Right fencer:</span> {clip.right_fencer ?? "—"}
                      </p>
                      <p>
                        <span className="font-medium">Score at touch:</span> {clip.score_at_touch ?? "—"}
                      </p>
                      <p>
                        <span className="font-medium">Source:</span>{" "}
                        {clip.source_url ? (
                          <a
                            href={clip.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Open link
                          </a>
                        ) : (
                          "—"
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Container>
    </Section>
  );
}
