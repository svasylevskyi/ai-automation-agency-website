import { createHash } from "node:crypto";
import nodemailer from "nodemailer";
import { z } from "zod";
import type { env } from "./env";

type MailConfig = ReturnType<typeof env>;
export type OutgoingMail = {
  from: string;
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  messageId: string;
  headers?: Record<string, string>;
};
export type MailAcceptance = {
  provider: "smtp" | "resend";
  providerMessageId?: string;
};

// Only these locally generated codes may be logged or stored. Provider error
// bodies and transport errors can contain credentials or recipient details.
export class MailDeliveryError extends Error {
  constructor(public readonly code: string) {
    super("Email provider did not confirm acceptance.");
  }
}

export async function deliverMail(
  config: MailConfig,
  message: OutgoingMail,
): Promise<MailAcceptance> {
  if (config.MAIL_PROVIDER === "resend") {
    const body = JSON.stringify({
      from: message.from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      headers: { ...message.headers, "Message-ID": message.messageId },
    });
    // Same message + channel/enquiry Message-ID => same key across processes.
    // Resend retains keys for 24h. An intentional payload/config change gets a
    // new key instead of making recovery fail with a payload-conflict error.
    const key = `enquiry/${createHash("sha256").update(body).digest("hex")}`;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body,
        signal: AbortSignal.timeout(10000),
        redirect: "error",
        cache: "no-store",
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new MailDeliveryError(`resend_http_${response.status}`);
      }
      const parsed = z
        .object({ id: z.uuid() })
        .safeParse(await response.json());
      if (!parsed.success)
        throw new MailDeliveryError("resend_invalid_response");
      return { provider: "resend", providerMessageId: parsed.data.id };
    } catch (error) {
      if (error instanceof MailDeliveryError) throw error;
      throw new MailDeliveryError("resend_request_failed");
    }
  }

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
  try {
    const result = await transport.sendMail(message);
    if (!result.accepted?.length)
      throw new MailDeliveryError("smtp_not_accepted");
    return { provider: "smtp" };
  } catch (error) {
    if (error instanceof MailDeliveryError) throw error;
    throw new MailDeliveryError("smtp_request_failed");
  } finally {
    transport.close();
  }
}
