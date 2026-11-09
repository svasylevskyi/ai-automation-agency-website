import type { z } from "zod";
import { enquiryUpdateSchema } from "../lib/validation";
import { transaction } from "./db";
import { HttpError } from "./http";
import { recordActivity } from "./activity";

const conflict = () =>
  new HttpError(
    409,
    "This enquiry changed or was deleted. Copy your edits, then reload before trying again.",
  );
export async function updateEnquiry(
  id: string,
  input: z.infer<typeof enquiryUpdateSchema>,
) {
  return transaction(async (client) => {
    const { rows } = await client.query(
      "SELECT *,follow_up_on::text AS due_date FROM enquiries WHERE id=$1 FOR UPDATE",
      [id],
    );
    const old = rows[0];
    if (!old || old.version !== input.version) throw conflict();
    const changedFollowUp =
      old.next_action !== input.nextAction ||
      old.due_date !== input.followUpDate;
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
