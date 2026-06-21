import { NextResponse } from "next/server";

import { apiOk, parseJson, requireApiAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { SourceCreateSchema } from "@/lib/schemas";
import { refreshSourceMetadata } from "@/lib/source-metadata";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth(request);
  if (auth) return auth;
  const { id } = await context.params;
  const sources = await prisma.profileSource.findMany({
    where: { profileId: id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  await refreshSourceMetadata(sources, new URL(request.url).searchParams.get("refresh") === "1");
  const refreshedSources = await prisma.profileSource.findMany({
    where: { profileId: id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return apiOk({ data: refreshedSources });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth(request);
  if (auth) return auth;
  const body = await parseJson(request, SourceCreateSchema);
  if (body instanceof NextResponse) return body;
  const { id } = await context.params;

  const source = await prisma.profileSource.create({
    data: {
      profileId: id,
      name: body.name,
      type: body.type,
      value: body.value,
      tag: body.tag ?? null,
      enabled: body.enabled,
      sortOrder: body.sortOrder,
    },
  });
  return apiOk({ data: source }, { status: 201 });
}
