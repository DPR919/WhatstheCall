"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { AuthShell } from "../components/AuthShell";
import { BotCheck } from "../components/BotCheck";
import { formStyles } from "../constants/design-system";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/password-recovery/request", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, captchaToken }),
      });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error || "Please try again later."); return; }
      setSent(true); setMessage(data.message);
    } catch { setMessage("Password recovery is temporarily unavailable. Please try again later."); }
    finally { setBusy(false); setCaptchaToken(""); setAttempt((value) => value + 1); }
  }

  return <AuthShell eyebrow="Account recovery" heading={sent ? "Check your inbox." : "Forgot your password?"}
    description={sent ? "Follow the recovery link in your email to choose a new password." : "Enter your account email and we'll help you get back to making calls."}>
    {!sent && <form onSubmit={submit}>
      <div className={formStyles.inputGroup}>
        <label className={formStyles.label} htmlFor="email">Email</label>
        <input id="email" className={formStyles.input} type="email" autoComplete="email" maxLength={254}
          placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </div>
      <BotCheck key={attempt} action="recovery" onToken={setCaptchaToken} />
      <button className={formStyles.submitButton} disabled={busy || (!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !captchaToken)}>
        {busy ? "Requesting link..." : "Send reset link"}
      </button>
    </form>}
    {message && <p className="status-note mt-4" role="status">{message}</p>}
    {sent && <p className="quiet mt-4">If it does not arrive, check the address you entered and wait at least a minute before requesting another link.</p>}
    <div className="auth-bottom">
      {sent && <p className="mb-3"><button className={formStyles.link} onClick={() => { setSent(false); setMessage(""); }}>Request another link</button></p>}
      <Link href="/login" className={formStyles.link}>Back to login</Link>
    </div>
  </AuthShell>;
}
