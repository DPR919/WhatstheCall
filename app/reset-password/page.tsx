"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";
import { AuthShell } from "../components/AuthShell";
import { formStyles } from "../constants/design-system";

type RecoveryState = { requiresMfa: boolean; factors: { id: string; friendly_name?: string }[]; needsSignout: boolean };

export default function ResetPasswordPage() {
  const [state, setState] = useState<RecoveryState | null>(null);
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("Checking recovery session...");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function loadState() {
    try {
      const response = await fetch("/api/auth/password-recovery/state", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) { setState(null); setMessage(data.error); return; }
      setState(data); setFactorId(data.factors[0]?.id || "");
      setMessage(data.needsSignout ? "Your password was updated. Finish signing out your sessions to continue." : "");
    } catch { setMessage("Could not check this recovery session. Please reload and try again."); }
  }
  useEffect(() => { void loadState(); }, []);

  async function verifyMfa(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId, code });
      if (error) { setMessage("That authenticator code could not be verified. Try the current code."); return; }
      setCode(""); await loadState();
    } catch { setMessage("Authenticator verification is unavailable. Please try again."); }
    finally { setBusy(false); }
  }

  async function updatePassword(event?: FormEvent) {
    event?.preventDefault();
    if (!state?.needsSignout && password !== confirmPassword) { setMessage("Passwords do not match."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/password-recovery/update", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(state?.needsSignout ? {} : { password, confirmPassword }) });
      const data = await response.json();
      if (!response.ok) {
        if (data.passwordChanged) { setPassword(""); setConfirmPassword(""); setState((previous) => previous && ({ ...previous, needsSignout: true })); }
        setMessage(data.error || "Could not update your password. Please try again."); return;
      }
      setPassword(""); setConfirmPassword(""); setState(null); setDone(true);
      setMessage("Your password has been updated. Sign in again with your new password.");
    } catch { setMessage("Could not finish recovery. Reload this page before trying again."); }
    finally { setBusy(false); }
  }

  return <AuthShell eyebrow="Account recovery" heading={done ? "Password updated." : "A fresh start."}
    description={done ? "You're ready to return to the conversation." : "Choose a password of at least 12 characters that you haven't used before."}>
    {state?.requiresMfa && <form onSubmit={verifyMfa}>
      <p className="quiet mb-4">Verify your authenticator to continue. Your existing account protection stays enabled.</p>
      {state.factors.length > 1 && <div className={formStyles.inputGroup}>
        <label className={formStyles.label} htmlFor="factor">Authenticator</label>
        <select id="factor" className={formStyles.input} value={factorId} onChange={(event) => setFactorId(event.target.value)}>
          {state.factors.map((factor, index) => <option key={factor.id} value={factor.id}>{factor.friendly_name || `Authenticator ${index + 1}`}</option>)}
        </select>
      </div>}
      {factorId ? <>
        <div className={formStyles.inputGroup}>
          <label className={formStyles.label} htmlFor="code">Authenticator code</label>
          <input id="code" className={formStyles.input} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}"
            minLength={6} maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} required />
        </div>
        <button className={formStyles.submitButton} disabled={busy || code.length !== 6}>{busy ? "Verifying..." : "Verify authenticator"}</button>
      </> : <p className="status-note">This account needs another verification method. Please contact the site owner.</p>}
      <p className="quiet mt-4">Lost your authenticator and backup? Contact the site owner for account recovery.</p>
    </form>}
    {state && !state.requiresMfa && !state.needsSignout && <form onSubmit={updatePassword}>
      <div className={formStyles.inputGroup}>
        <label className={formStyles.label} htmlFor="password">New password</label>
        <input id="password" type="password" autoComplete="new-password" className={formStyles.input}
          minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required />
      </div>
      <div className={formStyles.inputGroup}>
        <label className={formStyles.label} htmlFor="confirm-password">Confirm new password</label>
        <input id="confirm-password" type="password" autoComplete="new-password" className={formStyles.input}
          minLength={12} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
      </div>
      <button className={formStyles.submitButton} disabled={busy}>{busy ? "Updating..." : "Update password"}</button>
    </form>}
    {state?.needsSignout && !state.requiresMfa && <button className={formStyles.submitButton} disabled={busy}
      onClick={() => void updatePassword()}>{busy ? "Finishing..." : "Finish signing out"}</button>}
    {message && <p className="status-note mt-4" role="status">{message}</p>}
    <div className="auth-bottom"><Link href="/login" className={formStyles.link}>{done ? "Sign in with your new password" : "Back to login"}</Link>
      {!done && <p className="mt-3"><Link href="/forgot-password" className={formStyles.link}>Request a new recovery link</Link></p>}
    </div>
  </AuthShell>;
}
