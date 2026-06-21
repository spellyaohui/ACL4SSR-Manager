import { apiError } from "@/lib/api";
import { publicBaseUrl } from "@/lib/routes";
import { getProfileSubscriptionUserInfoHeader } from "@/lib/source-metadata";
import { buildSubconverterRequest, fetchTextWithTimeout, getProfileByToken } from "@/lib/upstream";

export async function GET(request: Request, context: { params: Promise<{ profileToken: string }> }) {
  const { profileToken } = await context.params;
  try {
    const profile = await getProfileByToken(profileToken);
    const built = await buildSubconverterRequest(profile, new URL(request.url), publicBaseUrl(request));
    const subscriptionUserInfo = await getProfileSubscriptionUserInfoHeader(profile.id);
    const content = await fetchTextWithTimeout(built.url, 30000);
    const headers = new Headers({
      "Content-Type": "text/yaml; charset=utf-8",
      "Cache-Control": "no-store",
    });
    if (subscriptionUserInfo) {
      headers.set("Subscription-Userinfo", subscriptionUserInfo);
    }
    return new Response(content, {
      headers,
    });
  } catch (error) {
    return apiError(
      "UPSTREAM_ERROR",
      error instanceof Error ? error.message : "Subscription conversion failed",
      502,
    );
  }
}
