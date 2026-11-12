import { z } from "zod";
import { followUpDate } from "./follow-up";
import { emailTemplate, type EmailBrand } from "./email-template";

export const replyPreviewSchema = z.strictObject({
  reviewVersion: z.number().int().positive(),
  enquiryVersion: z.number().int().positive(),
  subject: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .refine(
      (value) => !/[\u0000-\u001f\u007f]/.test(value),
      "Use a single-line subject.",
    ),
  followUp: z
    .strictObject({
      action: z.string().trim().min(1).max(300),
      date: followUpDate,
    })
    .nullable(),
});
export const replySendSchema = z.strictObject({
  deliveryId: z.uuid(),
  confirmed: z.literal(true),
});
export type ReplyPreviewInput = z.infer<typeof replyPreviewSchema>;
export type ReplyDelivery = {
  id: string;
  status: "preview" | "sending" | "accepted" | "unconfirmed";
  reviewVersion: number;
  enquiryVersion: number;
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
  provider: "smtp" | "resend";
  providerMessageId: string | null;
  attempts: number;
  acceptedAt: string | null;
  updatedAt: string;
  retryAllowed: boolean;
  followUp: ReplyPreviewInput["followUp"];
  followUpOutcome: "none" | "pending" | "applied" | "not_applied";
};

export function replyMessage(
  brand: EmailBrand,
  appUrl: string,
  subject: string,
  text: string,
) {
  return {
    subject,
    text: `${text}\n\n${brand.name}\n${new URL(appUrl).origin}`,
    html: emailTemplate({
      brand,
      appUrl,
      eyebrow: "Your enquiry",
      title: subject,
      preview: "A personal response to your enquiry.",
      paragraphs: text.split(/\n\s*\n/),
      notice: "You can reply to this email to continue the conversation.",
    }),
    replyTo: brand.contactEmail,
  };
}
