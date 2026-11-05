import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  APP_URL: z.string().url(),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32)
    .refine(
      (value) => value !== "GENERATE_WITH_NPM_RUN_SETUP_LOCAL",
      "Generate a unique secret with npm run setup:local.",
    ),
  SMTP_HOST: z.string().min(1).default("127.0.0.1"),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.email().default("website@example.test"),
  NOTIFICATION_EMAIL: z.email().default("owner@example.test"),
  INDEX_SITE: z.enum(["true", "false"]).default("false"),
  TRUSTED_IP_HEADER: z
    .string()
    .regex(/^[a-z0-9-]*$/)
    .default(""),
});

export function env() {
  const result = schema.safeParse(process.env);
  if (!result.success)
    throw new Error(
      `Invalid configuration: ${result.error.issues.map((i) => i.path.join(".")).join(", ")}. See .env.example.`,
    );
  const url = new URL(result.data.APP_URL);
  if (
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error(
      "APP_URL must be an origin without credentials, path, query or fragment.",
    );
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
  )
    throw new Error("APP_URL must use HTTPS outside localhost.");
  return { ...result.data, APP_URL: url.origin };
}
