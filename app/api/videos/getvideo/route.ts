import {
  GetObjectCommand,
  ListObjectsV2Command,
  type _Object,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { s3Client } from "@/lib/aws/s3";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function getRequiredBucketName() {
  const bucketName = process.env.S3_BUCKET_NAME;

  if (!bucketName) {
    throw new Error("Missing required environment variable: S3_BUCKET_NAME");
  }

  return bucketName;
}

type ClipRow = {
  id: string;
  s3_key: string;
};

type ClipResponseRow = {
  clip_id: string;
};

function pickRandomObject(items: _Object[]) {
  if (items.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex] ?? null;
}

async function pickEligibleClipFromS3Objects(
  objects: _Object[],
  recentlyAnsweredClipIds: Set<string>,
) {
  const remainingObjects = [...objects];

  while (remainingObjects.length > 0) {
    const randomObject = pickRandomObject(remainingObjects);
    if (!randomObject?.Key) {
      return null;
    }

    const objectIndex = remainingObjects.findIndex((item) => item.Key === randomObject.Key);
    if (objectIndex >= 0) {
      remainingObjects.splice(objectIndex, 1);
    }

    const syncedClip = await ensureClipRecordForS3Key(randomObject.Key);
    if (!syncedClip) {
      continue;
    }

    if (!recentlyAnsweredClipIds.has(syncedClip.id)) {
      return syncedClip;
    }
  }

  return null;
}

function pickRandomClip(items: ClipRow[]) {
  if (items.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex] ?? null;
}

async function ensureClipRecordForS3Key(s3Key: string) {
  const { data: insertedClip, error: insertError } = await supabaseAdmin
    .from("clips")
    .insert({
      s3_key: s3Key,
      status: "active",
    })
    .select("id, s3_key")
    .single();

  if (!insertError && insertedClip) {
    return insertedClip;
  }

  const isDuplicateKey = insertError?.code === "23505";
  if (isDuplicateKey) {
    const { data: existingClip, error: fetchExistingError } = await supabaseAdmin
      .from("clips")
      .select("id, s3_key")
      .eq("s3_key", s3Key)
      .maybeSingle();

    if (!fetchExistingError && existingClip) {
      return existingClip;
    }

    console.error("[videos/getvideo] Duplicate clip exists but could not be fetched", {
      s3Key,
      insertError,
      fetchExistingError,
    });
    return null;
  }

  console.error("[videos/getvideo] Failed to register clip row for S3 key", {
    s3Key,
    insertError,
  });
  return null;
}

export async function GET() {
  try {
    const bucketName = getRequiredBucketName();

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[videos/getvideo] Unauthorized request", authError);
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: activeClips, error: clipsError } = await supabaseAdmin
      .from("clips")
      .select("id, s3_key")
      .eq("status", "active")
      .limit(1000);

    if (clipsError) {
      console.error("[videos/getvideo] Failed to fetch active clips", clipsError);
      return NextResponse.json(
        { error: "Failed to retrieve a clip." },
        { status: 500 },
      );
    }

    const timeWindow = 6;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - timeWindow);

    const { data: recentResponses, error: responsesError } = await supabaseAdmin
      .from("clip_responses")
      .select("clip_id")
      .eq("user_id", user.id)
      .gte("created_at", sixMonthsAgo.toISOString())
      .limit(5000);

    if (responsesError) {
      console.error("[videos/getvideo] Failed to fetch recent user responses", {
        userId: user.id,
        responsesError,
      });
      return NextResponse.json(
        { error: "Failed to retrieve a clip." },
        { status: 500 },
      );
    }

    const recentlyAnsweredClipIds = new Set(
      ((recentResponses ?? []) as ClipResponseRow[]).map((item) => item.clip_id),
    );

    const eligibleActiveClips = (activeClips ?? []).filter(
      (clip) => !recentlyAnsweredClipIds.has(clip.id),
    );

    let randomClip = pickRandomClip(eligibleActiveClips);

    if (!randomClip) {
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

      randomClip = await pickEligibleClipFromS3Objects(
        availableClipObjects,
        recentlyAnsweredClipIds,
      );
    }

    if (!randomClip?.s3_key) {
      return NextResponse.json(
        {
          error: "You have covered all clips we have to offer. Check back when we have more!",
        },
        { status: 404 },
      );
    }

    const getObjectCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: randomClip.s3_key,
    });

    const videoUrl = await getSignedUrl(s3Client, getObjectCommand, {
      expiresIn: 60 * 10,
    });

    return NextResponse.json({
      clipId: randomClip.id,
      s3Key: randomClip.s3_key,
      videoUrl,
    });
  } catch (error) {
    console.error("[videos/getvideo] Failed to retrieve clip", error);
    return NextResponse.json(
      { error: "Failed to retrieve a clip." },
      { status: 500 },
    );
  }
}