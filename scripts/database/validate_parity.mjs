#!/usr/bin/env node

import fs from "node:fs";
import mysql from "mysql2/promise";

const rootUrl = new URL("../../", import.meta.url);
const backup = JSON.parse(fs.readFileSync(new URL("./tattoo_database.backup.json", import.meta.url), "utf8"));
const env = { ...parseEnv(fs.readFileSync(new URL(".env.local", rootUrl), "utf8")), ...process.env };
const connection = await mysql.createConnection({
  host: env.DB_SOCKET ? undefined : env.DB_HOST || "127.0.0.1",
  port: Number(env.DB_PORT || 3306),
  user: env.DB_USER || "root",
  password: env.DB_PASSWORD || "",
  database: env.DB_NAME || "t1000",
  socketPath: env.DB_SOCKET || undefined,
  charset: "utf8mb4",
});

try {
  const [styles] = await connection.query("SELECT style_id AS id FROM styles ORDER BY style_id");
  const [techniques] = await connection.query("SELECT technique_id AS id FROM techniques ORDER BY technique_id");
  const [periods] = await connection.query("SELECT period_id AS id, title, summary FROM history_periods ORDER BY display_order");
  const [lenses] = await connection.query("SELECT lens_id AS id, title, description FROM anthropology_lenses ORDER BY display_order");
  const [articles] = await connection.query("SELECT article_id AS id, title, dek AS summary, slug FROM library_articles ORDER BY display_order");
  const [articleEntries] = await connection.query("SELECT article_id, catalog_id FROM library_article_entries");

  assertIds("styles", styles, backup.styles);
  assertIds("techniques", techniques, backup.techniques);
  assertContent("history periods", periods, backup.history.periods);
  assertContent("anthropology lenses", lenses, backup.history.anthropologyLenses);
  assertContent("library articles", articles, backup.articles.map((item) => ({ id: item.id, title: item.title, summary: item.dek })));
  assertArticleEntries(articleEntries, backup.articles);
  console.log(JSON.stringify({ parity: true, styles: styles.length, techniques: techniques.length, historyPeriods: periods.length, anthropologyLenses: lenses.length, libraryArticles: articles.length, libraryArticleEntries: articleEntries.length }, null, 2));
} finally {
  await connection.end();
}

function assertIds(label, sqlRows, jsonRows) {
  const sql = sqlRows.map((item) => item.id).sort();
  const json = jsonRows.map((item) => item.id).sort();
  if (JSON.stringify(sql) !== JSON.stringify(json)) throw new Error(`${label} SQL/JSON ids are out of sync`);
}

function assertContent(label, sqlRows, jsonRows) {
  assertIds(label, sqlRows, jsonRows);
  const jsonById = new Map(jsonRows.map((item) => [item.id, item]));
  for (const row of sqlRows) {
    const mirror = jsonById.get(row.id);
    const sqlText = `${row.title}\n${row.summary || row.description}`;
    const jsonText = `${mirror.title}\n${mirror.summary || mirror.description}`;
    if (sqlText !== jsonText) throw new Error(`${label} content differs for ${row.id}`);
  }
}

function assertArticleEntries(sqlRows, jsonArticles) {
  const sql = sqlRows.map((row) => `${row.article_id}:${row.catalog_id}`).sort();
  const json = jsonArticles.flatMap((article) => article.catalogIds.map((id) => `${article.id}:${id}`)).sort();
  if (JSON.stringify(sql) !== JSON.stringify(json)) throw new Error("library article catalog links are out of sync");
}

function parseEnv(source) {
  return Object.fromEntries(source.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return [];
    const separator = trimmed.indexOf("=");
    if (separator < 1) return [];
    return [[trimmed.slice(0, separator), trimmed.slice(separator + 1).replace(/^['"]|['"]$/g, "")]];
  }));
}
