import type { Profile } from "@prisma/client";
import { Buffer } from "node:buffer";

import { env } from "./env";
import { prisma } from "./db";
import { ruleRecordToManaged } from "./prisma-mappers";
import {
  buildSourcePayload,
  expandRulesetContent,
  filterRulesetContent,
  formatInlineRuleset,
  parseRulesetRefs,
  toClashType,
} from "./rules/engine";
import type { ExpandedUpstreamRule, ManagedRule, UpstreamRulesetRef } from "./rules/types";

const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

export async function fetchTextWithTimeout(url: string, timeoutMs = 15000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "acl4ssr-rule-manager/0.1" },
    });
    if (!response.ok) {
      throw new Error(`Fetch failed ${response.status} for ${url}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function getCachedText(url: string, ttlMs = CACHE_TTL_MS): Promise<string> {
  const cached = await prisma.upstreamCache.findUnique({ where: { url } });
  const now = Date.now();
  if (cached && now - cached.fetchedAt.getTime() < ttlMs) {
    return cached.content;
  }

  try {
    const content = await fetchTextWithTimeout(url);
    await prisma.upstreamCache.upsert({
      where: { url },
      create: { url, content, status: 200 },
      update: { content, status: 200, fetchedAt: new Date() },
    });
    return content;
  } catch (error) {
    if (cached) return cached.content;
    throw error;
  }
}

export async function getProfileByToken(token: string): Promise<Profile> {
  const profile = await prisma.profile.findFirst({
    where: { token, deletedAt: null },
  });
  if (!profile) {
    throw new Error("Profile not found");
  }
  return profile;
}

export async function getUpstreamConfig(profile: Pick<Profile, "upstreamConfigUrl">): Promise<string> {
  return getCachedText(profile.upstreamConfigUrl || env.ACL4SSR_BASE_CONFIG_URL);
}

export function makeRulesetSlug(ref: UpstreamRulesetRef): string {
  const name = ref.source.split("/").pop() || `ruleset-${ref.index}.list`;
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${String(ref.index).padStart(3, "0")}-${safeName}`;
}

export function parseRulesetSlug(slug: string): number {
  const match = slug.match(/^(\d+)-/);
  if (!match) throw new Error("Invalid ruleset name");
  return Number(match[1]);
}

export function makeCustomRulesetSlug(policyGroup: string): string {
  return `${Buffer.from(policyGroup, "utf8").toString("base64url")}.list`;
}

export function parseCustomRulesetSlug(slug: string): string {
  const normalized = slug.replace(/\.list$/, "");
  if (!normalized) throw new Error("Invalid custom ruleset name");
  return Buffer.from(normalized, "base64url").toString("utf8");
}

export async function getRulesForProfile(profileId: string): Promise<ManagedRule[]> {
  const rules = await prisma.rule.findMany({
    where: { profileId, deletedAt: null },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
  return rules.map(ruleRecordToManaged);
}

export async function getExpandedUpstreamRules(profile: Profile): Promise<ExpandedUpstreamRule[]> {
  const config = await getUpstreamConfig(profile);
  const refs = parseRulesetRefs(config);
  const expanded: ExpandedUpstreamRule[] = [];
  for (const ref of refs) {
    const content = ref.source.startsWith("[]")
      ? ref.source.slice(2)
      : ref.source.startsWith("http")
        ? await getCachedText(ref.source)
        : "";
    if (content) {
      expanded.push(...expandRulesetContent(ref, content));
    }
  }
  return expanded;
}

export async function buildDynamicConfig(profile: Profile, publicBaseUrl: string): Promise<string> {
  const config = await getUpstreamConfig(profile);
  const rules = await getRulesForProfile(profile.id);
  const activeRules = rules.filter((rule) => rule.enabled && rule.mode !== "DIAGNOSE");
  const hasFilters = activeRules.some((rule) => rule.mode === "FILTER");
  const refs = parseRulesetRefs(config);
  const refByRaw = new Map(refs.map((ref) => [ref.raw, ref]));
  const normalRules = activeRules.filter((rule) => rule.type !== "FINAL" && rule.type !== "MATCH");
  const terminalRules = activeRules.filter((rule) => rule.type === "FINAL" || rule.type === "MATCH");
  const customGroups = [...new Set(normalRules.map((rule) => rule.policyGroup))];
  const customLines = [
    ...customGroups.map((group) => (
      `ruleset=${group},${publicBaseUrl}/custom-rulesets/${profile.token}/${makeCustomRulesetSlug(group)}`
    )),
    ...terminalRules.map(formatInlineRuleset),
  ];
  let inserted = false;

  const output = config.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (profile.nodeExcludeRegex?.trim() && trimmed.startsWith("exclude_remarks=")) {
      return `exclude_remarks=${profile.nodeExcludeRegex.trim()}`;
    }
    if (!inserted && trimmed.startsWith("ruleset=")) {
      inserted = true;
      const ref = refByRaw.get(trimmed);
      const firstRuleLine = ref && hasFilters && ref.source.startsWith("http")
        ? `ruleset=${ref.group},${publicBaseUrl}/rulesets/${profile.token}/${makeRulesetSlug(ref)}`
        : line;
      return [...customLines, firstRuleLine].join("\n");
    }
    const ref = refByRaw.get(trimmed);
    if (ref && hasFilters && ref.source.startsWith("http")) {
      const slug = makeRulesetSlug(ref);
      return `ruleset=${ref.group},${publicBaseUrl}/rulesets/${profile.token}/${slug}`;
    }
    return line;
  });

  if (!inserted && customLines.length) {
    output.push(...customLines);
  }

  if (profile.nodeExcludeRegex?.trim() && !output.some((line) => line.trim().startsWith("exclude_remarks="))) {
    output.unshift(`exclude_remarks=${profile.nodeExcludeRegex.trim()}`);
  }

  return output.join("\n");
}

export async function getFilteredRuleset(profile: Profile, slug: string): Promise<string> {
  const config = await getUpstreamConfig(profile);
  const refs = parseRulesetRefs(config);
  const ref = refs.find((item) => item.index === parseRulesetSlug(slug));
  if (!ref || !ref.source.startsWith("http")) {
    throw new Error("Ruleset not found");
  }

  const content = await getCachedText(ref.source);
  const rules = await getRulesForProfile(profile.id);
  return filterRulesetContent(content, rules);
}

export async function getCustomRuleset(profile: Profile, slug: string): Promise<string> {
  const policyGroup = parseCustomRulesetSlug(slug);
  const rules = await getRulesForProfile(profile.id);
  const lines = rules
    .filter((rule) => (
      rule.enabled &&
      rule.mode !== "DIAGNOSE" &&
      rule.policyGroup === policyGroup &&
      rule.type !== "FINAL" &&
      rule.type !== "MATCH"
    ))
    .map((rule) => `${toClashType(rule.type)},${rule.value}`);

  return lines.join("\n");
}

export function applyProfileNodeFilters(
  params: URLSearchParams,
  profile: Pick<Profile, "nodeExcludeRegex">,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (profile.nodeExcludeRegex?.trim() && !next.has("exclude_remarks")) {
    next.set("exclude_remarks", profile.nodeExcludeRegex.trim());
  }
  return next;
}

export function managedNodeSourceUrl(publicBaseUrl: string, token: string): string {
  return `${publicBaseUrl.replace(/\/$/, "")}/nodes/${token}`;
}

export async function buildSubconverterRequest(
  profile: Profile,
  requestUrl: URL,
  publicBaseUrl: string,
): Promise<{ url: string; sourceItems: string[] }> {
  const sources = await prisma.profileSource.findMany({
    where: { profileId: profile.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const sourcePayload = buildSourcePayload(sources.map((source) => ({
    type: source.type,
    value: source.value,
    tag: source.tag,
    enabled: source.enabled,
    sortOrder: source.sortOrder,
  })));

  if (!sourcePayload.items.length) {
    throw new Error("Profile has no enabled sources");
  }

  let params = new URLSearchParams(requestUrl.searchParams);
  params.set("target", params.get("target") || profile.defaultTarget || "clash");
  params.set("url", managedNodeSourceUrl(publicBaseUrl, profile.token));
  params.set("config", `${publicBaseUrl}/config/${profile.token}.ini`);
  params = applyProfileNodeFilters(params, profile);

  const upstreamUrl = new URL("/sub", env.SUBCONVERTER_URL);
  for (const [key, value] of params.entries()) {
    upstreamUrl.searchParams.set(key, value);
  }

  return { url: upstreamUrl.toString(), sourceItems: sourcePayload.items };
}

export async function buildNodeConverterRequest(profile: Profile): Promise<{ url: string; sourceItems: string[] }> {
  const sources = await prisma.profileSource.findMany({
    where: { profileId: profile.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const sourcePayload = buildSourcePayload(sources.map((source) => ({
    type: source.type,
    value: source.value,
    tag: source.tag,
    enabled: source.enabled,
    sortOrder: source.sortOrder,
  })));

  if (!sourcePayload.items.length) {
    throw new Error("Profile has no enabled sources");
  }

  let params = new URLSearchParams();
  params.set("target", "mixed");
  params.set("url", sourcePayload.raw);
  params = applyProfileNodeFilters(params, profile);

  const upstreamUrl = new URL("/sub", env.SUBCONVERTER_URL);
  for (const [key, value] of params.entries()) {
    upstreamUrl.searchParams.set(key, value);
  }

  return { url: upstreamUrl.toString(), sourceItems: sourcePayload.items };
}
