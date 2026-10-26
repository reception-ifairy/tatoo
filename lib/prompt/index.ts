import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { getDbPool, parseJson } from "@/lib/db";
import { composePromptIR } from "@/lib/prompt/compose";
import { getPromptRegistry } from "@/lib/prompt/registry";
import { renderPrompt } from "@/lib/prompt/render";
import type { DesignSpec, ImageModel, PromptBuild, PromptIR, RenderedPrompt } from "@/lib/prompt/types";

export { designSpecSchema } from "@/lib/prompt/types";
export { getPromptRegistry } from "@/lib/prompt/registry";

/** Raised when the design must not be rendered until its cultural question is resolved. */
export class CulturalHoldError extends Error {
  constructor() {
    super("This design is flagged for cultural review. Resolve the symbol with the client before any render is built.");
    this.name = "CulturalHoldError";
  }
}

export interface BuildOptions {
  spec: DesignSpec;
  sessionId?: string;
  modelKeys?: string[];
}

/**
 * One design in, every requested generator out. The spec is resolved against the compendium
 * once, then rendered per target, and both the resolved representation and each render are
 * written back so a build can be reproduced and audited later.
 */
export async function buildPrompts({ spec, sessionId, modelKeys }: BuildOptions): Promise<PromptBuild> {
  if (spec.culturalCheck === "flagged") throw new CulturalHoldError();

  const registry = await getPromptRegistry();
  const models = selectModels(registry.models, modelKeys);
  if (!models.length) throw new Error("No image model matched the requested targets.");

  const ir = await composePromptIR(spec, registry.blocks);
  const renders = models.map((model) => renderPrompt(ir, model));
  const buildId = randomUUID();
  const persisted = await persistBuild(buildId, sessionId, spec, ir, renders).catch((error) => {
    console.warn("[InkTelligence] Prompt build not persisted.", error instanceof Error ? error.message : error);
    return false;
  });

  return { buildId, sessionId: sessionId || null, spec, ir, renders, persisted, registrySource: registry.source };
}

/** Requested keys keep their order; an unknown key is ignored rather than failing the build. */
function selectModels(models: ImageModel[], modelKeys?: string[]): ImageModel[] {
  if (!modelKeys?.length) return models.filter((model) => model.status !== "deprecated");
  return modelKeys
    .map((key) => models.find((model) => model.modelKey === key))
    .filter((model): model is ImageModel => Boolean(model));
}

async function persistBuild(
  buildId: string,
  sessionId: string | undefined,
  spec: DesignSpec,
  ir: PromptIR,
  renders: RenderedPrompt[],
): Promise<boolean> {
  const pool = getDbPool();
  if (sessionId) {
    await pool.execute(
      `INSERT IGNORE INTO consultation_sessions (session_id, agent_id, language_code, current_phase, status)
       VALUES (?, 'alexei_inkseer', 'en', 5, 'active')`,
      [sessionId],
    );
  }

  await pool.execute(
    `INSERT INTO prompt_builds (build_id, session_id, design_spec, prompt_ir, catalog_refs, render_mode, cultural_check, warnings)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      buildId,
      sessionId || null,
      JSON.stringify(spec),
      JSON.stringify(ir),
      JSON.stringify(ir.catalogRefs),
      ir.renderMode,
      ir.culturalCheck,
      JSON.stringify(ir.warnings),
    ],
  );

  for (const render of renders) {
    await pool.execute(
      `INSERT INTO prompt_build_renders (build_id, model_key, prompt, negative_prompt, parameters, char_count, truncated)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [buildId, render.modelKey, render.prompt, render.negativePrompt, JSON.stringify(render.parameters), render.charCount, render.truncated ? 1 : 0],
    );
  }
  return true;
}

interface BuildRow extends RowDataPacket {
  build_id: string;
  session_id: string | null;
  design_spec: unknown;
  prompt_ir: unknown;
  model_key: string;
  model_name: string;
  model_family: string;
  prompt: string;
  negative_prompt: string | null;
  parameters: unknown;
  char_count: number;
  truncated: number;
}

/** Reads a stored build back, so a prompt can be reproduced without rebuilding it. */
export async function getPromptBuild(buildId: string): Promise<PromptBuild | null> {
  const [rows] = await getDbPool().query<BuildRow[]>("SELECT * FROM v_prompt_build_bundle WHERE build_id = ?", [buildId]);
  if (!rows.length) return null;

  const first = rows[0];
  return {
    buildId: first.build_id,
    sessionId: first.session_id,
    spec: parseJson<DesignSpec>(first.design_spec, {} as DesignSpec),
    ir: parseJson<PromptIR>(first.prompt_ir, {} as PromptIR),
    renders: rows.map((row) => ({
      modelKey: row.model_key,
      modelName: row.model_name,
      family: row.model_family,
      prompt: row.prompt,
      negativePrompt: row.negative_prompt,
      parameters: parseJson<Record<string, unknown>>(row.parameters, {}),
      charCount: row.char_count,
      truncated: Boolean(row.truncated),
      followUpHint: null,
    })),
    persisted: true,
    registrySource: "sql",
  };
}
