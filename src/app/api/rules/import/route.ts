import { NextResponse } from "next/server";

import { apiOk, parseJson, requireApiAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { toPrismaMode, toPrismaRuleEnum } from "@/lib/prisma-mappers";
import { importRulesFromText } from "@/lib/rules/engine";
import { RuleImportSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const auth = await requireApiAuth(request);
  if (auth) return auth;
  const body = await parseJson(request, RuleImportSchema);
  if (body instanceof NextResponse) return body;

  const parsed = importRulesFromText(body.text, { mode: body.mode });
  const created = await prisma.$transaction(
    parsed.rules.map((rule, index) =>
      prisma.rule.create({
        data: {
          profileId: body.profileId,
          category: rule.category,
          type: toPrismaRuleEnum(rule.type),
          value: rule.value,
          policyGroup: rule.policyGroup,
          mode: toPrismaMode(rule.mode),
          enabled: true,
          priority: index,
          note: rule.note ?? null,
        },
      }),
    ),
  );

  return apiOk({ data: created, errors: parsed.errors }, { status: 201 });
}
