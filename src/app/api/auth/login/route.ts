import { NextResponse } from "next/server";

import { apiError, parseJson } from "@/lib/api";
import { createSessionToken, setSessionCookie, verifyAdminPassword } from "@/lib/auth";
import { LoginSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const body = await parseJson(request, LoginSchema);
  if (body instanceof NextResponse) return body;

  if (!verifyAdminPassword(body.password)) {
    return apiError("UNAUTHORIZED", "Invalid password", 401);
  }

  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, createSessionToken());
  return response;
}
