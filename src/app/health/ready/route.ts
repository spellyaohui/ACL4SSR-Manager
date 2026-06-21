import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { fetchTextWithTimeout, getCachedText } from "@/lib/upstream";

export async function GET() {
  const checks: Record<string, boolean> = {};
  try {
    await prisma.profile.count();
    checks.database = true;
  } catch {
    checks.database = false;
  }

  try {
    await fetchTextWithTimeout(new URL("/version", env.SUBCONVERTER_URL).toString(), 3000);
    checks.subconverter = true;
  } catch {
    checks.subconverter = false;
  }

  try {
    await getCachedText(env.ACL4SSR_BASE_CONFIG_URL);
    checks.acl4ssr = true;
  } catch {
    checks.acl4ssr = false;
  }

  const ok = Object.values(checks).every(Boolean);
  return Response.json({ ok, checks }, { status: ok ? 200 : 503 });
}
