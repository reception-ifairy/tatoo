import { NextResponse } from "next/server";
import { getCompendium } from "@/lib/compendium";
import { getOwnerSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!await getOwnerSession()) return NextResponse.json({ error: "Owner authentication required." }, { status: 401 });
  const data = await getCompendium();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
