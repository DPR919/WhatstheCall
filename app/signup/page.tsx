"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "../components/AuthShell";
import { formStyles } from "../constants/design-system";

interface SignupFormState {
  email: string;
  displayName: string;
  inviteCode: string;
}

const initialForm: SignupFormState = {
  email: "",
  displayName: "",
  inviteCode: "",
};

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState<SignupFormState>(initialForm);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSubmitting(true);
    setMessage("Submitting...");

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          displayName: form.displayName,
          inviteCode: form.inviteCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Signup failed.");
        return;
      }

      setMessage("Check your email for an invitation link. Open it to set your password.");
      setForm(initialForm);
    } catch {
      setMessage("Unexpected error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell eyebrow="Join the conversation" heading="Come study with us." description="Enter a member's invite code. We'll email you a link to set your password.">
          <form onSubmit={handleSubmit}>
            <div className={formStyles.inputGroup}>
              <label htmlFor="displayName" className={formStyles.label}>
                Display name
              </label>
              <input
                id="displayName"
                className={formStyles.input}
                placeholder="Display name"
                value={form.displayName}
                onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                minLength={2}
                maxLength={50}
                required
              />
            </div>

            <div className={formStyles.inputGroup}>
              <label htmlFor="email" className={formStyles.label}>
                Email
              </label>
              <input
                id="email"
                className={formStyles.input}
                placeholder="you@example.com"
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
              />
            </div>

            <div className={formStyles.inputGroup}>
              <label htmlFor="inviteCode" className={formStyles.label}>
                Invite code
              </label>
              <input
                id="inviteCode"
                className={formStyles.input}
                placeholder="Invite code"
                value={form.inviteCode}
                onChange={(event) => setForm({ ...form, inviteCode: event.target.value })}
                minLength={3}
                maxLength={100}
                required
              />
            </div>

            <button type="submit" className={formStyles.submitButton} disabled={isSubmitting}>
              {isSubmitting ? "Sending invitation..." : "Send invitation email"}
            </button>
          </form>

          {message && <p className="status-note mt-4" role="status">{message}</p>}

          <div className="auth-bottom">
            Already have an account?{" "}
            <button
              type="button"
              className={formStyles.link}
              onClick={() => router.push("/login")}
            >
              Go back to Log In
            </button>
          </div>
    </AuthShell>
  );
}
