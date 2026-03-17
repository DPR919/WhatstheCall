"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "../components/Container";
import { Section } from "../components/Section";
import { formStyles } from "../constants/design-system";

interface LoginFormState {
  email: string;
  password: string;
}

const initialForm: LoginFormState = {
  email: "",
  password: "",
};

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState<LoginFormState>(initialForm);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("Signing in...");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Login failed.");
        return;
      }

      setMessage("Login successful.");
      router.push("/");
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
          <h1 className="mb-2 text-4xl text-gray-900">Log In</h1>
          <p className="mb-8 text-sm text-gray-600">Welcome back. Sign in to continue.</p>

          <form onSubmit={handleSubmit}>
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
                placeholder="••••••••"
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                minLength={8}
                required
              />
            </div>

            <button type="submit" className={formStyles.submitButton} disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Log in"}
            </button>
          </form>

          {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}

          <div className="mt-6 text-center text-sm text-gray-600">
            Need an account?{" "}
            <button
              type="button"
              className={formStyles.link}
              onClick={() => router.push("/signup")}
            >
              Sign up
            </button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
