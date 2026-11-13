import { z } from "zod";

export const legalSlugs = ["privacy", "terms"] as const;
export const legalSlugSchema = z.enum(legalSlugs);
export type LegalSlug = z.infer<typeof legalSlugSchema>;
export const legalPages = {
  privacy: {
    title: "Privacy Policy",
    path: "/privacy",
    file: "privacy-policy.md",
    description:
      "How we handle website enquiries, assessment answers and personal data.",
  },
  terms: {
    title: "Website Terms",
    path: "/terms",
    file: "website-terms.md",
    description:
      "Terms for using the website, workflow assessment and enquiry form.",
  },
} as const;
export function privacyHref(privacyUrl: string) {
  return privacyUrl || legalPages.privacy.path;
}
export function legalPlaceholders(text: string) {
  // Recognise legacy tokens too, so pasted old wording cannot bypass readiness.
  return [
    ...new Set(text.match(/\{[A-Z][A-Z0-9_]*\}|\[[A-Z][A-Z0-9_]*\]/g) ?? []),
  ];
}
export function legalKeys(text: string) {
  return [
    ...new Set(legalPlaceholders(text).map((token) => token.slice(1, -1))),
  ];
}
export function resolveLegalText(text: string, values: Record<string, string>) {
  // One literal pass: never evaluate code, markup or nested substitutions.
  return text.replace(/\{[A-Z][A-Z0-9_]*\}|\[[A-Z][A-Z0-9_]*\]/g, (token) => {
    const key = token.slice(1, -1);
    return Object.hasOwn(values, key) && values[key].trim()
      ? values[key]
      : token;
  });
}
export function unresolvedLegalKeys(
  text: string,
  values: Record<string, string>,
) {
  return legalKeys(resolveLegalText(text, values));
}
export const legalValuesSchema = z
  .record(
    z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/),
    z
      .string()
      .trim()
      .max(4000)
      .refine((value) => !legalPlaceholders(value).length, {
        message: "Enter the value itself, not another placeholder.",
      }),
  )
  .refine(
    (values) => Object.keys(values).length <= 64,
    "Use at most 64 placeholder fields.",
  );
export const legalUpdateSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    content: z.string().trim().min(100).max(60000),
    isDraft: z.boolean(),
    version: z.number().int().positive(),
    values: legalValuesSchema,
    valuesVersion: z.number().int().positive(),
  })
  .superRefine((value, ctx) => {
    if (
      !value.isDraft &&
      unresolvedLegalKeys(value.title + "\n" + value.content, value.values)
        .length
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["isDraft"],
        message: "Fill all placeholder fields before marking this page ready.",
      });
    }
    const keys = legalKeys(value.title + "\n" + value.content);
    if (keys.length > 64 || keys.some((key) => key.length > 64))
      ctx.addIssue({
        code: "custom",
        path: ["content"],
        message:
          "Use at most 64 placeholders, with names no longer than 64 characters.",
      });
  });
export type LegalPage = {
  slug: LegalSlug;
  title: string;
  content: string;
  isDraft: boolean;
  version: number;
  updatedAt: string;
  values: Record<string, string>;
  valuesVersion: number;
};
