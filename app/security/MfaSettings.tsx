"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { formStyles } from "../constants/design-system";

export function MfaSettings() {
  const router = useRouter();
  const [factors, setFactors] = useState<{ id: string; friendly_name?: string }[]>([]);
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("Loading security settings...");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void createClient().auth.mfa.listFactors().then(({ data, error }) => {
      if (cancelled) return;
      if (error) { setMessage("Could not load security settings. Please reload."); return; }
      const verified = data.totp.filter((factor) => factor.status === "verified");
      setFactors(verified);
      setFactorId(verified[0]?.id ?? "");
      setMessage(""); setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  async function startSetup() {
    setBusy(true); setMessage("");
    try {
      const client = createClient();
      const { data: existing, error: listError } = await client.auth.mfa.listFactors();
      if (listError) throw listError;
      for (const factor of existing.all.filter((item) => item.factor_type === "totp" && item.status === "unverified")) {
        const { error } = await client.auth.mfa.unenroll({ factorId: factor.id });
        if (error) throw error;
      }
      const { data, error } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: `What's The Call ${new Date().toISOString().slice(0, 10)}`, issuer: "What's The Call" });
      if (error) throw error;
      setFactorId(data.id); setQr(data.totp.qr_code); setSecret(data.totp.secret);
    } catch { setMessage("Could not start authenticator setup. Please try again."); }
    finally { setBusy(false); }
  }

  async function verify(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId, code });
      if (error) { setMessage("That code could not be verified. Try the current code from your authenticator."); return; }
      setSecret(""); setQr(""); setCode("");
      router.replace("/main"); router.refresh();
    } catch { setMessage("Verification is unavailable. Please try again."); }
    finally { setBusy(false); }
  }

  return <div>
    {ready && !factorId && <>
      <p className="quiet mb-4">Use an authenticator app that supports backups. Keep access to that backup so losing your phone does not lock you out.</p>
      <button className={formStyles.submitButton} disabled={busy} onClick={startSetup}>Set up authenticator</button>
    </>}
    {qr && <div className="mb-4">
      <p className="quiet mb-3">Scan this code in your authenticator app, then enter its six-digit code.</p>
      {/* Auth supplies this QR image; it is never sent to an external renderer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="Authenticator setup QR code" width={240} height={240} />
      <details><summary>Enter a setup key instead</summary><code className="break-all">{secret}</code></details>
      <p className="quiet mt-3">Keep the setup key in a secure password manager as a backup. Anyone with this key can generate your codes.</p>
    </div>}
    {ready && factorId && <form onSubmit={verify}>
      {!qr && factors.length > 1 && <div className={formStyles.inputGroup}>
        <label className={formStyles.label} htmlFor="authenticator">Authenticator</label>
        <select id="authenticator" className={formStyles.input} value={factorId} onChange={(e) => setFactorId(e.target.value)}>
          {factors.map((factor, index) => <option key={factor.id} value={factor.id}>{factor.friendly_name || `Authenticator ${index + 1}`}</option>)}
        </select>
      </div>}
      <div className={formStyles.inputGroup}>
        <label className={formStyles.label} htmlFor="mfa-code">Authenticator code</label>
        <input id="mfa-code" className={formStyles.input} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required />
      </div>
      <button className={formStyles.submitButton} disabled={busy || code.length !== 6}>{busy ? "Verifying..." : qr ? "Enable authenticator" : "Verify and continue"}</button>
    </form>}
    {message && <p className="status-note mt-4" role="status">{message}</p>}
    <p className="quiet mt-5">Lost your authenticator and backup? Contact the site owner for identity verification and account recovery.</p>
  </div>;
}
