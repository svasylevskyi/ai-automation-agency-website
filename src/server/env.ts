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
  MAIL_PROVIDER: z.enum(["smtp", "resend"]).default("smtp"),
  MAIL_FROM: z.union([z.email(), z.literal("")]).default(""),
  RESEND_API_KEY: z.string().trim().default(""),
  SMTP_HOST: z.string().min(1).default("127.0.0.1"),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.email().default("website@example.test"),
  NOTIFICATION_EMAIL: z.email().default("owner@example.test"),
  INDEX_SITE: z.enum(["true", "false"]).default("false"),
  N8N_ENQUIRY_WEBHOOK_URL: z.string().trim().default(""),
  PROSPECT_AUTOMATION_ENABLED: z.enum(["true", "false"]).default("false"),
  PROSPECT_AUTOMATION_TOKEN: z.string().max(128).default(""),
  TRUSTED_IP_HEADER: z
    .string()
    .regex(/^[a-z0-9-]*$/)
    .default(""),
});

export function env(source: NodeJS.ProcessEnv = process.env) {
  const result = schema.safeParse(source);
  if (!result.success)
    throw new Error(
      `Invalid configuration: ${result.error.issues.map((i) => i.path.join(".")).join(", ")}. See .env.example.`,
    );
  const url = new URL(result.data.APP_URL);
  const mailFrom = result.data.MAIL_FROM || result.data.SMTP_FROM;
  if (result.data.MAIL_PROVIDER === "resend") {
    if (!/^re_[A-Za-z0-9_-]+$/.test(result.data.RESEND_API_KEY))
      throw new Error("Set RESEND_API_KEY before enabling Resend.");
    for (const [field, address] of [
      ["MAIL_FROM", mailFrom],
      ["NOTIFICATION_EMAIL", result.data.NOTIFICATION_EMAIL],
    ]) {
      const domain = address.split("@")[1].toLowerCase();
      if (
        !domain.includes(".") ||
        /(^|\.)(test|invalid|localhost|example\.(com|net|org)|resend\.dev)$/.test(
          domain,
        )
      )
        throw new Error(
          `Set a real business address for ${field} before enabling Resend.`,
        );
    }
  }
  if (
    result.data.PROSPECT_AUTOMATION_ENABLED === "true" &&
    !/^[A-Za-z0-9_-]{43,128}$/.test(result.data.PROSPECT_AUTOMATION_TOKEN)
  )
    throw new Error(
      "Set a unique random PROSPECT_AUTOMATION_TOKEN before enabling prospect automation.",
    );
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
  return { ...result.data, APP_URL: url.origin, MAIL_FROM: mailFrom };
}
