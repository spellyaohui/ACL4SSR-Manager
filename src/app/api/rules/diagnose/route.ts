import { NextResponse } from "next/server";

import { apiError, apiOk, parseJson, requireApiAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { diagnoseRule, importRulesFromText } from "@/lib/rules/engine";
import type { ManagedRule } from "@/lib/rules/types";
import { RuleDiagnoseSchema } from "@/lib/schemas";
import { getExpandedUpstreamRules, getRulesForProfile } from "@/lib/upstream";

export async function POST(request: Request) {
  const auth = await requireApiAuth(request);
  if (auth) return auth;
  const body = await parseJson(request, RuleDiagnoseSchema);
  if (body instanceof NextResponse) return body;

  const profile = await prisma.profile.findFirst({
    where: { id: body.profileId, deletedAt: null },
  });
  if (!profile) return apiError("NOT_FOUND", "Profile not found", 404);

  const rules: ManagedRule[] = [];
  if (body.rule) {
    rules.push({
      ...body.rule,
      enabled: body.rule.enabled ?? true,
      mode: body.rule.mode ?? "PIN",
      priority: body.rule.priority ?? 0,
      note: body.rule.note ?? null,
    });
  }
  if (body.text) {
    rules.push(...importRulesFromText(body.text).rules);
  }
  if (!rules.length) {
    rules.push(...await getRulesForProfile(profile.id));
  }

  const upstream = await getExpandedUpstreamRules(profile);
  return apiOk({ data: rules.map((rule) => diagnoseRule(rule, upstream)) });
}
