import { apiError } from "@/lib/api";
import { fetchProfileNodeSource, getProfileByToken } from "@/lib/upstream";

export async function GET(_request: Request, context: { params: Promise<{ profileToken: string }> }) {
  const { profileToken } = await context.params;
  try {
    const profile = await getProfileByToken(profileToken);
    const content = await fetchProfileNodeSource(profile);
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
