import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "../components/Container";
import { LogoutButton } from "../components/LogoutButton";
import { Section } from "../components/Section";
import { VideoUpload } from "../components/VideoUpload";
import Image from "next/image";
import Link from "next/link";

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
    <Section variant="gray" className="min-h-screen py-10 md:py-12">
      <Container size="xl">
        <div className="space-y-10">
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Main page
              </p>
              <h1 className="mt-2 text-4xl text-gray-900">Welcome, {displayName}</h1>
            </div>

            <details className="relative">
              <summary className="list-none cursor-pointer rounded-full border-2 border-gray-200 transition hover:border-gray-400 focus:outline-none">
                <Image
                  src="/images/homepage/pfp.jpg"
                  alt="User profile picture"
                  width={44}
                  height={44}
                  className="h-11 w-11 rounded-full object-cover"
                />
              </summary>

              <div className="absolute right-0 z-20 mt-3 w-52 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
                <button
                  type="button"
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                >
                  Profile
                </button>
                <Link
                  href="/main/recent-clips"
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                >
                  My recent clips
                </Link>
                <button
                  type="button"
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                >
                  Settings
                </button>
                <div className="border-t border-gray-200 p-2">
                  <form action={handleLogout}>
                    <LogoutButton />
                  </form>
                </div>
              </div>
            </details>
          </div>

          <div>
            <VideoUpload canUpload={canUpload} />
          </div>
        </div>
      </Container>
    </Section>
  );
}
