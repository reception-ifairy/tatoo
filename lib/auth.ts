import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";

export const OWNER_COOKIE = "inktelligence_owner";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

export interface OwnerSession {
  userId: string;
  login: string;
  displayName: string;
  role: "super_admin";
  expiresAt: number;
}

interface OwnerRow extends RowDataPacket {
  user_id: string;
  login: string;
  display_name: string;
  role_id: string;
}

export async function validateOwnerCredentials(login: string, password: string): Promise<OwnerSession | null> {
  const configuredLogin = process.env.OWNER_LOGIN || "owner";
  const configuredPassword = process.env.OWNER_PASSWORD;
  if (!configuredPassword || !safeEqual(login, configuredLogin) || !safeEqual(password, configuredPassword)) return null;

  const [rows] = await getDbPool().query<OwnerRow[]>(`SELECT u.user_id, u.login, u.display_name, u.role_id
    FROM app_users u
    JOIN app_roles r ON r.role_id = u.role_id
    WHERE u.login = ? AND u.status = 'active' AND u.role_id = 'super_admin' AND r.is_active = TRUE
    LIMIT 1`, [configuredLogin]);
  const owner = rows[0];
  if (!owner) return null;

  return {
    userId: owner.user_id,
    login: owner.login,
    displayName: owner.display_name,
    role: "super_admin",
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
}

export function createOwnerToken(session: OwnerSession): string {
  const payload = toBase64Url(JSON.stringify(session));
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifyOwnerToken(token?: string): OwnerSession | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;
  try {
    const session = JSON.parse(fromBase64Url(payload)) as OwnerSession;
    if (session.role !== "super_admin" || session.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getOwnerSession(): Promise<OwnerSession | null> {
  const cookieStore = await cookies();
  return verifyOwnerToken(cookieStore.get(OWNER_COOKIE)?.value);
}

export async function requireOwner(): Promise<OwnerSession> {
  const session = await getOwnerSession();
  if (!session) redirect("/login");
  return session;
}

export const ownerCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

function sign(payload: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}
