import { apiError, apiOk, requireApiAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { publicBaseUrl } from "@/lib/routes";
import { buildDynamicConfig, buildSubconverterRequest } from "@/lib/upstream";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth(request);
  if (auth) return auth;
  const { id } = await context.params;
  const profile = await prisma.profile.findFirst({ where: { id, deletedAt: null } });
  if (!profile) return apiError("NOT_FOUND", "Profile not found", 404);

  const baseUrl = publicBaseUrl(request);
  const config = await buildDynamicConfig(profile, baseUrl);
  let subscriptionUrl = `${baseUrl}/sub/${profile.token}?target=${profile.defaultTarget}`;
  let subconverterUrl = "";
  let sourceItems: string[] = [];
  try {
    const requestUrl = new URL(request.url);
    requestUrl.searchParams.set("target", profile.defaultTarget);
    const built = await buildSubconverterRequest(profile, requestUrl, baseUrl);
    sourceItems = built.sourceItems;
    subconverterUrl = built.url;
  } catch {
    subscriptionUrl += "&warning=no-enabled-sources";
  }

  const rulePreview = config
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("ruleset="))
    .slice(0, 100);

  return apiOk({ data: { config, subscriptionUrl, subconverterUrl, sourceItems, rulePreview } });
}
