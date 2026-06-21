import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyRequestSession } from "./auth";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

export function apiError(
  code: ApiErrorCode,
  message: string,
  status = 400,
  details?: unknown,
): NextResponse {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export function apiOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export async function parseJson<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<z.infer<T> | NextResponse> {
  try {
    const json = await request.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid request body", 422, parsed.error.flatten());
    }
    return parsed.data;
  } catch {
    return apiError("VALIDATION_ERROR", "Request body must be valid JSON", 400);
  }
}

export async function requireApiAuth(request: Request): Promise<NextResponse | null> {
  const session = await verifyRequestSession(request);
  if (!session) {
    return apiError("UNAUTHORIZED", "Authentication required", 401);
  }
  return null;
}
