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

  const profile = await prisma.profile.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description,
      defaultTarget: body.defaultTarget,
      upstreamConfigUrl: body.upstreamConfigUrl,
      nodeExcludeRegex: body.nodeExcludeRegex === undefined ? undefined : body.nodeExcludeRegex?.trim() || null,
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
