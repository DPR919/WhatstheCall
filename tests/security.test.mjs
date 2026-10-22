import test from "node:test";
import assert from "node:assert/strict";
import { clientAddress, isSameOriginMutation, needsAdminMfa, privateLimitKey, readSmallJson } from "../lib/security/policy.ts";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

test("untrusted forwarding headers cannot choose a rate limit identity", () => {
  const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8", "cloudfront-viewer-address": "[2001:db8::1]:443" });
  assert.equal(clientAddress(headers), "shared");
  assert.equal(clientAddress(headers, "x-forwarded-for"), "5.6.7.8");
  assert.equal(clientAddress(headers, "cloudfront-viewer-address"), "2001:db8::1");
  assert.equal(clientAddress(new Headers({ ip: "malformed" }), "ip"), "shared");
});

test("stored rate limit identities are keyed hashes separated by action", () => {
  const key = privateLimitKey("secret", "login", "person@example.com");
  assert.match(key, /^[a-f0-9]{64}$/);
  assert.notEqual(key, privateLimitKey("secret", "signup", "person@example.com"));
  assert.notEqual(key, privateLimitKey("other-secret", "login", "person@example.com"));
});

test("mutations reject cross-site and mismatched origins", () => {
  const request = (headers) => new Request("https://www.whatsthecall.net/api/auth/login", { method: "POST", headers });
  assert.equal(isSameOriginMutation(request({ origin: "https://attacker.example" })), false);
  assert.equal(isSameOriginMutation(request({ origin: "null" })), false);
  assert.equal(isSameOriginMutation(request({ "sec-fetch-site": "cross-site" })), false);
  assert.equal(isSameOriginMutation(request({ origin: "https://www.whatsthecall.net" })), true);
});

test("JSON parsing bounds actual bytes, even without Content-Length", async () => {
  const request = (body, type = "application/json") => new Request("http://localhost/api", { method: "POST", headers: { "content-type": type }, body });
  assert.deepEqual(await readSmallJson(request('{"ok":true}')), { ok: true });
  await assert.rejects(readSmallJson(request('"' + "x".repeat(17000) + '"')));
  await assert.rejects(readSmallJson(request('{bad')));
  await assert.rejects(readSmallJson(request('{}', 'text/plain')));
});

test("admin authorization fails closed until a second factor is verified", () => {
  assert.equal(needsAdminMfa("admin", null), true);
  assert.equal(needsAdminMfa("admin", "aal1"), true);
  assert.equal(needsAdminMfa("admin", "aal2"), false);
  assert.equal(needsAdminMfa("user", "aal1"), false);
});

test("Amplify runtime artifacts exclude credentials even when the build has secrets", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "wtc-security-"));
  const script = fileURLToPath(new URL("../scripts/write-runtime-config.mjs", import.meta.url));
  const env = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x-test-widget", SITE_URL: "https://www.whatsthecall.net",
    S3_REGION: "us-east-2", S3_BUCKET_NAME: "whatsthecall-videos", SSM_REGION: "us-east-2",
    SSM_PARAMETER_PREFIX: "/whatsthecall/production", SUPABASE_CAPTCHA_ENABLED: "true",
    SUPABASE_SERVICE_ROLE_KEY: "private-service-secret", TURNSTILE_SECRET_KEY: "private-captcha-secret",
    S3_SECRET_ACCESS_KEY: "private-aws-secret", RATE_LIMIT_SECRET: "private-rate-secret",
  };
  try {
    const result = spawnSync(process.execPath, [script], { cwd: directory, env, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const artifact = readFileSync(resolve(directory, ".env.production"), "utf8");
    assert.match(artifact, /SSM_PARAMETER_PREFIX/);
    assert.doesNotMatch(artifact, /private-|SUPABASE_SERVICE_ROLE_KEY|TURNSTILE_SECRET_KEY|S3_SECRET_ACCESS_KEY|RATE_LIMIT_SECRET/);
    const invalid = spawnSync(process.execPath, [script], { cwd: directory,
      env: { ...env, NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA" }, encoding: "utf8" });
    assert.notEqual(invalid.status, 0);
  } finally {
    if (!resolve(directory).startsWith(resolve(tmpdir()) + sep)) throw new Error("Unsafe temporary path");
    rmSync(directory, { recursive: true, force: true });
  }
});
