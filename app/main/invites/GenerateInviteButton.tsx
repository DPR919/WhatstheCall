"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateInviteButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function generate() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/invites/generate", { method: "POST" });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "Could not create code.");
        return;
      }
      setMessage(`Created ${result.code}`);
      router.refresh();
    } catch {
      setMessage("Could not create code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div>
    <button type="button" onClick={generate} disabled={disabled || busy}
      className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
      {busy ? "Creating..." : "Create invite code"}
    </button>
    {message && <p className="mt-3 text-sm text-gray-700">{message}</p>}
  </div>;
}
