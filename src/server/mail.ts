import nodemailer from "nodemailer";
import { db } from "./db";
import { env } from "./env";

export async function sendNotification(id: string) {
  const claim = await db().query(
    `UPDATE enquiries SET notification_status = 'sending', notification_attempts = notification_attempts + 1, notification_attempted_at = now()
    WHERE id = $1 AND (notification_status IN ('pending','failed') OR (notification_status = 'sending' AND notification_attempted_at < now() - interval '5 minutes')) RETURNING id`,
    [id],
  );
  if (!claim.rowCount) return;
  const config = env();
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE === "true",
    auth: config.SMTP_USER
      ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD ?? "" }
      : undefined,
    // Require encrypted delivery off loopback; local Mailpit is deliberately plain SMTP.
    requireTLS:
      !["127.0.0.1", "localhost", "::1"].includes(config.SMTP_HOST) &&
      config.SMTP_SECURE !== "true",
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  try {
    const result = await transport.sendMail({
      from: config.SMTP_FROM,
      to: config.NOTIFICATION_EMAIL,
      subject: "New website enquiry",
      messageId: `<enquiry-${id}@${new URL(config.APP_URL).hostname}>`,
      text: `A new enquiry is saved in your owner inbox.\n\nOpen it securely: ${config.APP_URL}/admin/enquiries/${id}\n\nThis notification does not include the visitor's message or contact details.`,
    });
    if (!result.accepted?.length)
      throw new Error("SMTP recipient was not accepted");
    await db().query(
      "UPDATE enquiries SET notification_status = 'sent', notified_at = now() WHERE id = $1",
      [id],
    );
  } catch {
    await db().query(
      "UPDATE enquiries SET notification_status = 'failed' WHERE id = $1",
      [id],
    );
    console.error(
      "Enquiry notification failed; retry is available in the owner inbox.",
    );
  } finally {
    transport.close();
  }
}
