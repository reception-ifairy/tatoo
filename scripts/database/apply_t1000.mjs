#!/usr/bin/env node

import fs from "node:fs";
import mysql from "mysql2/promise";

const rootUrl = new URL("../../", import.meta.url);
const envPath = new URL(".env.local", rootUrl);
const sqlPath = new URL("./t1000.sql", import.meta.url);

const fileEnv = fs.existsSync(envPath) ? parseEnv(fs.readFileSync(envPath, "utf8")) : {};
const env = { ...fileEnv, ...process.env };
const connection = await mysql.createConnection({
  host: env.DB_SOCKET ? undefined : env.DB_HOST || "127.0.0.1",
  port: Number(env.DB_PORT || 3306),
  user: env.DB_USER || "root",
  password: env.DB_PASSWORD || "",
  socketPath: env.DB_SOCKET || undefined,
  multipleStatements: true,
  charset: "utf8mb4",
});

try {
  await connection.query(fs.readFileSync(sqlPath, "utf8"));
  const [[summary]] = await connection.query(`SELECT
    (SELECT COUNT(*) FROM t1000.styles) AS styles,
    (SELECT COUNT(*) FROM t1000.techniques) AS techniques,
    (SELECT COUNT(*) FROM t1000.history_periods) AS history_periods,
    (SELECT COUNT(*) FROM t1000.app_users WHERE role_id = 'super_admin' AND status = 'active') AS super_admins,
    (SELECT COUNT(*) FROM t1000.membership_packages WHERE status = 'draft') AS draft_packages`);
  console.log(JSON.stringify({ applied: true, ...summary }, null, 2));
} finally {
  await connection.end();
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
