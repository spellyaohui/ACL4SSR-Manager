import { NextResponse } from "next/server";

import { apiOk, parseJson, requireApiAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { SourceUpdateSchema } from "@/lib/schemas";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sourceId: string }> },
) {
  const auth = await requireApiAuth(request);
  if (auth) return auth;
  const body = await parseJson(request, SourceUpdateSchema);
  if (body instanceof NextResponse) return body;
  const { sourceId } = await context.params;

  const source = await prisma.profileSource.update({
    where: { id: sourceId },
    data: body,
  });
  return apiOk({ data: source });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ sourceId: string }> },
) {
  const auth = await requireApiAuth(request);
  if (auth) return auth;
  const { sourceId } = await context.params;
  await prisma.profile.updateMany({
    where: { subscriptionInfoSourceId: sourceId },
    data: { subscriptionInfoSourceId: null },
  });
  await prisma.profileSource.delete({ where: { id: sourceId } });
  return apiOk({ ok: true });
}
