import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { transaction } from "./db";
import { env } from "./env";
import { recordActivity } from "./activity";
import { confirmationPayloadSchema } from "../lib/confirmation";

type Channel = "notification" | "confirmation";
// These identifiers come only from this internal union, never from request input.
async function sendEnquiryMail(id: string, channel: Channel, manual = false) {
  const claimId = randomUUID();
  const claim = await transaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE enquiries SET ${channel}_status='sending', ${channel}_attempts=${channel}_attempts+1,
       ${channel}_attempted_at=now(), ${channel}_claim=$2
       WHERE id=$1 AND (${channel}_attempts < 5 OR $3)
       AND (${channel}_status='pending'
         OR (${channel}_status='failed' AND ($4 OR ${channel}_attempted_at < now()-interval '5 minutes'))
         OR (${channel}_status='sending' AND ${channel}_attempted_at < now()-interval '5 minutes'))
       RETURNING email,confirmation_payload,${channel}_attempts AS attempts`,
      [id, claimId, manual && channel === "notification", manual],
    );
    if (!rows.length) return null;
    await recordActivity(client, id, "mail_attempted", {
      channel,
      attempt: rows[0].attempts,
    });
    return rows[0];
  });
  if (!claim) return;
  const config = env();
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE === "true",
    auth: config.SMTP_USER
      ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD ?? "" }
      : undefined,
    requireTLS:
      !["127.0.0.1", "localhost", "::1"].includes(config.SMTP_HOST) &&
      config.SMTP_SECURE !== "true",
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  let sent = false;
  try {
    const message =
      channel === "confirmation"
        ? {
            ...confirmationPayloadSchema.parse(claim.confirmation_payload),
            to: claim.email,
          }
        : {
            to: config.NOTIFICATION_EMAIL,
            subject: "New website enquiry",
            text: `A new enquiry is saved in your owner inbox.\n\nOpen it securely: ${config.APP_URL}/admin/enquiries/${id}\n\nThis notification does not include the visitor's message or contact details.`,
          };
    const result = await transport.sendMail({
      ...message,
      from: config.SMTP_FROM,
      messageId: `<enquiry-${channel}-${id}@${new URL(config.APP_URL).hostname}>`,
      ...(channel === "confirmation"
        ? {
            headers: {
              "Auto-Submitted": "auto-generated",
              "X-Auto-Response-Suppress": "All",
            },
          }
        : {}),
    });
    sent = !!result.accepted?.length;
  } catch {
    // Never log the recipient, private enquiry or raw SMTP error.
  } finally {
    transport.close();
  }
  if (!sent)
    console.error(
      "Enquiry email attempt failed; the saved enquiry remains available.",
    );
  // A lost database update after SMTP acceptance leaves a stale claim for recovery.
  // The stable Message-ID helps identification but cannot guarantee exactly-once email.
  await transaction(async (client) => {
    const completed = await client.query(
      `UPDATE enquiries SET ${channel}_status=$3, ${channel}_claim=NULL,
       ${channel === "notification" ? "notified_at" : "confirmed_at"}=CASE WHEN $3='sent' THEN now() ELSE NULL END
       WHERE id=$1 AND ${channel}_claim=$2 RETURNING id`,
      [id, claimId, sent ? "sent" : "failed"],
    );
    if (completed.rowCount)
      await recordActivity(client, id, sent ? "mail_sent" : "mail_failed", {
        channel,
        attempt: claim.attempts,
      });
  });
}
export const sendNotification = (id: string, manual = false) =>
  sendEnquiryMail(id, "notification", manual);
export const sendConfirmation = (id: string, manual = false) =>
  sendEnquiryMail(id, "confirmation", manual);
export async function processEnquiryMail(id: string) {
  const results = await Promise.allSettled([
    sendNotification(id),
    sendConfirmation(id),
  ]);
  if (results.some((result) => result.status === "rejected"))
    console.error(
      "Email processing interrupted; maintenance can recover saved pending messages.",
    );
}

export async function expireExhaustedMailClaims() {
  for (const channel of ["notification", "confirmation"] as const) {
    await transaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE enquiries SET ${channel}_status='failed',${channel}_claim=NULL
         WHERE ${channel}_status='sending' AND ${channel}_attempts>=5
         AND ${channel}_attempted_at < now()-interval '5 minutes'
         RETURNING id,${channel}_attempts AS attempts`,
      );
      for (const row of rows)
        await recordActivity(client, row.id, "mail_failed", {
          channel,
          attempt: row.attempts,
          interrupted: true,
        });
    });
  }
}
