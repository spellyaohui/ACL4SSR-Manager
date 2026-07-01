import { describe, expect, it } from "vitest";

import {
  applyProfileNodeFilters,
  countNodeLinks,
  decodeSubscriptionBody,
  isClashSubscriptionContent,
  isEmptyNodeConverterOutput,
  makeCustomRulesetSlug,
  managedNodeSourceUrl,
  parseCustomRulesetSlug,
} from "./upstream";

describe("isEmptyNodeConverterOutput", () => {
  it("treats empty and no-node responses as empty", () => {
    expect(isEmptyNodeConverterOutput("")).toBe(true);
    expect(isEmptyNodeConverterOutput("No nodes were found!")).toBe(true);
    expect(isEmptyNodeConverterOutput("ss://abc\nvmess://def")).toBe(false);
  });
});

describe("decodeSubscriptionBody", () => {
  it("decodes base64 node subscriptions", () => {
    const encoded = Buffer.from("anytls://uuid@host:11001#node", "utf8").toString("base64");
    expect(decodeSubscriptionBody(encoded)).toBe("anytls://uuid@host:11001#node");
  });

  it("keeps plain node links unchanged", () => {
    const plain = "ss://abc\nanytls://def";
    expect(decodeSubscriptionBody(plain)).toBe(plain);
  });
});

describe("countNodeLinks", () => {
  it("counts protocol links and ignores comments", () => {
    const content = "ss://a\n# comment\nanytls://b\nnot-a-link";
    expect(countNodeLinks(content)).toBe(2);
  });
});

describe("isClashSubscriptionContent", () => {
  it("detects clash yaml subscriptions", () => {
    expect(isClashSubscriptionContent("port: 7890\nproxies:\n  - name: a")).toBe(true);
    expect(isClashSubscriptionContent("anytls://abc\nvmess://def")).toBe(false);
  });
});

describe("applyProfileNodeFilters", () => {
  it("adds the profile node exclude regex to subconverter params", () => {
    const params = applyProfileNodeFilters(new URLSearchParams("target=clash"), {
      nodeExcludeRegex: "官网|流量",
    });

    expect(params.get("exclude")).toBe("官网|流量");
  });

  it("keeps an explicit request exclude parameter", () => {
    const params = applyProfileNodeFilters(new URLSearchParams("exclude=倍率"), {
      nodeExcludeRegex: "官网|流量",
    });

    expect(params.get("exclude")).toBe("倍率");
  });

  it("maps an explicit exclude_remarks request parameter to exclude", () => {
    const params = applyProfileNodeFilters(new URLSearchParams("exclude_remarks=倍率"), {
      nodeExcludeRegex: "官网|流量",
    });

    expect(params.get("exclude")).toBe("倍率");
  });
});

describe("managedNodeSourceUrl", () => {
  it("builds the platform managed node source URL", () => {
    expect(managedNodeSourceUrl("https://acl4ssr.example.com", "token123")).toBe(
      "https://acl4ssr.example.com/nodes/token123",
    );
  });

  it("trims the public base URL trailing slash", () => {
    expect(managedNodeSourceUrl("https://acl4ssr.example.com/", "token123")).toBe(
      "https://acl4ssr.example.com/nodes/token123",
    );
  });
});

describe("custom ruleset slugs", () => {
  it("round-trips policy groups containing emoji and Chinese text", () => {
    const slug = makeCustomRulesetSlug("💬 Ai平台");

    expect(slug).toMatch(/\.list$/);
    expect(parseCustomRulesetSlug(slug)).toBe("💬 Ai平台");
  });
});
