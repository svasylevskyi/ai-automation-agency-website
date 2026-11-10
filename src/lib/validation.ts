import { z } from "zod";
import { assessmentSchema } from "./assessment";
import { followUpDate } from "./follow-up";

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
export const inboxPageSize = 20;
export const inboxStatusSchema = z.strictObject({
  status: statusSchema,
  enquiries: z
    .array(
      z.strictObject({
        id: z.uuid().toLowerCase(),
        version: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(inboxPageSize)
    .refine(
      (items) => new Set(items.map(({ id }) => id)).size === items.length,
      "Select each enquiry once.",
    ),
});
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
export const enquirySchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    company: z.string().trim().max(120).default(""),
    area: z.enum(["sales", "operations", "support", "other"]),
    teamSize: z.enum(["small", "mid", "large"]),
    message: z.string().trim().max(5000),
    assessment: assessmentSchema.optional(),
    privacyAcknowledged: z.literal(true),
    website: z.string().max(300).default(""),
    token: z.string().min(20).max(500),
  })
  .superRefine((input, context) => {
    if (!input.assessment && input.message.length < 20) {
      context.addIssue({
        code: "custom",
        path: ["message"],
        message: "Please describe your workflow in at least 20 characters.",
      });
    }
    if (
      input.assessment &&
      (input.area !== input.assessment.area ||
        input.teamSize !== input.assessment.teamSize)
    ) {
      context.addIssue({
        code: "custom",
        path: ["assessment"],
        message:
          "The workflow and team must match your assessment. Please review it again.",
      });
    }
  });
export const enquiryUpdateSchema = z
  .object({
    status: statusSchema,
    notes: z.string().max(10000),
    version: z.number().int().min(1),
    nextAction: z.string().trim().max(300),
    followUpDate: followUpDate.nullable(),
  })
  .superRefine((value, ctx) => {
    if (!!value.nextAction !== !!value.followUpDate)
      ctx.addIssue({
        code: "custom",
        path: ["followUpDate"],
        message: "Add both a next action and a follow-up date, or clear both.",
      });
    if (value.status === "closed" && value.nextAction)
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: "Complete or clear the follow-up before closing this enquiry.",
      });
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
