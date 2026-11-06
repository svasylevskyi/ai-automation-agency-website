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
  return [...new Set(text.match(/\[[A-Z][A-Z0-9_]*\]/g) ?? [])];
}
export const legalUpdateSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    content: z.string().trim().min(100).max(60000),
    isDraft: z.boolean(),
    version: z.number().int().positive(),
  })
  .superRefine((value, ctx) => {
    if (
      !value.isDraft &&
      legalPlaceholders(value.title + "\n" + value.content).length
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["isDraft"],
        message:
          "Replace the bracketed placeholders before marking this page ready.",
      });
    }
  });
export type LegalPage = {
  slug: LegalSlug;
  title: string;
  content: string;
  isDraft: boolean;
  version: number;
  updatedAt: string;
};
