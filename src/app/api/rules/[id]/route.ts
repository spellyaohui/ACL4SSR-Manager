import { NextResponse } from "next/server";

import { apiOk, parseJson, requireApiAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { toPrismaMode, toPrismaRuleEnum } from "@/lib/prisma-mappers";
import { RuleUpdateSchema } from "@/lib/schemas";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth(request);
  if (auth) return auth;
  const body = await parseJson(request, RuleUpdateSchema);
  if (body instanceof NextResponse) return body;
  const { id } = await context.params;

  const rule = await prisma.rule.update({
    where: { id },
    data: {
      category: body.category,
      type: body.type ? toPrismaRuleEnum(body.type) : undefined,
      value: body.value,
      policyGroup: body.policyGroup,
      mode: body.mode ? toPrismaMode(body.mode) : undefined,
      enabled: body.enabled,
      priority: body.priority,
      note: body.note,
    },
  });
  return apiOk({ data: rule });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth(request);
  if (auth) return auth;
  const { id } = await context.params;
  await prisma.rule.update({
    where: { id },
    data: { deletedAt: new Date(), enabled: false },
  });
  return apiOk({ ok: true });
}
