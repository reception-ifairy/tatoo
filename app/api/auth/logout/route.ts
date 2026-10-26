import { NextResponse } from "next/server";
import { OWNER_COOKIE, ownerCookieOptions } from "@/lib/auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set(OWNER_COOKIE, "", { ...ownerCookieOptions, maxAge: 0 });
  return response;
}
