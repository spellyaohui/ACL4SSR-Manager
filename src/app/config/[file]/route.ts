import { apiError } from "@/lib/api";
import { publicBaseUrl } from "@/lib/routes";
import { buildDynamicConfig, getProfileByToken } from "@/lib/upstream";

export async function GET(request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  const token = file.replace(/\.ini$/, "");
  try {
    const profile = await getProfileByToken(token);
    const content = await buildDynamicConfig(profile, publicBaseUrl(request));
    return new Response(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError("NOT_FOUND", error instanceof Error ? error.message : "Config not found", 404);
  }
}
