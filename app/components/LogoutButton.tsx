"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./Button";

export function LogoutButton() {
  const { pending } = useFormStatus();

  return (
    <>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Logging out..." : "Log Out"}
      </Button>

      {pending ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xs rounded-lg bg-white p-6 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
              <p className="text-sm text-gray-900">Logging out</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}