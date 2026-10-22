import { createHmac } from "node:crypto";
import { isIP } from "node:net";

export function privateLimitKey(secret: string, action: string, value: string): string {
  return createHmac("sha256", secret).update(`${action}\0${value}`).digest("hex");
}

export function clientAddress(headers: Headers, trustedHeader?: string): string {
  // Only opt in after the ingress is configured to overwrite this header.
  // Never accept the client-controlled first entry of X-Forwarded-For.
  if (!trustedHeader) return "shared";
  const value = headers.get(trustedHeader)?.trim();
  if (!value) return "shared";
  const last = value.split(",").at(-1)!.trim();
  const address = last.startsWith("[") ? last.slice(1, last.indexOf("]")) :
    isIP(last) ? last : last.replace(/:\d+$/, "");
  return isIP(address) ? address : "shared";
}

export function applicationOrigin(
  request: Request,
  siteUrl = process.env.SITE_URL,
  production = process.env.NODE_ENV === "production",
): string | null {
  try {
    // Hosting proxies can give Next.js an internal request URL. Only deployment
    // configuration determines the public origin; forwarding headers cannot.
    const configured = siteUrl?.trim();
    if (!configured && production) return null;
    const url = new URL(configured || request.url);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (production && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (configured && (url.pathname !== "/" || url.search || url.hash)) return null;
    return url.origin;
  } catch { return null; }
}

export function isSameOriginMutation(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true; // Non-browser API clients still pass other controls.
  try { return new URL(origin).origin === applicationOrigin(request); }
  catch { return false; }
}

export async function readSmallJson(request: Request, maxBytes = 16384): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new Error("Expected JSON");
  }
  if (Number(request.headers.get("content-length")) > maxBytes || !request.body) {
    throw new Error("Invalid request size");
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("Invalid request size");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function needsAdminMfa(role: string | undefined, level: string | null | undefined): boolean {
  return role === "admin" && level !== "aal2";
}
