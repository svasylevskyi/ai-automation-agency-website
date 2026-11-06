import { z } from "zod";

export const confirmationPayloadSchema = z.object({
  subject: z.string().max(200),
  text: z.string().max(5000),
  replyTo: z.email().optional(),
});
export function confirmationMessage(brand: {
  name: string;
  contactEmail: string;
  bookingUrl: string;
}) {
  // Only owner-controlled public settings are accepted here. Never echo submitted content.
  return {
    subject: "We've received your enquiry",
    text: [
      `Thank you for contacting ${brand.name}.`,
      "We've received an enquiry using this email address. We'll review it and get in touch to discuss a suitable next step. We may ask a few questions before suggesting an approach.",
      "This confirms receipt only. It does not book a consultation, order paid services or guarantee a particular outcome or response time.",
      ...(brand.bookingUrl
        ? [
            `If you prefer a call, you can choose a time here: ${brand.bookingUrl}`,
          ]
        : []),
      ...(brand.contactEmail
        ? ["For corrections or questions, reply to this email."]
        : [
            "This is an automatic acknowledgement. Please use the website enquiry form for any corrections; replies to this sender are not monitored.",
          ]),
      "For your privacy, this email does not include the enquiry message or assessment. If you did not submit an enquiry, you can ignore this email. You have not been subscribed to a mailing list.",
    ].join("\n\n"),
    ...(brand.contactEmail ? { replyTo: brand.contactEmail } : {}),
  };
}
