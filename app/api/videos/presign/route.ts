import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { z } from "zod";
import { s3Client } from "@/lib/aws/s3";
import { createClient } from "@/lib/supabase/server";

const presignBodySchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1).max(100),
});

function getRequiredBucketName() {
  const bucketName = process.env.S3_BUCKET_NAME;

  if (!bucketName) {
    throw new Error("Missing required environment variable: S3_BUCKET_NAME");
  }

  return bucketName;
}

function sanitizeFileName(fileName: string) {
  const withoutPath = fileName.split(/[/\\]/).pop() ?? "upload";
  const trimmed = withoutPath.trim();

  const safeName = trimmed
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/-+/g, "-");

  return safeName.length > 0 ? safeName : "upload";
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: "Failed to verify upload access." }, { status: 500 });
    }
    if (profile?.role !== "admin" || profile.status !== "active") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const body = await req.json();
    const parsed = presignBodySchema.safeParse(body);

    if (!parsed.success) {
      console.error("[videos/presign] Invalid payload", parsed.error.flatten());
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const { fileName, fileType } = parsed.data;

    if (!fileType.startsWith("video/")) {
      return NextResponse.json({ error: "Only video uploads are allowed." }, { status: 400 });
    }

    const bucketName = getRequiredBucketName();
    const sanitizedFileName = sanitizeFileName(fileName);
    const key = `clips/${Date.now()}-${crypto.randomUUID()}-${sanitizedFileName}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 60 * 5,
    });

    return NextResponse.json({ uploadUrl, key });
  } catch (error) {
    console.error("[videos/presign] Failed to create presigned URL", error);
    return NextResponse.json({ error: "Failed to create upload URL." }, { status: 500 });
  }
}
