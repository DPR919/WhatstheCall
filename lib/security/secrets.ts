import "server-only";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

type SecretName = "SUPABASE_SERVICE_ROLE_KEY" | "TURNSTILE_SECRET_KEY" | "RATE_LIMIT_SECRET";
const client = new SSMClient({ region: process.env.SSM_REGION || process.env.S3_REGION });
const cache = new Map<string, { expires: number; value: Promise<string | undefined> }>();

export async function serverSecret(name: SecretName): Promise<string | undefined> {
  const prefix = process.env.SSM_PARAMETER_PREFIX?.replace(/\/$/, "");
  if (!prefix) return process.env[name];
  const cached = cache.get(name);
  if (cached && cached.expires > Date.now()) return cached.value;
  const value = client.send(new GetParameterCommand({ Name: `${prefix}/${name}`, WithDecryption: true }))
    .then((response) => response.Parameter?.Value)
    .catch(() => {
      cache.delete(name);
      // Do not log SDK request details or parameter values.
      throw new Error("Runtime secret is unavailable");
    });
  cache.set(name, { expires: Date.now() + 5 * 60 * 1000, value });
  return value;
}
