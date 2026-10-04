"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { AuthShell } from "../components/AuthShell";
import { formStyles } from "../constants/design-system";

export default function AcceptInvitePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("Checking invitation...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkInvitation() {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");
      const supabase = createClient();

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          if (!cancelled) setMessage("This invitation link is invalid or expired.");
          return;
        }
        window.history.replaceState(null, "", window.location.pathname);
      }

      const { data: { user }, error } = await supabase.auth.getUser();
      if (cancelled) return;
      if (error || !user?.email_confirmed_at) {
        setMessage("This invitation link is invalid or expired.");
        return;
      }
      const { data: profile } = await supabase.from("profiles")
        .select("id, status").eq("id", user.id).maybeSingle();
      if (cancelled) return;
      if (!profile || profile.status !== "active") {
        setMessage("This invitation is not ready. Please contact support.");
        return;
      }
      setReady(true);
      setMessage("");
    }
    void checkInvitation();
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    setSaving(true);
    const { error } = await createClient().auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    router.replace("/main");
    router.refresh();
  }

  return (
    <AuthShell eyebrow="One last step" heading="Welcome to the conversation." description="Set a password to finish joining What's The Call.">
          {ready && (
            <form onSubmit={handleSubmit}>
              <div className={formStyles.inputGroup}>
                <label htmlFor="password" className={formStyles.label}>Password</label>
                <input id="password" type="password" autoComplete="new-password"
                  className={formStyles.input} value={password}
                  onChange={(event) => setPassword(event.target.value)} minLength={8} required />
              </div>
              <div className={formStyles.inputGroup}>
                <label htmlFor="confirmPassword" className={formStyles.label}>Confirm password</label>
                <input id="confirmPassword" type="password" autoComplete="new-password"
                  className={formStyles.input} value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required />
              </div>
              <button type="submit" className={formStyles.submitButton} disabled={saving}>
                {saving ? "Saving..." : "Set password"}
              </button>
            </form>
          )}
          {message && <p className="status-note mt-4" role="status">{message}</p>}
    </AuthShell>
  );
}
