import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const submitResponseSchema = z.object({
  clipId: z.string().uuid(),
  response: z.enum(["left", "no_touch", "right"]),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = submitResponseSchema.safeParse(body);

    if (!parsed.success) {
      console.error("[videos/respond] Invalid payload", parsed.error.flatten());
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[videos/respond] Unauthorized request", authError);
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { clipId, response } = parsed.data;

    const { data: insertedResponse, error: insertError } = await supabaseAdmin
      .from("clip_responses")
      .insert({
        clip_id: clipId,
        user_id: user.id,
        response,
      })
      .select("id, clip_id, user_id, response, created_at")
      .single();

    if (!insertError && insertedResponse) {
      return NextResponse.json({ clipResponse: insertedResponse });
    }

    if (insertError?.code === "23505") {
      return NextResponse.json(
        { error: "You already responded to this clip." },
        { status: 409 },
      );
    }

    if (insertError?.code === "23503") {
      return NextResponse.json({ error: "Clip not found." }, { status: 404 });
    }

    console.error("[videos/respond] Failed to insert clip response", {
      clipId,
      userId: user.id,
      response,
      insertError,
    });
    return NextResponse.json({ error: "Failed to submit response." }, { status: 500 });
  } catch (error) {
    console.error("[videos/respond] Unexpected error", error);
    return NextResponse.json({ error: "Failed to submit response." }, { status: 500 });
  }
}