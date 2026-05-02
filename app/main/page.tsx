import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "../components/Container";
import { LogoutButton } from "../components/LogoutButton";
import { Section } from "../components/Section";
import { VideoUpload } from "../components/VideoUpload";

export default async function MainPage() {
  async function handleLogout() {
    "use server";

    const supabase = await createClient();
    await supabase.auth.signOut();

    redirect("/");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = profile?.display_name ?? user.email ?? "User";
  const canUpload = profile?.role === "admin";

  return (
    <Section variant="gray" className="min-h-screen py-16">
      <Container size="sm">
        <div className="rounded-lg bg-white p-8 shadow-md">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-4xl text-gray-900">Welcome, {displayName}</h1>

            <form action={handleLogout}>
              <LogoutButton />
            </form>
          </div>

          <div className="mt-8">
            <VideoUpload canUpload={canUpload} />
          </div>
        </div>
      </Container>
    </Section>
  );
}
