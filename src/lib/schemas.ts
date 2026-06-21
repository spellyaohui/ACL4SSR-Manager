import { z } from "zod";

import { RULE_MODES, RULE_TYPES } from "./rules/types";

const OptionalRegexSchema = z
  .string()
  .max(500)
  .optional()
  .nullable()
  .refine((value) => {
    if (!value) return true;
    try {
      new RegExp(value);
      return true;
    } catch {
      return false;
    }
  }, "请输入有效的正则表达式");

export const ProfileCreateSchema = z.object({
  name: z.string().min(1).max(80).trim(),
  description: z.string().max(500).optional().nullable(),
  defaultTarget: z.string().min(1).max(40).default("clash"),
  upstreamConfigUrl: z.string().url().optional(),
  nodeExcludeRegex: OptionalRegexSchema,
});

export const ProfileUpdateSchema = ProfileCreateSchema.partial();

export const SourceCreateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  type: z.enum(["SUBSCRIPTION", "NODE", "BULK"]),
  value: z.string().min(1).max(20000),
  tag: z.string().max(80).optional().nullable(),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export const SourceUpdateSchema = SourceCreateSchema.partial();

export const RuleCreateSchema = z.object({
  profileId: z.string().min(1),
  category: z.string().min(1).max(80).default("General"),
  type: z.enum(RULE_TYPES),
  value: z.string().max(500).default(""),
  policyGroup: z.string().min(1).max(100),
  mode: z.enum(RULE_MODES).default("PIN"),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).default(0),
  note: z.string().max(500).optional().nullable(),
});

export const RuleUpdateSchema = RuleCreateSchema.omit({ profileId: true }).partial();

export const RuleImportSchema = z.object({
  profileId: z.string().min(1),
  text: z.string().min(1).max(100000),
  mode: z.enum(RULE_MODES).default("PIN"),
});

export const RuleDiagnoseSchema = z.object({
  profileId: z.string().min(1),
  rule: RuleCreateSchema.omit({ profileId: true }).optional(),
  text: z.string().max(100000).optional(),
});

export const LoginSchema = z.object({
  password: z.string().min(1).max(500),
});
