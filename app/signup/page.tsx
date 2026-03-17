"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "../components/Container";
import { Section } from "../components/Section";
import { formStyles } from "../constants/design-system";

interface SignupFormState {
  email: string;
  password: string;
  displayName: string;
  inviteCode: string;
}

const initialForm: SignupFormState = {
  email: "",
  password: "",
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
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Signup failed.");
        return;
      }

      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });

      const loginData = await loginResponse.json();

      if (!loginResponse.ok) {
        setMessage(loginData.error ?? "Signup succeeded, but auto-login failed. Please log in.");
        return;
      }

      router.push("/main");
      router.refresh();
    } catch {
      setMessage("Unexpected error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Section variant="gray" className="min-h-screen py-16">
      <Container size="sm">
        <div className="rounded-lg bg-white p-8 shadow-md">
          <h1 className="mb-2 text-4xl text-gray-900">Create your account</h1>
          <p className="mb-8 text-sm text-gray-600">Enter your details and invite code to get started.</p>

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
              <label htmlFor="password" className={formStyles.label}>
                Password
              </label>
              <input
                id="password"
                className={formStyles.input}
                placeholder="At least 8 characters"
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                minLength={8}
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
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>
          </form>

          {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}

          <div className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <button
              type="button"
              className={formStyles.link}
              onClick={() => router.push("/")}
            >
              Go back to Log In
            </button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
