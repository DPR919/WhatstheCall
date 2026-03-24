import { S3Client } from "@aws-sdk/client-s3";

function getRequiredEnv(name: "S3_REGION" | "S3_ACCESS_KEY_ID" | "S3_SECRET_ACCESS_KEY") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const region = getRequiredEnv("S3_REGION");
const accessKeyId = getRequiredEnv("S3_ACCESS_KEY_ID");
const secretAccessKey = getRequiredEnv("S3_SECRET_ACCESS_KEY");

export const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});
