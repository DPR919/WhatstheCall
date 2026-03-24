import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "../components/Container";
import { Section } from "../components/Section";
import { VideoUpload } from "../components/VideoUpload";

export default async function MainPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = profile?.display_name ?? user.email ?? "User";

  return (
    <Section variant="gray" className="min-h-screen py-16">
      <Container size="sm">
        <div className="rounded-lg bg-white p-8 shadow-md">
          <h1 className="text-4xl text-gray-900">Welcome, {displayName}</h1>

          <div className="mt-8">
            <VideoUpload />
          </div>
        </div>
      </Container>
    </Section>
  );
}
