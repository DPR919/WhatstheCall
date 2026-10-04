"use client";

import { useFormStatus } from "react-dom";

export function LogoutButton() {
  const { pending } = useFormStatus();

  return (
    <>
      <button type="submit" className="member-logout" disabled={pending}>
        {pending ? "Signing out..." : "Sign out →"}
      </button>

      {pending ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="paper-panel w-full max-w-xs">
            <div className="flex items-center gap-3">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-red-800" />
              <p className="text-sm">Signing out</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
