import { apiError } from "@/lib/api";
import { publicBaseUrl } from "@/lib/routes";
import { buildSubconverterRequest, fetchTextWithTimeout, getProfileByToken } from "@/lib/upstream";

export async function GET(request: Request, context: { params: Promise<{ profileToken: string }> }) {
  const { profileToken } = await context.params;
  try {
    const profile = await getProfileByToken(profileToken);
    const built = await buildSubconverterRequest(profile, new URL(request.url), publicBaseUrl(request));
    const content = await fetchTextWithTimeout(built.url, 30000);
    return new Response(content, {
      headers: {
        "Content-Type": "text/yaml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(
      "UPSTREAM_ERROR",
      error instanceof Error ? error.message : "Subscription conversion failed",
      502,
    );
  }
}
