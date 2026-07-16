import { NextResponse } from "next/server";
import { getAlexeiRuntime } from "@/lib/alexei";
import { getCompendium } from "@/lib/compendium";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [compendium, alexei] = await Promise.all([getCompendium(), getAlexeiRuntime()]);
  return NextResponse.json({
    ok: true,
    database: compendium.source,
    persona: alexei.source,
    counts: {
      styles: compendium.styles.length,
      techniques: compendium.techniques.length,
      fusions: compendium.mixedStyles.length,
    },
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
  });
}
