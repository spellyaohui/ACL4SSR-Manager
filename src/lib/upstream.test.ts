import { describe, expect, it } from "vitest";

import {
  applyProfileNodeFilters,
  makeCustomRulesetSlug,
  managedNodeSourceUrl,
  parseCustomRulesetSlug,
} from "./upstream";

describe("applyProfileNodeFilters", () => {
  it("adds the profile node exclude regex to subconverter params", () => {
    const params = applyProfileNodeFilters(new URLSearchParams("target=clash"), {
      nodeExcludeRegex: "官网|流量",
    });

    expect(params.get("exclude_remarks")).toBe("官网|流量");
  });

  it("keeps an explicit request exclude_remarks parameter", () => {
    const params = applyProfileNodeFilters(new URLSearchParams("exclude_remarks=倍率"), {
      nodeExcludeRegex: "官网|流量",
    });

    expect(params.get("exclude_remarks")).toBe("倍率");
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
