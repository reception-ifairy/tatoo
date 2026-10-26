import { NextResponse } from "next/server";
import { z } from "zod";
import { createOwnerToken, OWNER_COOKIE, ownerCookieOptions, validateOwnerCredentials } from "@/lib/auth";

export const runtime = "nodejs";

const schema = z.object({
  login: z.string().trim().min(1).max(190),
  password: z.string().min(1).max(500),
});

export async function POST(request: Request) {
  const payload = schema.safeParse(await request.json().catch(() => null));
  if (!payload.success) return NextResponse.json({ error: "Enter your owner login and password." }, { status: 400 });

  const session = await validateOwnerCredentials(payload.data.login, payload.data.password);
  if (!session) return NextResponse.json({ error: "The owner credentials are not valid." }, { status: 401 });

  const response = NextResponse.json({ ok: true, role: session.role });
  response.cookies.set(OWNER_COOKIE, createOwnerToken(session), ownerCookieOptions);
  return response;
}
