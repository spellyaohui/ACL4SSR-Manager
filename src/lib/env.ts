import { z } from "zod";

import { DEFAULT_ACL4SSR_CONFIG_URL } from "./constants";

const EnvSchema = z.object({
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  ADMIN_PASSWORD: z.string().min(1).default("change-me"),
  DATABASE_URL: z.string().min(1).default("file:./dev.db"),
  SUBCONVERTER_URL: z.string().url().default("http://localhost:25500"),
  ACL4SSR_BASE_CONFIG_URL: z.string().url().default(DEFAULT_ACL4SSR_CONFIG_URL),
  AUTH_SECRET: z.string().min(16).optional(),
  NODE_ENV: z.string().default("development"),
});

export const env = EnvSchema.parse(process.env);
