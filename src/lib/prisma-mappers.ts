import type { Rule, RuleMode, RuleType, SourceType } from "@prisma/client";

import { toClashType, toPrismaRuleType } from "./rules/engine";
import type { ClashRuleType, ManagedRule, SourceInput } from "./rules/types";

const RULE_MODE_TO_PRISMA: Record<string, RuleMode> = {
  PIN: "PIN",
  FILTER: "FILTER",
  DIAGNOSE: "DIAGNOSE",
};

export function toPrismaMode(mode: string): RuleMode {
  const value = RULE_MODE_TO_PRISMA[mode.toUpperCase()];
  if (!value) throw new Error(`Unsupported rule mode: ${mode}`);
  return value;
}

export function toPrismaSourceType(type: string): SourceType {
  const normalized = type.toUpperCase();
  if (normalized === "SUBSCRIPTION" || normalized === "NODE" || normalized === "BULK") {
    return normalized as SourceType;
  }
  throw new Error(`Unsupported source type: ${type}`);
}

export function toPrismaRuleEnum(type: ClashRuleType): RuleType {
  return toPrismaRuleType(type) as RuleType;
}

export function ruleRecordToManaged(rule: Rule): ManagedRule {
  return {
    id: rule.id,
    category: rule.category,
    type: toClashType(rule.type),
    value: rule.value,
    policyGroup: rule.policyGroup,
    mode: rule.mode,
    enabled: rule.enabled,
    priority: rule.priority,
    note: rule.note,
  };
}

export function sourceRecordToInput(source: {
  type: SourceType;
  value: string;
  tag: string | null;
  enabled: boolean;
  sortOrder: number;
}): SourceInput {
  return {
    type: source.type,
    value: source.value,
    tag: source.tag,
    enabled: source.enabled,
    sortOrder: source.sortOrder,
  };
}
