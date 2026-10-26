import { NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerSession } from "@/lib/auth";
import { CulturalHoldError, buildPrompts, designSpecSchema, getPromptBuild, getPromptRegistry } from "@/lib/prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  spec: designSpecSchema,
  sessionId: z.string().uuid().optional(),
  models: z.array(z.string().trim().min(1).max(100)).max(8).optional(),
});

/** Without `buildId` this is the generator registry; with it, a stored build read back. */
export async function GET(request: Request) {
  if (!await getOwnerSession()) return NextResponse.json({ error: "Owner authentication required." }, { status: 401 });

  const buildId = new URL(request.url).searchParams.get("buildId");
  if (buildId) {
    const build = await getPromptBuild(buildId).catch(() => null);
    return build
      ? NextResponse.json(build)
      : NextResponse.json({ error: "No prompt build found for that id." }, { status: 404 });
  }

  const registry = await getPromptRegistry();
  return NextResponse.json({
    source: registry.source,
    models: registry.models.map((model) => ({
      key: model.modelKey,
      name: model.displayName,
      family: model.family,
      vendor: model.vendor,
      version: model.modelVersion,
      status: model.status,
      isDefault: model.isDefault,
      notes: model.notes,
      capabilities: model.capabilities,
    })),
  });
}

export async function POST(request: Request) {
  if (!await getOwnerSession()) return NextResponse.json({ error: "Owner authentication required." }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid design spec.", details: z.treeifyError(parsed.error) }, { status: 400 });
  }

  try {
    const build = await buildPrompts({
      spec: parsed.data.spec,
      sessionId: parsed.data.sessionId,
      modelKeys: parsed.data.models,
    });
    return NextResponse.json(build);
  } catch (error) {
    if (error instanceof CulturalHoldError) {
      return NextResponse.json({ error: error.message, culturalHold: true }, { status: 409 });
    }
    console.error("[InkTelligence] Prompt build error", error);
    return NextResponse.json({ error: "The prompt build could not be completed." }, { status: 500 });
  }
}
