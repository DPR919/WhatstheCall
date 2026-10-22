import "server-only";
import { serverSecret } from "./secrets";
import { applicationOrigin } from "./policy";

export async function verifyCaptcha(token: string | undefined, action: "login" | "signup", request: Request): Promise<boolean> {
  let secret: string | undefined;
  try { secret = await serverSecret("TURNSTILE_SECRET_KEY"); } catch { return false; }
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  // Local development works without third-party credentials. Production must
  // explicitly configure both halves before accepting public auth requests.
  if (!secret && !siteKey) return process.env.NODE_ENV !== "production";
  if (!secret || !siteKey || !token || token.length > 2048) return false;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
      signal: AbortSignal.timeout(10000), cache: "no-store",
    });
    const result = await response.json();
    const origin = applicationOrigin(request);
    return response.ok && result.success === true && result.action === action &&
      origin !== null && result.hostname === new URL(origin).hostname;
  } catch { return false; }
}
