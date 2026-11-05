import { z } from "zod";

export const statuses = {
  new: "New",
  contacted: "Contacted",
  in_progress: "In progress",
  closed: "Closed",
} as const;
export const statusSchema = z.enum([
  "new",
  "contacted",
  "in_progress",
  "closed",
]);
const optionalEmail = z.union([z.literal(""), z.email().max(254)]);
const optionalHttps = z.union([
  z.literal(""),
  z
    .url()
    .max(500)
    .refine((value) => {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    }, "Use an HTTPS URL without credentials."),
]);

export const settingsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(20).max(300),
  tagline: z.string().trim().min(2).max(120),
  contactEmail: optionalEmail,
  bookingUrl: optionalHttps,
  privacyUrl: optionalHttps,
  showName: z.boolean(),
  logoId: z.uuid().nullable(),
});
export type SiteSettings = z.infer<typeof settingsSchema>;
export const settingsUpdateSchema = settingsSchema.extend({
  version: z.number().int().min(1),
});
export const enquirySchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  company: z.string().trim().max(120).default(""),
  area: z.enum(["sales", "operations", "support"]),
  teamSize: z.enum(["small", "mid", "large"]),
  message: z.string().trim().min(20).max(5000),
  privacyAcknowledged: z.literal(true),
  website: z.string().max(300).default(""),
  token: z.string().min(20).max(500),
});
export const enquiryUpdateSchema = z.object({
  status: statusSchema,
  notes: z.string().max(10000),
  version: z.number().int().min(1),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(12).max(128),
    confirmPassword: z.string().min(1).max(128),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "The new passwords must match.",
    path: ["confirmPassword"],
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: "Choose a different password.",
    path: ["newPassword"],
  });
