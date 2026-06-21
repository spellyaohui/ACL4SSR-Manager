import {
  type ClashRuleType,
  type ExpandedUpstreamRule,
  type ManagedRule,
  type ParsedRuleImport,
  type RuleDiagnosis,
  RULE_TYPES,
  type SourceInput,
  type UpstreamRule,
  type UpstreamRulesetRef,
} from "./types";

const RULE_TYPE_SET = new Set<string>(RULE_TYPES);

const PRISMA_TO_CLASH_TYPE: Record<string, ClashRuleType> = {
  DOMAIN: "DOMAIN",
  DOMAIN_SUFFIX: "DOMAIN-SUFFIX",
  DOMAIN_KEYWORD: "DOMAIN-KEYWORD",
  IP_CIDR: "IP-CIDR",
  IP_CIDR6: "IP-CIDR6",
  PROCESS_NAME: "PROCESS-NAME",
  GEOIP: "GEOIP",
  FINAL: "FINAL",
  MATCH: "MATCH",
};

const CLASH_TO_PRISMA_TYPE: Record<ClashRuleType, string> = {
  DOMAIN: "DOMAIN",
  "DOMAIN-SUFFIX": "DOMAIN_SUFFIX",
  "DOMAIN-KEYWORD": "DOMAIN_KEYWORD",
  "IP-CIDR": "IP_CIDR",
  "IP-CIDR6": "IP_CIDR6",
  "PROCESS-NAME": "PROCESS_NAME",
  GEOIP: "GEOIP",
  FINAL: "FINAL",
  MATCH: "MATCH",
};

export function toClashType(type: string): ClashRuleType {
  const normalized = type.trim().toUpperCase().replaceAll("_", "-");
  if (RULE_TYPE_SET.has(normalized)) {
    return normalized as ClashRuleType;
  }
  const fromPrisma = PRISMA_TO_CLASH_TYPE[type.trim().toUpperCase()];
  if (fromPrisma) {
    return fromPrisma;
  }
  throw new Error(`Unsupported rule type: ${type}`);
}

export function toPrismaRuleType(type: ClashRuleType): string {
  return CLASH_TO_PRISMA_TYPE[type];
}

export function normalizeRuleValue(value: string): string {
  return value.trim().toLowerCase();
}

export function parseManagedRuleLine(
  line: string,
  category: string,
  defaults?: Partial<ManagedRule>,
): ManagedRule {
  const normalized = line.trim().replace(/^-+\s*/, "");
  const parts = normalized.split(",").map((part) => part.trim());
  if (parts.length < 2) {
    throw new Error("Rule must contain at least a type and value");
  }

  const type = toClashType(parts[0]);
  if (type === "FINAL" || type === "MATCH") {
    const policyGroup = parts[1];
    if (!policyGroup) {
      throw new Error(`${type} rule requires a policy group`);
    }
    return {
      category,
      type,
      value: "",
      policyGroup,
      mode: defaults?.mode ?? "PIN",
      enabled: defaults?.enabled ?? true,
      priority: defaults?.priority ?? 0,
      note: defaults?.note ?? null,
    };
  }

  if (parts.length < 3) {
    throw new Error("Rule must contain a policy group");
  }

  return {
    category,
    type,
    value: parts[1],
    policyGroup: parts.slice(2).join(",").trim(),
    mode: defaults?.mode ?? "PIN",
    enabled: defaults?.enabled ?? true,
    priority: defaults?.priority ?? 0,
    note: defaults?.note ?? null,
  };
}

export function importRulesFromText(
  text: string,
  defaults?: Partial<ManagedRule>,
): ParsedRuleImport {
  let category = defaults?.category ?? "General";
  const rules: ManagedRule[] = [];
  const errors: ParsedRuleImport["errors"] = [];

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    if (line.startsWith("#") || line.startsWith(";")) {
      const nextCategory = line.replace(/^[#;]+\s*/, "").trim();
      if (nextCategory) category = nextCategory;
      return;
    }
    try {
      rules.push(parseManagedRuleLine(line, category, defaults));
    } catch (error) {
      errors.push({
        line: index + 1,
        text: rawLine,
        message: error instanceof Error ? error.message : "Invalid rule",
      });
    }
  });

  return { rules, errors };
}

export function formatInlineRuleset(rule: ManagedRule): string {
  if (rule.type === "FINAL" || rule.type === "MATCH") {
    return `ruleset=${rule.policyGroup},[]${rule.type}`;
  }
  return `ruleset=${rule.policyGroup},[]${rule.type},${rule.value}`;
}

export function parseUpstreamRuleLine(line: string): UpstreamRule | null {
  const trimmed = line.trim().replace(/^-\s*/, "");
  if (!trimmed || trimmed.startsWith("#") || trimmed === "payload:") {
    return null;
  }
  const parts = trimmed.split(",").map((part) => part.trim());
  if (parts.length < 2) return null;
  let type: ClashRuleType;
  try {
    type = toClashType(parts[0]);
  } catch {
    return null;
  }
  if (type === "FINAL" || type === "MATCH") {
    return { type, value: "", raw: trimmed };
  }
  return { type, value: parts[1], raw: trimmed };
}

export function parseRulesetRefs(configText: string): UpstreamRulesetRef[] {
  let index = 0;
  return configText
    .split(/\r?\n/)
    .map((raw) => raw.trim())
    .filter((line) => line.startsWith("ruleset="))
    .map((line) => {
      index += 1;
      const body = line.slice("ruleset=".length);
      const comma = body.indexOf(",");
      return {
        index,
        group: comma >= 0 ? body.slice(0, comma) : "",
        source: comma >= 0 ? body.slice(comma + 1) : "",
        raw: line,
      };
    })
    .filter((ref) => ref.group && ref.source);
}

export function ruleCovers(managed: ManagedRule, upstream: UpstreamRule): boolean {
  const managedValue = normalizeRuleValue(managed.value);
  const upstreamValue = normalizeRuleValue(upstream.value);

  if (managed.type === "DOMAIN-KEYWORD") {
    return upstream.type.startsWith("DOMAIN") && upstreamValue.includes(managedValue);
  }

  if (managed.type === "DOMAIN-SUFFIX") {
    return (
      (upstream.type === "DOMAIN" || upstream.type === "DOMAIN-SUFFIX") &&
      (upstreamValue === managedValue || upstreamValue.endsWith(`.${managedValue}`))
    );
  }

  if (managed.type === "DOMAIN") {
    return upstream.type === "DOMAIN" && upstreamValue === managedValue;
  }

  if (managed.type === "FINAL" || managed.type === "MATCH") {
    return upstream.type === "FINAL" || upstream.type === "MATCH";
  }

  return managed.type === upstream.type && upstreamValue === managedValue;
}

export function diagnoseRule(
  rule: ManagedRule,
  expandedRules: ExpandedUpstreamRule[],
): RuleDiagnosis {
  if (rule.mode === "DIAGNOSE") {
    return { rule, status: "DIAGNOSE_ONLY", recommendation: "DIAGNOSE" };
  }

  const firstMatch = expandedRules
    .filter((upstream) => ruleCovers(rule, upstream))
    .sort((a, b) => a.index - b.index)[0];

  if (!firstMatch) {
    return { rule, status: "NO_UPSTREAM_MATCH", recommendation: "PIN" };
  }

  if (firstMatch.group === rule.policyGroup) {
    return { rule, status: "SAME_GROUP", firstMatch, recommendation: "DIAGNOSE" };
  }

  return { rule, status: "OVERRIDE_REQUIRED", firstMatch, recommendation: "PIN" };
}

export function filterRulesetContent(content: string, filters: ManagedRule[]): string {
  const activeFilters = filters.filter((rule) => rule.enabled && rule.mode === "FILTER");
  if (!activeFilters.length) return content;

  return content
    .split(/\r?\n/)
    .filter((line) => {
      const parsed = parseUpstreamRuleLine(line);
      if (!parsed) return true;
      return !activeFilters.some((rule) => ruleCovers(rule, parsed));
    })
    .join("\n");
}

export function expandRulesetContent(
  ref: UpstreamRulesetRef,
  content: string,
): ExpandedUpstreamRule[] {
  return content
    .split(/\r?\n/)
    .map(parseUpstreamRuleLine)
    .filter((rule): rule is UpstreamRule => Boolean(rule))
    .map((rule) => ({
      ...rule,
      index: ref.index,
      group: ref.group,
      source: ref.source,
    }));
}

export function buildSourcePayload(sources: SourceInput[]): {
  raw: string;
  encoded: string;
  items: string[];
} {
  const items = sources
    .filter((source) => source.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .flatMap((source) => {
      const values =
        source.type === "BULK"
          ? source.value
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter((line) => line && !line.startsWith("#"))
          : [source.value.trim()].filter(Boolean);

      return values.map((value) => (source.tag ? `tag:${source.tag},${value}` : value));
    });
  const raw = items.join("|");
  return { raw, encoded: encodeURIComponent(raw), items };
}
