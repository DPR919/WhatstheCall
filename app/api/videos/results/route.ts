import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const getResultsSchema = z.object({
  clipId: z.string().uuid(),
});

type ClipResponseValue = "left" | "no_touch" | "right";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = getResultsSchema.safeParse({
      clipId: searchParams.get("clipId"),
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid clip id." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { clipId } = parsed.data;

    const { data, error } = await supabaseAdmin
      .from("clip_responses")
      .select("response")
      .eq("clip_id", clipId)
      .neq("user_id", user.id);

    if (error) {
      console.error("[videos/results] Failed to fetch aggregated responses", {
        clipId,
        userId: user.id,
        error,
      });
      return NextResponse.json({ error: "Failed to load results." }, { status: 500 });
    }

    const counts: Record<ClipResponseValue, number> = {
      left: 0,
      no_touch: 0,
      right: 0,
    };

    for (const row of data ?? []) {
      const response = row.response as ClipResponseValue;
      if (response in counts) {
        counts[response] += 1;
      }
    }

    const total = counts.left + counts.no_touch + counts.right;

    return NextResponse.json({
      clipId,
      total,
      counts,
    });
  } catch (error) {
    console.error("[videos/results] Unexpected error", error);
    return NextResponse.json({ error: "Failed to load results." }, { status: 500 });
  }
}
