import { NextResponse } from "next/server";

import { apiError, apiOk, parseJson, requireApiAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { toPrismaMode, toPrismaRuleEnum } from "@/lib/prisma-mappers";
import { RuleCreateSchema } from "@/lib/schemas";

export async function GET(request: Request) {
  const auth = await requireApiAuth(request);
  if (auth) return auth;
  const url = new URL(request.url);
  const profileId = url.searchParams.get("profileId");
  if (!profileId) return apiError("VALIDATION_ERROR", "profileId is required", 422);
  const search = url.searchParams.get("search")?.trim();
  const category = url.searchParams.get("category")?.trim();
  const mode = url.searchParams.get("mode")?.trim();

  const rules = await prisma.rule.findMany({
    where: {
      profileId,
      deletedAt: null,
      ...(category ? { category } : {}),
      ...(mode ? { mode: toPrismaMode(mode) } : {}),
      ...(search
        ? {
            OR: [
              { value: { contains: search } },
              { policyGroup: { contains: search } },
              { category: { contains: search } },
              { note: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
  return apiOk({ data: rules });
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(request);
  if (auth) return auth;
  const body = await parseJson(request, RuleCreateSchema);
  if (body instanceof NextResponse) return body;

  const rule = await prisma.rule.create({
    data: {
      profileId: body.profileId,
      category: body.category,
      type: toPrismaRuleEnum(body.type),
      value: body.value,
      policyGroup: body.policyGroup,
      mode: toPrismaMode(body.mode),
      enabled: body.enabled,
      priority: body.priority,
      note: body.note ?? null,
    },
  });
  return apiOk({ data: rule }, { status: 201 });
}
