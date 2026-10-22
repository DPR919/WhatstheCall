import "server-only";
import { S3Client } from "@aws-sdk/client-s3";

function getRequiredEnv(name: "S3_REGION") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const region = getRequiredEnv("S3_REGION");
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
  throw new Error("Set both local S3 credentials, or omit both to use the compute role.");
}

export const s3Client = new S3Client({
  region,
  // The default credential chain supports Amplify's SSR compute role. Retain
  // explicitly supplied credentials for local development and staged rollout.
  ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
});
