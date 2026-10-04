import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
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
    <div className="member-content page-wrap">
      <header className="page-intro"><div><p className="eyebrow">Grow the conversation</p><h1 className="page-title">My invites.</h1><p className="lede">Share a seat at the table with someone who loves a good fencing call.</p></div><span className="tag">{remaining} of 5 remaining</span></header>
      <div className="list-stack">
        <section className="paper-panel" aria-labelledby="invite-new-title">
          <p className="eyebrow">Make an introduction</p>
          <h2 id="invite-new-title" className="panel-title mt-2 mb-3">Invite someone in.</h2>
          <p className="quiet max-w-xl">Each member can create five invite codes in total. Each code can welcome one new member. You have {remaining} {remaining === 1 ? "code" : "codes"} left.</p>
          <div className="mt-5"><GenerateInviteButton disabled={remaining === 0} /></div>
        </section>
        <section className="paper-panel" aria-labelledby="invite-codes-title">
          <p className="eyebrow">Your invitations</p><h2 id="invite-codes-title" className="panel-title mt-2 mb-5">Codes you&apos;ve created.</h2>
          {codes?.length ? (
            <ul>
              {codes.map((code) => {
                const state = !code.is_active ? "inactive" : code.use_count > 0 ? "used" : "available";
                return <li key={code.id} className="collection-row"><code className="font-semibold tracking-wider">{code.code}</code><span className="tag" data-state={state}>{state}</span></li>;
              })}
            </ul>
          ) : <p className="quiet">You haven&apos;t created any codes yet.</p>}
        </section>
      </div>
    </div>
  );
}
