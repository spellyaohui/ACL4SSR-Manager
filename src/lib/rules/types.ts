export const RULE_TYPES = [
  "DOMAIN",
  "DOMAIN-SUFFIX",
  "DOMAIN-KEYWORD",
  "IP-CIDR",
  "IP-CIDR6",
  "PROCESS-NAME",
  "GEOIP",
  "FINAL",
  "MATCH",
] as const;

export const RULE_MODES = ["PIN", "FILTER", "DIAGNOSE"] as const;

export type ClashRuleType = (typeof RULE_TYPES)[number];
export type RuleMode = (typeof RULE_MODES)[number];

export type ManagedRule = {
  id?: string;
  category: string;
  type: ClashRuleType;
  value: string;
  policyGroup: string;
  mode: RuleMode;
  enabled: boolean;
  priority: number;
  note?: string | null;
};

export type UpstreamRule = {
  type: ClashRuleType;
  value: string;
  raw: string;
};

export type UpstreamRulesetRef = {
  index: number;
  group: string;
  source: string;
  raw: string;
};

export type ExpandedUpstreamRule = UpstreamRule & {
  index: number;
  group: string;
  source: string;
};

export type DiagnosisStatus =
  | "NO_UPSTREAM_MATCH"
  | "SAME_GROUP"
  | "OVERRIDE_REQUIRED"
  | "DIAGNOSE_ONLY";

export type RuleDiagnosis = {
  rule: ManagedRule;
  status: DiagnosisStatus;
  firstMatch?: ExpandedUpstreamRule;
  recommendation: "PIN" | "FILTER" | "DIAGNOSE";
};

export type ParsedRuleImport = {
  rules: ManagedRule[];
  errors: Array<{ line: number; text: string; message: string }>;
};

export type SourceInput = {
  type: "SUBSCRIPTION" | "NODE" | "BULK";
  value: string;
  tag?: string | null;
  enabled: boolean;
  sortOrder: number;
};
