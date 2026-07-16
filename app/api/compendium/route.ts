import { NextResponse } from "next/server";
import { getCompendium } from "@/lib/compendium";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getCompendium();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
