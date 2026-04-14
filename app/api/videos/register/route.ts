import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const registerClipSchema = z.object({
  s3Key: z.string().trim().min(1).max(2048),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerClipSchema.safeParse(body);

    if (!parsed.success) {
      console.error("[videos/register] Invalid payload", parsed.error.flatten());
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const { s3Key } = parsed.data;

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
      })
      .select("id, s3_key, uploaded_by_user_id, status, created_at")
      .single();

    if (!insertError && insertedClip) {
      return NextResponse.json({ clip: insertedClip });
    }

    const isDuplicateKey = insertError?.code === "23505";

    if (isDuplicateKey) {
      const { data: existingClip, error: fetchExistingError } = await supabaseAdmin
        .from("clips")
        .select("id, s3_key, uploaded_by_user_id, status, created_at")
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