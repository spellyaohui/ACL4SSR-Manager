import { NextResponse } from "next/server";

import { apiOk, parseJson, requireApiAuth } from "@/lib/api";
import { DEFAULT_ACL4SSR_CONFIG_URL } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { createPublicToken } from "@/lib/routes";
import { ProfileCreateSchema } from "@/lib/schemas";

export async function GET(request: Request) {
  const auth = await requireApiAuth(request);
  if (auth) return auth;

  const profiles = await prisma.profile.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { sources: true, rules: true } },
    },
  });
  return apiOk({ data: profiles });
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(request);
  if (auth) return auth;
  const body = await parseJson(request, ProfileCreateSchema);
  if (body instanceof NextResponse) return body;

  const profile = await prisma.profile.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      defaultTarget: body.defaultTarget,
      upstreamConfigUrl: body.upstreamConfigUrl ?? process.env.ACL4SSR_BASE_CONFIG_URL ?? DEFAULT_ACL4SSR_CONFIG_URL,
      nodeExcludeRegex: body.nodeExcludeRegex?.trim() || null,
      token: createPublicToken(),
    },
  });
  return apiOk({ data: profile }, { status: 201 });
}
