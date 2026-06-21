import crypto from "node:crypto";

import { env } from "./env";

export function publicBaseUrl(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (host) {
    const requestProtocol = new URL(request.url).protocol.replace(":", "");
    const protocol = forwardedProto || requestProtocol || "http";
    return `${protocol}://${host}`.replace(/\/$/, "");
  }
  return (env.APP_BASE_URL || new URL(request.url).origin).replace(/\/$/, "");
}

export function createPublicToken(): string {
  return crypto.randomBytes(18).toString("base64url");
}
