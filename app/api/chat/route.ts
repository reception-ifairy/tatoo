import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildAlexeiInstructions, getAlexeiRuntime } from "@/lib/alexei";
import { buildRelevantContext, getCompendium } from "@/lib/compendium";
import { getDbPool } from "@/lib/db";
import { getOwnerSession } from "@/lib/auth";
import { CulturalHoldError, buildPrompts } from "@/lib/prompt";
import { parseDesignSpecBlock } from "@/lib/prompt/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(5_000),
  })).min(1).max(20),
  sessionId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  if (!await getOwnerSession()) return NextResponse.json({ error: "Owner authentication required." }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is missing on the server. Add it to .env.local and restart the application." },
      { status: 503 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid message.", details: z.treeifyError(parsed.error) }, { status: 400 });
  }

  const { messages, sessionId } = parsed.data;
  const latestMessage = [...messages].reverse().find((message) => message.role === "user")?.content || "";

  try {
    const [compendium, runtimeBundle] = await Promise.all([getCompendium(), getAlexeiRuntime()]);
    const relevantContext = buildRelevantContext(compendium, latestMessage);
    const includeImageTemplate = /prompt|generator|midjourney|flux|sdxl|image|visual|artwork/i.test(latestMessage);
    const instructions = buildAlexeiInstructions(runtimeBundle, relevantContext, includeImageTemplate);
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      instructions,
      input: messages.slice(-12).map((message) => ({ role: message.role, content: message.content })),
      max_output_tokens: 1_000,
      store: false,
    });

    const answer = response.output_text?.trim();
    if (!answer) throw new Error("OpenAI returned an empty response");

    if (sessionId) await persistExchange(sessionId, latestMessage, answer).catch((error) => {
      console.warn("[InkTelligence] Chat persistence skipped.", error instanceof Error ? error.message : error);
    });

    return NextResponse.json({
      answer,
      requestId: response._request_id,
      sources: { compendium: compendium.source, persona: runtimeBundle.source },
      promptBuild: await buildFromReply(answer, sessionId),
    });
  } catch (error) {
    console.error("[InkTelligence] Chat error", error);
    const status = error instanceof OpenAI.APIError ? error.status || 502 : 500;
    const message = status === 429
      ? "Alexei needs a moment — the API rate limit was reached. Please try again shortly."
      : "Alexei could not be reached. Check the API configuration and try again.";
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * When a turn produces a Phase 5 spec, the generator prompts are built from it immediately.
 * A missing spec is the normal case, and a build failure must never cost the client their
 * reply — either way the conversation is returned untouched.
 */
async function buildFromReply(answer: string, sessionId?: string) {
  const spec = parseDesignSpecBlock(answer);
  if (!spec) return null;
  try {
    return await buildPrompts({ spec, sessionId });
  } catch (error) {
    if (error instanceof CulturalHoldError) return { culturalHold: true, reason: error.message };
    console.warn("[InkTelligence] Prompt build skipped.", error instanceof Error ? error.message : error);
    return null;
  }
}

async function persistExchange(sessionId: string, userMessage: string, assistantMessage: string) {
  const pool = getDbPool();
  await pool.execute(
    `INSERT IGNORE INTO consultation_sessions (session_id, agent_id, language_code, current_phase, status)
     VALUES (?, 'alexei_inkseer', 'en', 1, 'active')`,
    [sessionId],
  );
  await pool.execute(
    `INSERT INTO consultation_messages (session_id, role, content) VALUES (?, 'user', ?), (?, 'assistant', ?)`,
    [sessionId, userMessage, sessionId, assistantMessage],
  );
}
