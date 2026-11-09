import { randomUUID, timingSafeEqual } from "node:crypto";
import type { PoolClient } from "pg";
import type { z } from "zod";
import { db, transaction } from "./db";
import { env } from "./env";
import { HttpError } from "./http";
import { recordActivity } from "./activity";
import {
  prospectCompletionSchema,
  replyDraftUpdateSchema,
  type ProspectJob,
  type ReplyReview,
} from "../lib/prospect";

export function prospectEnabled() {
  return env().PROSPECT_AUTOMATION_ENABLED === "true";
}
export function requireProspectWorker(request: Request) {
  if (!prospectEnabled())
    throw new HttpError(503, "Prospect automation is paused.");
  const expected = Buffer.from(`Bearer ${env().PROSPECT_AUTOMATION_TOKEN}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new HttpError(401, "Worker authentication required.");
}
export async function enqueueProspect(client: PoolClient, id: string) {
  if (!prospectEnabled()) return;
  await client.query(
    "INSERT INTO prospect_jobs (id,enquiry_id) VALUES ($1,$2) ON CONFLICT (enquiry_id) DO NOTHING",
    [randomUUID(), id],
  );
  await recordActivity(client, id, "prospect_queued");
}
export async function queueProspectForOwner(id: string, version: number) {
  if (!prospectEnabled())
    throw new HttpError(503, "Enable prospect automation on the server first.");
  return transaction(async (client) => {
    const enquiry = (
      await client.query(
        "SELECT status,version FROM enquiries WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!enquiry || enquiry.version !== version)
      throw new HttpError(
        409,
        "This enquiry changed or was deleted. Reload before trying again.",
      );
    if (enquiry.status === "closed")
      throw new HttpError(409, "Reopen this enquiry before preparing a brief.");
    const old = (
      await client.query(
        "SELECT *,lease_until < now() AS expired FROM prospect_jobs WHERE enquiry_id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (
      old &&
      !(
        old.status === "failed" ||
        old.status === "cancelled" ||
        (old.status === "running" && old.expired && old.attempts >= 5)
      )
    )
      throw new HttpError(
        409,
        "A brief is already queued or ready. Reload to see its state.",
      );
    if (old) {
      await client.query(
        "UPDATE prospect_jobs SET status='pending',attempts=0,claim_token=NULL,lease_until=NULL,result=NULL,completed_at=NULL,updated_at=now() WHERE id=$1",
        [old.id],
      );
      await recordActivity(client, id, "prospect_queued");
    } else await enqueueProspect(client, id);
    return { queued: true };
  });
}
export async function claimProspect() {
  return transaction(async (client) => {
    await client.query(
      "UPDATE prospect_jobs SET status='failed',updated_at=now() WHERE status='running' AND lease_until < now() AND attempts >= 5",
    );
    // All operations lock the parent enquiry first, then its job. Concurrent
    // workers skip locked parents; deletion/closure cannot race acceptance.
    const row = (
      await client.query(`SELECT e.id,e.company,e.area,e.team_size,e.message,e.assessment,j.id AS job_id
      FROM enquiries e JOIN prospect_jobs j ON j.enquiry_id=e.id
      WHERE e.status <> 'closed' AND j.attempts < 5
        AND (j.status='pending' OR (j.status='running' AND j.lease_until < now()))
      ORDER BY j.created_at,j.id LIMIT 1 FOR UPDATE OF e SKIP LOCKED`)
    ).rows[0];
    if (!row) return null;
    const token = randomUUID();
    const claimed = await client.query(
      `UPDATE prospect_jobs SET status='running',attempts=attempts+1,claim_token=$2,
       lease_until=clock_timestamp()+interval '10 minutes',updated_at=now()
       WHERE id=$1 AND attempts < 5
         AND (status='pending' OR (status='running' AND lease_until < clock_timestamp()))
       RETURNING id`,
      [row.job_id, token],
    );
    // Recheck the job under its update lock: the SELECT's snapshot may have
    // preceded another worker committing a lease without modifying the parent.
    if (!claimed.rowCount) return null;
    // Contact email, name, private notes and mail payloads are deliberately omitted.
    return {
      jobId: row.job_id,
      claimToken: token,
      enquiry: {
        company: row.company,
        area: row.area,
        teamSize: row.team_size,
        message: row.message,
        assessment: row.assessment,
      },
    };
  });
}
export async function completeProspect(
  input: z.infer<typeof prospectCompletionSchema>,
) {
  return transaction(async (client) => {
    const enquiry = (
      await client.query(
        `SELECT e.id,e.status FROM enquiries e
      JOIN prospect_jobs j ON j.enquiry_id=e.id WHERE j.id=$1 FOR UPDATE OF e`,
        [input.jobId],
      )
    ).rows[0];
    if (!enquiry) throw new HttpError(410, "This enquiry no longer exists.");
    if (enquiry.status === "closed")
      throw new HttpError(409, "This enquiry is closed.");
    const job = (
      await client.query(
        "SELECT *,lease_until > clock_timestamp() AS valid_lease FROM prospect_jobs WHERE id=$1 FOR UPDATE",
        [input.jobId],
      )
    ).rows[0];
    if (job.claim_token !== input.claimToken)
      throw new HttpError(409, "This processing attempt has been superseded.");
    // A lost HTTP response can be retried safely without another result/activity.
    if (job.status === "completed") return { accepted: true };
    if (job.status !== "running" || !job.valid_lease)
      throw new HttpError(409, "This processing lease has expired.");
    await client.query(
      "UPDATE prospect_jobs SET status='completed',result=$2,completed_at=now(),updated_at=now(),lease_until=NULL WHERE id=$1",
      [input.jobId, JSON.stringify(input.result)],
    );
    await recordActivity(client, enquiry.id, "prospect_prepared");
    return { accepted: true };
  });
}
export async function getProspectJob(id: string): Promise<ProspectJob | null> {
  const row = (
    await db().query(
      "SELECT *,lease_until < now() AS expired FROM prospect_jobs WHERE enquiry_id=$1",
      [id],
    )
  ).rows[0];
  if (!row) return null;
  return {
    status:
      row.status === "running" && row.expired
        ? row.attempts >= 5
          ? "failed"
          : "pending"
        : row.status,
    attempts: row.attempts,
    createdAt: row.created_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
    result: row.result,
    review: {
      text: row.reply_text,
      ready: row.reply_ready,
      version: row.reply_version,
    },
  };
}

export async function saveReplyDraft(
  id: string,
  input: z.infer<typeof replyDraftUpdateSchema>,
): Promise<ReplyReview> {
  return transaction(async (client) => {
    // Match the enquiry-then-job lock order used by preparation and deletion.
    const parent = await client.query(
      "SELECT id FROM enquiries WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!parent.rowCount)
      throw new HttpError(404, "Enquiry no longer available.");
    const job = (
      await client.query(
        `SELECT result->>'replyDraft' AS original, reply_text, reply_ready, reply_version
       FROM prospect_jobs WHERE enquiry_id=$1 AND status='completed' FOR UPDATE`,
        [id],
      )
    ).rows[0];
    if (!job?.original)
      throw new HttpError(409, "A prepared reply is required before saving.");
    // A retry after a lost response can acknowledge the already-saved state.
    if (
      (job.reply_text ?? job.original) === input.text &&
      job.reply_ready === input.ready
    )
      return {
        text: job.reply_text,
        ready: job.reply_ready,
        version: job.reply_version,
      };
    if (job.reply_version !== input.version)
      throw new HttpError(
        409,
        "The saved reply changed. Copy your edits, then reload to review the latest version.",
      );

    const result = await client.query(
      `UPDATE prospect_jobs SET reply_text=$2, reply_ready=$3, reply_version=reply_version+1
       WHERE enquiry_id=$1 RETURNING reply_text AS text, reply_ready AS ready, reply_version AS version`,
      [id, input.text, input.ready],
    );
    // Count edits as owner activity for retention, independently of follow-up edits.
    await client.query("UPDATE enquiries SET updated_at=now() WHERE id=$1", [
      id,
    ]);
    await recordActivity(
      client,
      id,
      input.ready ? "reply_draft_ready" : "reply_draft_saved",
    );
    return result.rows[0];
  });
}
