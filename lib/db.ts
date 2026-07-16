import mysql, { type Pool } from "mysql2/promise";
import { existsSync } from "node:fs";

const globalForDb = globalThis as typeof globalThis & { inkDbPool?: Pool };

export function getDbPool(): Pool {
  if (globalForDb.inkDbPool) return globalForDb.inkDbPool;

  const localSocket = "/run/mysqld/mysqld.sock";
  const socketPath = process.env.DB_SOCKET || (!process.env.DB_HOST && existsSync(localSocket) ? localSocket : undefined);

  const pool = process.env.DATABASE_URL
    ? mysql.createPool(process.env.DATABASE_URL)
    : mysql.createPool({
        host: socketPath ? undefined : process.env.DB_HOST || "127.0.0.1",
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "t1000",
        socketPath,
        charset: "utf8mb4",
        waitForConnections: true,
        connectionLimit: 8,
        maxIdle: 4,
        idleTimeout: 60_000,
        queueLimit: 0,
        enableKeepAlive: true,
      });

  if (process.env.NODE_ENV !== "production") globalForDb.inkDbPool = pool;
  return pool;
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}
