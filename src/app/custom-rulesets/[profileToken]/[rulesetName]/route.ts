import { apiError } from "@/lib/api";
import { getCustomRuleset, getProfileByToken } from "@/lib/upstream";

export async function GET(_request: Request, context: { params: Promise<{ profileToken: string; rulesetName: string }> }) {
  const { profileToken, rulesetName } = await context.params;
  try {
    const profile = await getProfileByToken(profileToken);
    const content = await getCustomRuleset(profile, rulesetName);
    return new Response(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError("NOT_FOUND", error instanceof Error ? error.message : "Custom ruleset not found", 404);
  }
}
