import { writeFileSync } from "node:fs";

// Amplify does not pass build variables to SSR automatically. Only non-secret
// settings belong in the deployed .env.production artifact. Secrets are fetched
// from encrypted Parameter Store with the production branch's compute role.
const required = [
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "SITE_URL", "S3_REGION", "S3_BUCKET_NAME", "SSM_REGION", "SSM_PARAMETER_PREFIX",
  "SUPABASE_CAPTCHA_ENABLED",
];
const optional = ["TRUSTED_CLIENT_IP_HEADER"];
const lines = [];
for (const name of [...required, ...optional]) {
  const value = process.env[name];
  if ((!value && required.includes(name)) || value?.match(/[\r\n]/)) {
    throw new Error(`Missing or invalid runtime setting: ${name}`);
  }
  if (value) lines.push(`${name}=${JSON.stringify(value)}`);
}
if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY.startsWith("0x")) {
  throw new Error("A production Turnstile widget is required");
}
writeFileSync(".env.production", lines.join("\n") + "\n", { mode: 0o600 });
console.log("Wrote public runtime settings; secret values excluded.");
