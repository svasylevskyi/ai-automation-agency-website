import { emailTemplate, type EmailBrand } from "./email-template";

export function notificationMessage(
  brand: EmailBrand,
  appUrl: string,
  id: string,
) {
  const url = new URL(`/admin/enquiries/${encodeURIComponent(id)}`, appUrl)
    .href;
  const text = "A new enquiry is saved in your owner inbox.";
  const notice =
    "This notification does not include the visitor's message or contact details.";
  return {
    subject: "New website enquiry",
    text: `${text}\n\nOpen it securely: ${url}\n\nBest regards,\n${brand.name}\n${new URL(appUrl).origin}\n\n${notice}`,
    html: emailTemplate({
      brand,
      appUrl,
      eyebrow: "New website enquiry",
      title: "Ready for your review.",
      preview: text,
      paragraphs: [
        text,
        "Open the enquiry to review the details and decide on the next step.",
      ],
      action: { label: "Review the enquiry", url },
      closing: "Best regards,",
      notice,
    }),
  };
}
