import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, transaction } from "./db";
import { env } from "./env";
import { getBrand } from "./settings";
import { HttpError } from "./http";
import { recordActivity } from "./activity";
import { saveLockedEnquiry } from "./enquiries";
import {
  deliverMail,
  MailDeliveryError,
  type MailAcceptance,
} from "./mail-delivery";
import {
  replyMessage,
  type ReplyDelivery,
  type ReplyPreviewInput,
} from "../lib/reply-delivery";
import { warsawToday } from "../lib/follow-up";

const selection = `SELECT *,
  status IN ('sending','unconfirmed') AND provider='resend' AND attempts < 5
    AND first_attempt_at > now()-interval '23 hours'
    AND (status <> 'sending' OR attempted_at < now()-interval '5 minutes') AS retry_allowed
  FROM reply_deliveries WHERE enquiry_id=$1`;

export async function getReplyDelivery(
  id: string,
): Promise<ReplyDelivery | null> {
  const row = (await db().query(selection, [id])).rows[0];
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    reviewVersion: row.review_version,
    enquiryVersion: row.enquiry_version,
    from: row.payload.from,
    to: row.payload.to,
    replyTo: row.payload.replyTo,
    subject: row.payload.subject,
    text: row.payload.text,
    html: row.payload.html,
    provider: row.provider,
    providerMessageId: row.provider_message_id,
    attempts: row.attempts,
    acceptedAt: row.accepted_at?.toISOString() ?? null,
    updatedAt: row.updated_at.toISOString(),
    retryAllowed: row.retry_allowed,
    followUp: row.follow_up,
    followUpOutcome: row.follow_up_outcome,
  };
}

export async function previewReply(id: string, input: ReplyPreviewInput) {
  const config = env();
  const brand = await getBrand();
  if (!z.email().safeParse(brand.contactEmail).success)
    throw new HttpError(
      409,
      "Set your working public business email in Settings before replying.",
    );
  if (input.followUp && input.followUp.date < warsawToday())
    throw new HttpError(400, "Choose today or a future follow-up date.");
  await transaction(async (client) => {
    const parent = (
      await client.query("SELECT * FROM enquiries WHERE id=$1 FOR UPDATE", [id])
    ).rows[0];
    if (!parent) throw new HttpError(404, "Enquiry no longer available.");
    if (parent.status === "closed" || parent.version !== input.enquiryVersion)
      throw new HttpError(
        409,
        "This enquiry changed or is closed. Reload and review it before replying.",
      );
    const job = (
      await client.query(
        "SELECT * FROM prospect_jobs WHERE enquiry_id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (
      !job ||
      job.status !== "completed" ||
      !job.reply_ready ||
      !job.reply_text ||
      job.reply_version !== input.reviewVersion
    )
      throw new HttpError(
        409,
        "Save and mark the current reply ready before previewing.",
      );
    if (
      /\[(your name|recipient name|customer name|company name)\]/i.test(
        job.reply_text,
      )
    )
      throw new HttpError(
        400,
        "Replace the name placeholders in the reply before sending.",
      );
    const deliveryId = randomUUID();
    const payload = {
      ...replyMessage(brand, config.APP_URL, input.subject, job.reply_text),
      from: config.MAIL_FROM,
      to: z.email().parse(parent.email),
      messageId: `<reply-${deliveryId}@${new URL(config.APP_URL).hostname}>`,
    };
    const saved = await client.query(
      `INSERT INTO reply_deliveries(id,enquiry_id,review_version,enquiry_version,provider,payload,follow_up,follow_up_outcome)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT(enquiry_id) DO UPDATE SET id=EXCLUDED.id,review_version=EXCLUDED.review_version,
         enquiry_version=EXCLUDED.enquiry_version,provider=EXCLUDED.provider,payload=EXCLUDED.payload,
         follow_up=EXCLUDED.follow_up,follow_up_outcome=EXCLUDED.follow_up_outcome,created_at=now(),updated_at=now()
       WHERE reply_deliveries.status='preview' RETURNING id`,
      [
        deliveryId,
        id,
        job.reply_version,
        parent.version,
        config.MAIL_PROVIDER,
        JSON.stringify(payload),
        input.followUp ? JSON.stringify(input.followUp) : null,
        input.followUp ? "pending" : "none",
      ],
    );
    if (!saved.rowCount)
      throw new HttpError(
        409,
        "A first reply has already been approved. Reload to see its delivery record.",
      );
  });
  return getReplyDelivery(id);
}

export async function sendReply(id: string, deliveryId: string) {
  const config = env();
  const claim = randomUUID();
  const claimed = await transaction(async (client) => {
    const parent = (
      await client.query("SELECT * FROM enquiries WHERE id=$1 FOR UPDATE", [id])
    ).rows[0];
    if (!parent) throw new HttpError(404, "Enquiry no longer available.");
    const row = (await client.query(selection + " FOR UPDATE", [id])).rows[0];
    if (!row || row.id !== deliveryId)
      throw new HttpError(
        409,
        "This preview was replaced. Preview the current reply again.",
      );
    if (row.status === "accepted") return false;
    // A double click or lost response observes the active claim instead of sending again.
    if (row.status === "sending" && !row.retry_allowed) return false;
    if (parent.status === "closed")
      throw new HttpError(409, "Reopen this enquiry before sending a reply.");
    if (row.provider !== config.MAIL_PROVIDER)
      throw new HttpError(
        409,
        "The mail provider changed. Restore the original provider before retrying, or preview again if not yet approved.",
      );
    if (row.status === "preview") {
      const job = (
        await client.query(
          "SELECT * FROM prospect_jobs WHERE enquiry_id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (
        !job?.reply_ready ||
        job.reply_version !== row.review_version ||
        parent.version !== row.enquiry_version ||
        row.created_at.getTime() < Date.now() - 15 * 60000 ||
        row.payload.from !== config.MAIL_FROM
      )
        throw new HttpError(
          409,
          "This preview expired or the enquiry, reply or sender changed. Preview again before sending.",
        );
      if (row.follow_up && row.follow_up.date < warsawToday())
        throw new HttpError(
          409,
          "The follow-up date has passed. Preview again with a current date.",
        );
      await recordActivity(client, id, "reply_send_approved");
    } else if (!row.retry_allowed) {
      throw new HttpError(
        409,
        "Safe retries are unavailable. Check the provider's delivery log before replying manually; the previous attempt may have sent.",
      );
    }
    await client.query(
      `UPDATE reply_deliveries SET status='sending',claim=$2,attempts=attempts+1,
      approved_at=COALESCE(approved_at,now()),first_attempt_at=COALESCE(first_attempt_at,now()),
      attempted_at=now(),updated_at=now(),failure_code=NULL WHERE id=$1`,
      [deliveryId, claim],
    );
    await client.query("UPDATE enquiries SET updated_at=now() WHERE id=$1", [
      id,
    ]);
    await recordActivity(client, id, "mail_attempted", {
      channel: "reply",
      attempt: row.attempts + 1,
    });
    return true;
  });
  if (!claimed) return getReplyDelivery(id);

  // The approval/claim is committed before I/O. Hold the parent lock during the
  // bounded provider call: deletion/closure cannot slip between send and recording.
  // A crash leaves a durable claim; only an explicit safe retry can recover it.
  await transaction(async (client) => {
    const parent = (
      await client.query(
        "SELECT *,follow_up_on::text AS due_date FROM enquiries WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!parent) return; // Deleted between approval and I/O: do not send.
    const row = (
      await client.query(
        "SELECT * FROM reply_deliveries WHERE id=$1 AND claim=$2 FOR UPDATE",
        [deliveryId, claim],
      )
    ).rows[0];
    if (!row) return;
    let accepted: MailAcceptance | undefined;
    let failureCode: string | undefined;
    if (parent.status === "closed") failureCode = "enquiry_closed_before_send";
    else {
      try {
        accepted = await deliverMail(config, row.payload);
      } catch (error) {
        failureCode =
          error instanceof MailDeliveryError
            ? error.code
            : "reply_send_unconfirmed";
      }
    }
    let followUpOutcome = row.follow_up ? "not_applied" : "none";
    if (accepted) {
      if (parent.version === row.enquiry_version) {
        const applyFollowUp =
          row.follow_up && row.follow_up.date >= warsawToday();
        await saveLockedEnquiry(client, parent, {
          status: parent.status === "new" ? "contacted" : parent.status,
          notes: parent.notes,
          nextAction: applyFollowUp ? row.follow_up.action : parent.next_action,
          followUpDate: applyFollowUp ? row.follow_up.date : parent.due_date,
        });
        if (applyFollowUp) followUpOutcome = "applied";
      }
      if (followUpOutcome === "not_applied")
        await recordActivity(client, id, "reply_follow_up_skipped");
      await recordActivity(client, id, "mail_sent", {
        channel: "reply",
        attempt: row.attempts,
        provider: row.provider,
        ...(accepted.providerMessageId
          ? { providerMessageId: accepted.providerMessageId }
          : {}),
      });
    } else {
      followUpOutcome = row.follow_up ? "pending" : "none";
      await recordActivity(client, id, "reply_unconfirmed", {
        attempt: row.attempts,
        failureCode,
      });
    }
    await client.query(
      `UPDATE reply_deliveries SET status=$2,claim=NULL,accepted_at=CASE WHEN $2='accepted' THEN now() ELSE NULL END,
      provider_message_id=$3,failure_code=$4,follow_up_outcome=$5,updated_at=now() WHERE id=$1`,
      [
        deliveryId,
        accepted ? "accepted" : "unconfirmed",
        accepted?.providerMessageId ?? null,
        failureCode ?? null,
        followUpOutcome,
      ],
    );
    await client.query("UPDATE enquiries SET updated_at=now() WHERE id=$1", [
      id,
    ]);
  });
  return getReplyDelivery(id);
}
