import {
  emailPayloadSchema,
  emailTemplate,
  type EmailBrand,
} from "./email-template";

export const confirmationPayloadSchema = emailPayloadSchema;
export function confirmationMessage(
  brand: EmailBrand,
  appUrl: string,
  recipientName?: string,
) {
  // Personalise only the greeting. Never include the submitted enquiry/assessment.
  // Keep names on one line, bounded, and escaped when rendered in HTML.
  const name = (recipientName ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  const greeting = name ? `Hello ${name},` : "Hello,";
  const paragraphs = [
    `Thank you for contacting ${brand.name}.`,
    "We've received your enquiry and will review what you've shared. We'll be in touch to discuss a suitable next step. We may ask a few questions before suggesting an approach.",
    "This confirms receipt only. It does not book a consultation, order paid services or guarantee a particular outcome or response time.",
    brand.contactEmail
      ? "For corrections or questions, reply to this email."
      : "This is an automatic acknowledgement. Please use the website enquiry form for any corrections; replies to this sender are not monitored.",
    ...(brand.bookingUrl
      ? ["If you prefer a call, you can choose a time using the link below."]
      : []),
  ];
  const notice =
    "For your privacy, this email does not include the enquiry message or assessment. If you did not submit an enquiry, you can ignore this email. You have not been subscribed to a mailing list.";
  return {
    subject: "We've received your enquiry",
    text: [
      greeting,
      ...paragraphs,
      ...(brand.bookingUrl ? [brand.bookingUrl] : []),
      `Best regards,\n${brand.name}\n${new URL(appUrl).origin}`,
      notice,
    ].join("\n\n"),
    html: emailTemplate({
      brand,
      appUrl,
      eyebrow: "Enquiry received",
      title: "Thank you for getting in touch.",
      preview:
        "Your enquiry has been received. We will review it and get in touch about the next step.",
      greeting,
      paragraphs,
      closing: "Best regards,",
      notice,
      ...(brand.bookingUrl
        ? { action: { label: "Choose a time to talk", url: brand.bookingUrl } }
        : {}),
    }),
    ...(brand.contactEmail ? { replyTo: brand.contactEmail } : {}),
  };
}
