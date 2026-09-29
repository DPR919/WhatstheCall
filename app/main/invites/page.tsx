import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Container } from "../../components/Container";
import { Section } from "../../components/Section";
import { GenerateInviteButton } from "./GenerateInviteButton";

export default async function InvitesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: codes }] = await Promise.all([
    supabaseAdmin.from("profiles")
      .select("referral_limit, referral_generated_count")
      .eq("id", user.id).single(),
    supabaseAdmin.from("invite_codes")
      .select("id, code, use_count, is_active, created_at")
      .eq("created_by_user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const remaining = Math.max(0, Math.min(profile?.referral_limit ?? 5, 5) -
    (profile?.referral_generated_count ?? 0));

  return (
    <Section variant="gray" className="min-h-screen py-10 md:py-12">
      <Container size="sm">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl text-gray-900">My invites</h1>
            <Link href="/main" className="text-sm text-blue-700 hover:underline">Back to main page</Link>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-gray-700">You can create {remaining} more {remaining === 1 ? "code" : "codes"}.
              Each member gets five codes for life, and each code can be used once.</p>
            <div className="mt-5"><GenerateInviteButton disabled={remaining === 0} /></div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl text-gray-900">Your codes</h2>
            {codes?.length ? (
              <ul className="space-y-3">
                {codes.map((code) => (
                  <li key={code.id} className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-3">
                    <code className="font-semibold tracking-wider text-gray-900">{code.code}</code>
                    <span className="text-sm text-gray-600">
                      {!code.is_active ? "Inactive" : code.use_count > 0 ? "Used" : "Available"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-gray-600">You haven&apos;t created any codes yet.</p>}
          </div>
        </div>
      </Container>
    </Section>
  );
}
