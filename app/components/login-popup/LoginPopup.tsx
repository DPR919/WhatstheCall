"use client";

import { type FormEvent, useState } from "react";
import { formStyles, modalStyles } from "../../constants/design-system";

interface LoginFormProps {
  onClose: () => void;
}

/**
 * Login Form Component
 * Handles user authentication (currently stub - add real auth later)
 */
export function LoginForm({ onClose }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    // TODO: Add real authentication logic here
    console.log("Login attempt:", { email, password });

    // For now, just close the modal
    alert("Login functionality coming soon!");
    onClose();
  };

  return (
    <div>
      <h2 className={modalStyles.title}>Log In</h2>

      <form onSubmit={handleSubmit}>
        <div className={formStyles.inputGroup}>
          <label htmlFor="email" className={formStyles.label}>
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={formStyles.input}
            placeholder="you@example.com"
            required
          />
        </div>

        <div className={formStyles.inputGroup}>
          <label htmlFor="password" className={formStyles.label}>
            Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={formStyles.input}
            placeholder="••••••••"
            required
          />
        </div>

        <button type="submit" className={formStyles.submitButton}>
          Log In
        </button>

        <div className={formStyles.helperText}>
          <a href="#" className={formStyles.link}>
            Forgot password?
          </a>
        </div>

        <div className={formStyles.helperText}>
          Don&apos;t have an account? <a href="#" className={formStyles.link}>Sign up</a>
        </div>
      </form>
    </div>
  );
}

export default LoginForm;