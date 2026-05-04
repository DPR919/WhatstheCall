import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { z } from "zod";
import { s3Client } from "@/lib/aws/s3";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const getClipSchema = z.object({
  clipId: z.string().uuid(),
});

function getRequiredBucketName() {
  const bucketName = process.env.S3_BUCKET_NAME;

  if (!bucketName) {
    throw new Error("Missing required environment variable: S3_BUCKET_NAME");
  }

  return bucketName;
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const url = new URL(req.url);
    const parsed = getClipSchema.safeParse({
      clipId: url.searchParams.get("clipId"),
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid clip id." }, { status: 400 });
    }

    const { clipId } = parsed.data;

    const { data: responseRow, error: responseError } = await supabaseAdmin
      .from("clip_responses")
      .select("clip_id")
      .eq("clip_id", clipId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (responseError) {
      console.error("[videos/clip] Failed to verify user response access", responseError);
      return NextResponse.json({ error: "Failed to retrieve clip." }, { status: 500 });
    }

    if (!responseRow) {
      return NextResponse.json({ error: "Clip not found." }, { status: 404 });
    }

    const { data: clipRow, error: clipError } = await supabaseAdmin
      .from("clips")
      .select("id, s3_key")
      .eq("id", clipId)
      .maybeSingle();

    if (clipError) {
      console.error("[videos/clip] Failed to fetch clip row", clipError);
      return NextResponse.json({ error: "Failed to retrieve clip." }, { status: 500 });
    }

    if (!clipRow?.s3_key) {
      return NextResponse.json({ error: "Clip not found." }, { status: 404 });
    }

    const getObjectCommand = new GetObjectCommand({
      Bucket: getRequiredBucketName(),
      Key: clipRow.s3_key,
    });

    const videoUrl = await getSignedUrl(s3Client, getObjectCommand, {
      expiresIn: 60 * 10,
    });

    return NextResponse.json({ clipId: clipRow.id, videoUrl });
  } catch (error) {
    console.error("[videos/clip] Unexpected error", error);
    return NextResponse.json({ error: "Failed to retrieve clip." }, { status: 500 });
  }
}