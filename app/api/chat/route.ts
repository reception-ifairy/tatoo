import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildAlexeiInstructions, getAlexeiRuntime } from "@/lib/alexei";
import { buildRelevantContext, getCompendium } from "@/lib/compendium";
import { getDbPool } from "@/lib/db";

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
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Brak OPENAI_API_KEY po stronie serwera. Dodaj klucz do .env.local i uruchom aplikację ponownie." },
      { status: 503 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowa wiadomość.", details: z.treeifyError(parsed.error) }, { status: 400 });
  }

  const { messages, sessionId } = parsed.data;
  const latestMessage = [...messages].reverse().find((message) => message.role === "user")?.content || "";

  try {
    const [compendium, runtimeBundle] = await Promise.all([getCompendium(), getAlexeiRuntime()]);
    const relevantContext = buildRelevantContext(compendium, latestMessage);
    const includeImageTemplate = /prompt|generator|midjourney|flux|sdxl|obraz|grafik/i.test(latestMessage);
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
    });
  } catch (error) {
    console.error("[InkTelligence] Chat error", error);
    const status = error instanceof OpenAI.APIError ? error.status || 502 : 500;
    const message = status === 429
      ? "Alexei potrzebuje chwili oddechu — limit API został chwilowo przekroczony. Spróbuj ponownie za moment."
      : "Nie udało się teraz połączyć z Alexeiem. Sprawdź konfigurację API i spróbuj ponownie.";
    return NextResponse.json({ error: message }, { status });
  }
}

async function persistExchange(sessionId: string, userMessage: string, assistantMessage: string) {
  const pool = getDbPool();
  await pool.execute(
    `INSERT IGNORE INTO consultation_sessions (session_id, agent_id, language_code, current_phase, status)
     VALUES (?, 'alexei_inkseer', 'pl', 1, 'active')`,
    [sessionId],
  );
  await pool.execute(
    `INSERT INTO consultation_messages (session_id, role, content) VALUES (?, 'user', ?), (?, 'assistant', ?)`,
    [sessionId, userMessage, sessionId, assistantMessage],
  );
}
