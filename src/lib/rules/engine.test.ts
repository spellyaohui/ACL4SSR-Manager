import { describe, expect, it } from "vitest";

import {
  buildSourcePayload,
  diagnoseRule,
  expandRulesetContent,
  filterRulesetContent,
  importRulesFromText,
  parseRulesetRefs,
  ruleCovers,
} from "./engine";
import type { ManagedRule, SourceInput } from "./types";

describe("rule import", () => {
  it("imports Clash rule blocks and keeps category comments", () => {
    const result = importRulesFromText(`
#PT
- DOMAIN-SUFFIX,m-team.cc,🎯 全球直连
#AI
- DOMAIN-SUFFIX,chatgpt.com,💬 Ai平台
`);

    expect(result.errors).toEqual([]);
    expect(result.rules).toMatchObject([
      { category: "PT", type: "DOMAIN-SUFFIX", value: "m-team.cc" },
      { category: "AI", type: "DOMAIN-SUFFIX", value: "chatgpt.com" },
    ]);
  });
});

describe("rule coverage", () => {
  it("treats a manual domain suffix as covering exact and child domains only", () => {
    const rule: ManagedRule = {
      category: "AV",
      type: "DOMAIN-SUFFIX",
      value: "dmm.com",
      policyGroup: "🇯🇵 日本节点",
      mode: "PIN",
      enabled: true,
      priority: 0,
    };

    expect(ruleCovers(rule, { type: "DOMAIN-SUFFIX", value: "dmm.com", raw: "" })).toBe(true);
    expect(ruleCovers(rule, { type: "DOMAIN", value: "api.dmm.com", raw: "" })).toBe(true);
    expect(ruleCovers(rule, { type: "DOMAIN-SUFFIX", value: "qdmm.com", raw: "" })).toBe(false);
  });

  it("uses first upstream match to identify override requirements", () => {
    const refs = parseRulesetRefs(
      [
        "ruleset=💬 Ai平台,https://example.com/AI.list",
        "ruleset=🚀 节点选择,https://example.com/ProxyGFWlist.list",
      ].join("\n"),
    );
    const upstream = [
      ...expandRulesetContent(refs[0], "DOMAIN-SUFFIX,chatgpt.com"),
      ...expandRulesetContent(refs[1], "DOMAIN-SUFFIX,githubusercontent.com"),
    ];

    const diagnosis = diagnoseRule(
      {
        category: "Other",
        type: "DOMAIN-SUFFIX",
        value: "githubusercontent.com",
        policyGroup: "🚀 手动切换",
        mode: "PIN",
        enabled: true,
        priority: 0,
      },
      upstream,
    );

    expect(diagnosis.status).toBe("OVERRIDE_REQUIRED");
    expect(diagnosis.firstMatch?.group).toBe("🚀 节点选择");
  });

  it("preserves managed rule ids in diagnosis results", () => {
    const diagnosis = diagnoseRule(
      {
        id: "rule-1",
        category: "AI",
        type: "DOMAIN-SUFFIX",
        value: "chatgpt.com",
        policyGroup: "💬 Ai平台",
        mode: "PIN",
        enabled: true,
        priority: 0,
      },
      [],
    );

    expect(diagnosis.rule.id).toBe("rule-1");
    expect(diagnosis.status).toBe("NO_UPSTREAM_MATCH");
  });
});

describe("ruleset filtering", () => {
  it("removes upstream rules covered by FILTER custom rules", () => {
    const filtered = filterRulesetContent(
      ["# proxy list", "DOMAIN-SUFFIX,dmm.com", "DOMAIN-SUFFIX,example.com"].join("\n"),
      [
        {
          category: "AV",
          type: "DOMAIN-SUFFIX",
          value: "dmm.com",
          policyGroup: "🇯🇵 日本节点",
          mode: "FILTER",
          enabled: true,
          priority: 0,
        },
      ],
    );

    expect(filtered).not.toContain("DOMAIN-SUFFIX,dmm.com");
    expect(filtered).toContain("DOMAIN-SUFFIX,example.com");
  });
});

describe("source payloads", () => {
  it("merges subscriptions and node links in order using the subconverter separator", () => {
    const sources: SourceInput[] = [
      { type: "NODE", value: "vmess://abc", enabled: true, sortOrder: 2 },
      { type: "SUBSCRIPTION", value: "https://airport.example/sub", enabled: true, sortOrder: 1 },
      { type: "BULK", value: "ss://one\n# comment\ntrojan://two", enabled: true, sortOrder: 3 },
    ];

    const payload = buildSourcePayload(sources);

    expect(payload.items).toEqual([
      "https://airport.example/sub",
      "vmess://abc",
      "ss://one",
      "trojan://two",
    ]);
    expect(payload.raw).toContain("|vmess://abc|");
    expect(payload.encoded).toContain("%7Cvmess%3A%2F%2Fabc%7C");
  });
});
