import { NextResponse } from "next/server";
import { recoveryContext } from "@/lib/security/recovery";

export async function GET() {
  try {
    const context = await recoveryContext();
    if (!context) return NextResponse.json({ error: "This recovery session is invalid or expired. Request a new link." }, { status: 401 });
    return NextResponse.json({ requiresMfa: context.requiresMfa, factors: context.factors,
      needsSignout: context.grant.phase === "signout" });
  } catch {
    return NextResponse.json({ error: "Recovery is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
