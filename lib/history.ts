import type { RowDataPacket } from "mysql2";
import sourceDatabase from "@/scripts/database/tattoo_database.backup.json";
import { getDbPool } from "@/lib/db";
import type { AnthropologyLens, HistoryData, HistoryPeriod } from "@/lib/types";

interface PeriodRow extends RowDataPacket {
  period_id: string;
  display_order: number;
  date_label: string;
  title: string;
  summary: string;
  source_label: string | null;
  source_url: string | null;
}

interface RelationRow extends RowDataPacket {
  period_id: string;
  style_id: string;
}

interface LensRow extends RowDataPacket {
  lens_id: string;
  display_order: number;
  title: string;
  description: string;
  icon_key: AnthropologyLens["icon"];
}

export async function getHistory(): Promise<HistoryData> {
  try {
    const pool = getDbPool();
    const [[periodRows], [relationRows], [lensRows]] = await Promise.all([
      pool.query<PeriodRow[]>("SELECT period_id, display_order, date_label, title, summary, source_label, source_url FROM history_periods ORDER BY display_order"),
      pool.query<RelationRow[]>("SELECT period_id, style_id FROM history_period_styles ORDER BY period_id, display_order"),
      pool.query<LensRow[]>("SELECT lens_id, display_order, title, description, icon_key FROM anthropology_lenses ORDER BY display_order"),
    ]);
    if (!periodRows.length || !lensRows.length) throw new Error("History tables are empty");
    const stylesByPeriod = new Map<string, string[]>();
    for (const relation of relationRows) stylesByPeriod.set(relation.period_id, [...(stylesByPeriod.get(relation.period_id) || []), relation.style_id]);
    return {
      source: "sql",
      periods: periodRows.map((row) => ({
        id: row.period_id,
        displayOrder: row.display_order,
        dateLabel: row.date_label,
        title: row.title,
        summary: row.summary,
        sourceLabel: row.source_label,
        sourceUrl: row.source_url,
        styleIds: stylesByPeriod.get(row.period_id) || [],
      })),
      anthropologyLenses: lensRows.map((row) => ({ id: row.lens_id, displayOrder: row.display_order, title: row.title, description: row.description, icon: row.icon_key })),
    };
  } catch (error) {
    console.warn("[InkTelligence] SQL history unavailable; using synchronized JSON backup.", error instanceof Error ? error.message : error);
    return {
      source: "json",
      periods: sourceDatabase.history.periods as HistoryPeriod[],
      anthropologyLenses: sourceDatabase.history.anthropologyLenses as AnthropologyLens[],
    };
  }
}
