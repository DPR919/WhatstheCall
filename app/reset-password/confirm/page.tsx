"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AuthShell } from "../../components/AuthShell";
import { formStyles } from "../../constants/design-system";

export default function ConfirmRecoveryPage() {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Checking recovery link...");
  const captured = useRef(false);
  useEffect(() => {
    if (captured.current) return;
    captured.current = true;
    // Fragments are never sent in HTTP requests or hosting access logs. Scrub
    // immediately, retain only in memory, and never redeem a token on page load.
    const hash = new URLSearchParams(window.location.hash.slice(1)).get("token_hash");
    window.history.replaceState(null, "", window.location.pathname);
    if (hash && /^[A-Za-z0-9_-]{20,512}$/.test(hash)) { setToken(hash); setMessage(""); }
    else setMessage("This recovery link is missing or invalid. Open the link from your email, or request a new one.");
  }, []);

  async function confirm() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/password-recovery/verify", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tokenHash: token }) });
      const data = await response.json();
      if (!response.ok) { setToken(""); setMessage(data.error || "This link could not be verified. Request a new one."); return; }
      setToken("");
      // A full navigation drops any previously loaded third-party scripts.
      window.location.replace("/reset-password");
    } catch { setMessage("Could not verify this link. Please try again."); }
    finally { setBusy(false); }
  }

  return <AuthShell eyebrow="Account recovery" heading="Choose a new password."
    description="Continue to verify your recovery link and reset your password.">
    {token && <button className={formStyles.submitButton} disabled={busy} onClick={confirm}>{busy ? "Verifying..." : "Continue to reset password"}</button>}
    {message && <p className="status-note mt-4" role="status">{message}</p>}
    <div className="auth-bottom"><Link href="/forgot-password" className={formStyles.link}>Request a new recovery link</Link></div>
  </AuthShell>;
}
