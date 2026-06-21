import { NextResponse } from "next/server";

import { apiError, apiOk, parseJson, requireApiAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ProfileUpdateSchema } from "@/lib/schemas";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth(request);
  if (auth) return auth;
  const body = await parseJson(request, ProfileUpdateSchema);
  if (body instanceof NextResponse) return body;
  const { id } = await context.params;
  if (body.subscriptionInfoSourceId) {
    const source = await prisma.profileSource.findFirst({
      where: {
        id: body.subscriptionInfoSourceId,
        profileId: id,
        type: "SUBSCRIPTION",
      },
    });
    if (!source) return apiError("VALIDATION_ERROR", "流量/到期来源必须是当前 Profile 的机场订阅 URL", 422);
  }

  const profile = await prisma.profile.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description,
      defaultTarget: body.defaultTarget,
      upstreamConfigUrl: body.upstreamConfigUrl,
      nodeExcludeRegex: body.nodeExcludeRegex === undefined ? undefined : body.nodeExcludeRegex?.trim() || null,
      subscriptionInfoSourceId: body.subscriptionInfoSourceId === undefined ? undefined : body.subscriptionInfoSourceId || null,
    },
  });
  return apiOk({ data: profile });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth(request);
  if (auth) return auth;
  const { id } = await context.params;
  const profile = await prisma.profile.findUnique({ where: { id } });
  if (!profile) return apiError("NOT_FOUND", "Profile not found", 404);

  await prisma.profile.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return apiOk({ ok: true });
}
