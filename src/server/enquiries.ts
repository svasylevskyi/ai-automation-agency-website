import type { z } from "zod";
import type { PoolClient } from "pg";
import type { enquiryUpdateSchema, inboxStatusSchema } from "../lib/validation";
import { transaction } from "./db";
import { HttpError } from "./http";
import { recordActivity } from "./activity";

const conflict = () =>
  new HttpError(
    409,
    "This enquiry changed or was deleted. Copy your edits, then reload before trying again.",
  );
type EnquiryUpdate = z.infer<typeof enquiryUpdateSchema>;
type InboxStatusUpdate = z.infer<typeof inboxStatusSchema>;
type LockedEnquiry = {
  id: string;
  version: number;
  status: EnquiryUpdate["status"];
  notes: string;
  next_action: string;
  due_date: string | null;
};

async function lockEnquiries(client: PoolClient, ids: string[]) {
  // Acquire overlapping inbox selections in a consistent order.
  const { rows } = await client.query<LockedEnquiry>(
    `SELECT id,version,status,notes,next_action,follow_up_on::text AS due_date
     FROM enquiries WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
    [ids],
  );
  return rows;
}

async function saveLockedEnquiry(
  client: PoolClient,
  old: LockedEnquiry,
  input: Omit<EnquiryUpdate, "version">,
) {
  const { id } = old;
  const changedFollowUp =
    old.next_action !== input.nextAction || old.due_date !== input.followUpDate;
  if (
    old.status === input.status &&
    old.notes === input.notes &&
    !changedFollowUp
  )
    return { version: old.version };
  const updated = await client.query(
    "UPDATE enquiries SET status=$2,notes=$3,next_action=$4,follow_up_on=$5,version=version+1,updated_at=now() WHERE id=$1 RETURNING version",
    [id, input.status, input.notes, input.nextAction, input.followUpDate],
  );
  if (input.status === "closed")
    await client.query(
      "UPDATE prospect_jobs SET status='cancelled',claim_token=NULL,lease_until=NULL,updated_at=now() WHERE enquiry_id=$1 AND status IN ('pending','running','failed')",
      [id],
    );
  if (old.status !== input.status)
    await recordActivity(client, id, "status_changed", {
      from: old.status,
      to: input.status,
    });
  if (old.notes !== input.notes)
    await recordActivity(client, id, "notes_updated");
  if (changedFollowUp) {
    const before = { action: old.next_action, date: old.due_date };
    const after = { action: input.nextAction, date: input.followUpDate };
    await recordActivity(
      client,
      id,
      !input.nextAction
        ? "follow_up_cleared"
        : old.next_action
          ? "follow_up_changed"
          : "follow_up_scheduled",
      { before, after },
    );
  }
  return { version: updated.rows[0].version };
}

export async function updateEnquiry(id: string, input: EnquiryUpdate) {
  return transaction(async (client) => {
    const [old] = await lockEnquiries(client, [id]);
    if (!old || old.version !== input.version) throw conflict();
    return saveLockedEnquiry(client, old, input);
  });
}

export async function updateInboxStatuses({
  status,
  enquiries,
}: InboxStatusUpdate) {
  return transaction(async (client) => {
    const versions = new Map(enquiries.map(({ id, version }) => [id, version]));
    const rows = await lockEnquiries(client, [...versions.keys()]);
    if (
      rows.length !== versions.size ||
      rows.some((row) => row.version !== versions.get(row.id))
    )
      throw new HttpError(
        409,
        "A selected enquiry changed or was deleted. Reload the inbox and review your selection.",
      );

    const changed = rows.filter((row) => row.status !== status);
    for (const row of changed) {
      await saveLockedEnquiry(client, row, {
        status,
        notes: row.notes,
        nextAction: status === "closed" ? "" : row.next_action,
        followUpDate: status === "closed" ? null : row.due_date,
      });
    }
    return { updated: changed.length, unchanged: rows.length - changed.length };
  });
}
export async function completeFollowUp(id: string, version: number) {
  return transaction(async (client) => {
    const { rows } = await client.query(
      "SELECT version,status,next_action,follow_up_on::text AS due_date FROM enquiries WHERE id=$1 FOR UPDATE",
      [id],
    );
    const old = rows[0];
    if (!old || old.version !== version) throw conflict();
    if (!old.next_action || old.status === "closed")
      throw new HttpError(400, "There is no saved follow-up to complete.");
    const updated = await client.query(
      "UPDATE enquiries SET next_action='',follow_up_on=NULL,version=version+1,updated_at=now() WHERE id=$1 RETURNING version",
      [id],
    );
    await recordActivity(client, id, "follow_up_completed", {
      action: old.next_action,
      date: old.due_date,
    });
    return { version: updated.rows[0].version };
  });
}
