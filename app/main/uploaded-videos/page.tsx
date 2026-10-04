import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    <div className="member-content page-wrap">
      <header className="page-intro"><div><p className="eyebrow">The clip library</p><h1 className="page-title">Uploaded videos.</h1><p className="lede">A record of the actions you&apos;ve added for the community.</p></div><span className="tag">Admin collection</span></header>
      <div className="paper-panel">
        {!uploadedClips || uploadedClips.length === 0 ? (
          <div className="empty-state"><h2 className="panel-title">No videos yet.</h2><p className="quiet">Upload an action from the clip desk to see it here.</p></div>
        ) : (
          <ul>
            {uploadedClips.map((clip) => (
              <li key={clip.id} className="list-row">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><p className="eyebrow">{clip.weapon ?? "Fencing action"}</p><h2 className="collection-row-title">{clip.title ?? "Untitled clip"}</h2></div>
                  <p className="collection-row-meta">
                      {new Date(clip.created_at).toLocaleString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
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
                            className="text-link"
                          >
                            Open link
                          </a>
                        ) : (
                          "—"
                        )}
                      </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
