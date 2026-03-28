import {
  GetObjectCommand,
  ListObjectsV2Command,
  type _Object,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { s3Client } from "@/lib/aws/s3";

function getRequiredBucketName() {
  const bucketName = process.env.S3_BUCKET_NAME;

  if (!bucketName) {
    throw new Error("Missing required environment variable: S3_BUCKET_NAME");
  }

  return bucketName;
}

function pickRandomObject(items: _Object[]) {
  if (items.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex] ?? null;
}

export async function GET() {
  try {
    const bucketName = getRequiredBucketName();

    const listResponse = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: "clips/",
        MaxKeys: 1000,
      }),
    );

    const availableClipObjects = (listResponse.Contents ?? []).filter(
      (item) => Boolean(item.Key) && (item.Size ?? 0) > 0,
    );

    const randomClip = pickRandomObject(availableClipObjects);

    if (!randomClip?.Key) {
      return NextResponse.json(
        { error: "No uploaded clips available yet." },
        { status: 404 },
      );
    }

    const getObjectCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: randomClip.Key,
    });

    const videoUrl = await getSignedUrl(s3Client, getObjectCommand, {
      expiresIn: 60 * 10,
    });

    return NextResponse.json({ videoUrl, key: randomClip.Key });
  } catch (error) {
    console.error("[videos/get-video] Failed to retrieve clip", error);
    return NextResponse.json(
      { error: "Failed to retrieve a clip." },
      { status: 500 },
    );
  }
}