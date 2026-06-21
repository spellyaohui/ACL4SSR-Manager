import { apiError } from "@/lib/api";
import { buildNodeConverterRequest, fetchTextWithTimeout, getProfileByToken } from "@/lib/upstream";

export async function GET(_request: Request, context: { params: Promise<{ profileToken: string }> }) {
  const { profileToken } = await context.params;
  try {
    const profile = await getProfileByToken(profileToken);
    const built = await buildNodeConverterRequest(profile);
    const content = await fetchTextWithTimeout(built.url, 30000);
    return new Response(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(
      "UPSTREAM_ERROR",
      error instanceof Error ? error.message : "Node source conversion failed",
      502,
    );
  }
}
