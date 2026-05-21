import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const registerClipSchema = z.object({
  s3Key: z.string().trim().min(1).max(2048),
  title: z.string().trim().max(300).optional(),
  eventName: z.string().trim().max(300).optional(),
  leftFencer: z.string().trim().max(200).optional(),
  rightFencer: z.string().trim().max(200).optional(),
  weapon: z.string().trim().max(100).optional(),
  sourceUrl: z.string().trim().url().max(2048).optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional(),
  scoreAtTouch: z.string().trim().max(100).optional(),
});

function emptyToNull(value?: string) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerClipSchema.safeParse(body);

    if (!parsed.success) {
      console.error("[videos/register] Invalid payload", parsed.error.flatten());
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const { s3Key, title, eventName, leftFencer, rightFencer, weapon, sourceUrl, notes, scoreAtTouch } =
      parsed.data;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[videos/register] Unauthorized request", authError);
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: insertedClip, error: insertError } = await supabaseAdmin
      .from("clips")
      .insert({
        s3_key: s3Key,
        uploaded_by_user_id: user.id,
        status: "active",
        title: emptyToNull(title),
        event_name: emptyToNull(eventName),
        left_fencer: emptyToNull(leftFencer),
        right_fencer: emptyToNull(rightFencer),
        weapon: emptyToNull(weapon),
        source_url: emptyToNull(sourceUrl),
        notes: emptyToNull(notes),
        score_at_touch: emptyToNull(scoreAtTouch),
      })
      .select(
        "id, s3_key, uploaded_by_user_id, status, created_at, title, event_name, left_fencer, right_fencer, weapon, source_url, notes, score_at_touch",
      )
      .single();

    if (!insertError && insertedClip) {
      return NextResponse.json({ clip: insertedClip });
    }

    const isDuplicateKey = insertError?.code === "23505";

    if (isDuplicateKey) {
      const { data: existingClip, error: fetchExistingError } = await supabaseAdmin
        .from("clips")
        .select(
          "id, s3_key, uploaded_by_user_id, status, created_at, title, event_name, left_fencer, right_fencer, weapon, source_url, notes, score_at_touch",
        )
        .eq("s3_key", s3Key)
        .maybeSingle();

      if (fetchExistingError || !existingClip) {
        console.error("[videos/register] Duplicate clip exists but could not be fetched", {
          s3Key,
          insertError,
          fetchExistingError,
        });
        return NextResponse.json({ error: "Failed to fetch existing clip." }, { status: 500 });
      }

      return NextResponse.json({ clip: existingClip });
    }

    console.error("[videos/register] Failed to insert clip", {
      s3Key,
      userId: user.id,
      insertError,
    });
    return NextResponse.json({ error: "Failed to register uploaded clip." }, { status: 500 });
  } catch (error) {
    console.error("[videos/register] Unexpected error", error);
    return NextResponse.json({ error: "Failed to register uploaded clip." }, { status: 500 });
  }
}