import { NextResponse } from "next/server";
import { getAlexeiRuntime } from "@/lib/alexei";
import { getBlog } from "@/lib/blog";
import { getCompendium } from "@/lib/compendium";
import { getHistory } from "@/lib/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [compendium, history, alexei, blog] = await Promise.all([getCompendium(), getHistory(), getAlexeiRuntime(), getBlog()]);
  return NextResponse.json({
    ok: true,
    database: compendium.source,
    persona: alexei.source,
    history: history.source,
    library: blog.source,
    counts: {
      styles: compendium.styles.length,
      techniques: compendium.techniques.length,
      fusions: compendium.mixedStyles.length,
      historyPeriods: history.periods.length,
      anthropologyLenses: history.anthropologyLenses.length,
      libraryArticles: blog.articles.length,
    },
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
  });
}
