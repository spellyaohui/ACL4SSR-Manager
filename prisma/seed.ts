import crypto from "node:crypto";

import { PrismaClient } from "@prisma/client";

import { DEFAULT_ACL4SSR_CONFIG_URL } from "../src/lib/constants";
import { toPrismaMode, toPrismaRuleEnum } from "../src/lib/prisma-mappers";
import { importRulesFromText } from "../src/lib/rules/engine";

const prisma = new PrismaClient();

const DEFAULT_RULE_BLOCK = String.raw`##Lucky
- PROCESS-NAME,lucky,🎯 全球直连
#PT
- DOMAIN-SUFFIX,m-team.cc,🎯 全球直连
- DOMAIN-SUFFIX,hdhome.org,🎯 全球直连
- DOMAIN-SUFFIX,dmhy.org,🚀 节点选择
- DOMAIN-SUFFIX,ptskit.org,🎯 全球直连
- DOMAIN-SUFFIX,nicept.net,🎯 全球直连
- DOMAIN-SUFFIX,rousi.pro,🎯 全球直连
- DOMAIN-SUFFIX,joyhd.net,🎯 全球直连
- DOMAIN-SUFFIX,iptorrents.com,🎯 全球直连
- DOMAIN-SUFFIX,totheglory.im,🎯 全球直连
- DOMAIN-SUFFIX,ptchdbits.co,🎯 全球直连
- DOMAIN-SUFFIX,rainbowisland.co,🎯 全球直连
- DOMAIN-SUFFIX,chdbits.xyz,🎯 全球直连
- DOMAIN-SUFFIX,open.cd,🎯 全球直连
- DOMAIN-SUFFIX,hdfans.org,🎯 全球直连
#Other
- DOMAIN-KEYWORD,notepad,🚀 节点选择
- DOMAIN-KEYWORD,pythonhosted.org,🚀 节点选择
- DOMAIN-KEYWORD,dcm4che,🚀 节点选择
- DOMAIN-KEYWORD,javdb,🇸🇬 狮城节点
- DOMAIN-KEYWORD,javten,🇸🇬 狮城节点
- DOMAIN-KEYWORD,sox,🚀 节点选择
- DOMAIN-KEYWORD,unraid,🚀 节点选择
- DOMAIN-SUFFIX,githubusercontent.com,🚀 手动切换
- DOMAIN-KEYWORD,berrypass,🚀 手动切换
- DOMAIN-SUFFIX,leybc.com,🎯 全球直连
- DOMAIN-KEYWORD,tlenv,🎯 全球直连
- DOMAIN-SUFFIX,hibitsoft.ir,🚀 节点选择
- DOMAIN,mb3admin.com,🎯 全球直连
#WJTJYY.TOP
- DOMAIN-SUFFIX,wjtjyy.top,🎯 全球直连
#AI
- DOMAIN,ai.google.dev,💬 Ai平台
- DOMAIN,aistudio.google.com,💬 Ai平台
- DOMAIN,accounts.google.com,💬 Ai平台
- DOMAIN-SUFFIX,chatgpt.com,💬 Ai平台
- DOMAIN-KEYWORD,ipfoxy,💬 Ai平台
- DOMAIN-SUFFIX,ip2location.com,💬 Ai平台
- DOMAIN-SUFFIX,codeium.comm,🎯 全球直连
- DOMAIN-SUFFIX,githubcopilot.com,💬 Ai平台
- DOMAIN-KEYWORD,amazonaws,💬 Ai平台
- DOMAIN-KEYWORD,kiro,💬 Ai平台
- DOMAIN-KEYWORD,windsurf,💬 Ai平台
- DOMAIN-SUFFIX,yangchl-pro.shop,🎯 全球直连
- DOMAIN,api.kklt.lol,🎯 全球直连
#MCP
- DOMAIN,api.search.brave.com,🇺🇲 美国节点
- DOMAIN,api.firecrawl.dev,🇺🇲 美国节点
#AV刮削
- DOMAIN-SUFFIX,duga.jp,🇯🇵 日本节点
- DOMAIN-SUFFIX,gcolle.net,🇯🇵 日本节点
- DOMAIN-SUFFIX,dmm.co.jp,🇯🇵 日本节点
- DOMAIN-SUFFIX,dmm.com,🇯🇵 日本节点
- DOMAIN-SUFFIX,getchu.com,🇯🇵 日本节点
- DOMAIN-SUFFIX,dlsite.com,🇯🇵 日本节点
- DOMAIN-SUFFIX,fantia.jp,🇯🇵 日本节点
- DOMAIN-SUFFIX,fc2.com,🇯🇵 日本节点
- DOMAIN-SUFFIX,gyutto.com,🇯🇵 日本节点
- DOMAIN-SUFFIX,pcolle.com,🇯🇵 日本节点
- DOMAIN-SUFFIX,xcity.jp,🇯🇵 日本节点
- DOMAIN-SUFFIX,mgstage.com,🇯🇵 日本节点`;

async function ensureSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Profile" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "token" TEXT NOT NULL,
      "defaultTarget" TEXT NOT NULL DEFAULT 'clash',
      "upstreamConfigUrl" TEXT NOT NULL,
      "nodeExcludeRegex" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      "deletedAt" DATETIME
    )
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Profile" ADD COLUMN "nodeExcludeRegex" TEXT`).catch(() => undefined);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProfileSource" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "profileId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "tag" TEXT,
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "lastStatus" TEXT,
      "lastCheckedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "ProfileSource_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Rule" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "profileId" TEXT NOT NULL,
      "category" TEXT NOT NULL DEFAULT 'General',
      "type" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "policyGroup" TEXT NOT NULL,
      "mode" TEXT NOT NULL DEFAULT 'PIN',
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      "priority" INTEGER NOT NULL DEFAULT 0,
      "note" TEXT,
      "deletedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Rule_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UpstreamCache" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "url" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "status" INTEGER NOT NULL DEFAULT 200,
      "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AuditLog" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "action" TEXT NOT NULL,
      "target" TEXT NOT NULL,
      "detail" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Profile_token_key" ON "Profile"("token")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Rule_profileId_enabled_priority_idx" ON "Rule"("profileId", "enabled", "priority")`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "UpstreamCache_url_key" ON "UpstreamCache"("url")`);
}

async function main() {
  await ensureSchema();

  let profile = await prisma.profile.findFirst({
    where: { name: "主力配置", deletedAt: null },
  });

  if (!profile) {
    profile = await prisma.profile.create({
      data: {
        name: "主力配置",
        description: "默认 Profile，已预置手工维护规则，可直接添加机场订阅后生成。",
        token: process.env.DEFAULT_PROFILE_TOKEN?.trim() || crypto.randomBytes(18).toString("base64url"),
        defaultTarget: "clash",
        upstreamConfigUrl: process.env.ACL4SSR_BASE_CONFIG_URL ?? DEFAULT_ACL4SSR_CONFIG_URL,
      },
    });
  }

  if (!profile.token) {
    profile = await prisma.profile.update({
      where: { id: profile.id },
      data: { token: crypto.randomBytes(18).toString("base64url") },
    });
  }

  const sourceCount = await prisma.profileSource.count({
    where: { profileId: profile.id },
  });
  if (sourceCount === 0) {
    await prisma.profileSource.create({
      data: {
        profileId: profile.id,
        name: "示例机场订阅",
        type: "SUBSCRIPTION",
        value: "https://example.com/subscription-url",
        tag: "替换后启用",
        enabled: false,
        sortOrder: 0,
        lastStatus: "等待替换为真实订阅 URL",
      },
    });
  }

  const ruleCount = await prisma.rule.count({
    where: { profileId: profile.id, deletedAt: null },
  });
  if (ruleCount === 0) {
    const parsed = importRulesFromText(DEFAULT_RULE_BLOCK, { mode: "PIN" });
    await prisma.$transaction(
      parsed.rules.map((rule, index) =>
        prisma.rule.create({
          data: {
            profileId: profile.id,
            category: rule.category,
            type: toPrismaRuleEnum(rule.type),
            value: rule.value,
            policyGroup: rule.policyGroup,
            mode: toPrismaMode(rule.mode),
            enabled: true,
            priority: index,
            note: "seed: user maintained rule",
          },
        }),
      ),
    );
  }

  await prisma.auditLog.create({
    data: {
      action: "seed",
      target: profile.id,
      detail: "Ensured default profile, sample source, and user-maintained rules.",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
