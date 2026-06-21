import { NextResponse } from "next/server";

import { securityHeaders } from "./lib/security";

export function middleware() {
  const response = NextResponse.next();
  const headers = securityHeaders();
  Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}
