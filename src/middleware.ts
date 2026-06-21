import { NextResponse } from "next/server";

import { securityHeaders } from "./lib/security";

function shouldDisableCache(pathname: string): boolean {
  return !pathname.startsWith("/_next/static/") && !pathname.startsWith("/_next/image/");
}

export function middleware(request: Request) {
  const response = NextResponse.next();
  const headers = securityHeaders();
  Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
  if (shouldDisableCache(new URL(request.url).pathname)) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }
  return response;
}
