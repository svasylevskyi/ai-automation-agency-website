import { verifyPassword } from "better-auth/crypto";
import { transaction } from "./db";
import { HttpError } from "./http";

export async function changeOwnerEmail(input: {
  userId: string;
  sessionId: string;
  currentEmail: string;
  newEmail: string;
  currentPassword: string;
}) {
  try {
    await transaction(async (client) => {
      // Share the provisioning lock with terminal-based owner recovery.
      await client.query("SELECT pg_advisory_xact_lock(8192027)");
      const { rows } = await client.query<{ email: string; password: string }>(
        `SELECT u.email, a.password FROM site_owner o
         JOIN "user" u ON u.id = o.user_id
         JOIN account a ON a."userId" = u.id AND a."providerId" = 'credential'
         WHERE o.singleton = true AND u.id = $1
         FOR UPDATE OF u, a`,
        [input.userId],
      );
      const activeSession = await client.query(
        `SELECT id FROM session
         WHERE id = $1 AND "userId" = $2 AND "expiresAt" > now()`,
        [input.sessionId, input.userId],
      );
      // Recheck after acquiring the lock: a concurrent change may have signed
      // out this request while it was waiting.
      if (!rows[0] || activeSession.rowCount !== 1)
        throw new HttpError(401, "Please sign in again.");
      if (rows[0].email.toLowerCase() !== input.currentEmail)
        throw new HttpError(
          409,
          "Your account email has changed. Refresh this page and try again.",
        );
      if (
        !rows[0].password ||
        !(await verifyPassword({
          hash: rows[0].password,
          password: input.currentPassword,
        }))
      )
        throw new HttpError(400, "Your current password is incorrect.");
      const existing = await client.query(
        'SELECT id FROM "user" WHERE lower(email) = $1 AND id <> $2',
        [input.newEmail, input.userId],
      );
      if (existing.rowCount)
        throw new HttpError(409, "This email address is already in use.");
      // This is a password-authorised change of the login identifier, not
      // proof of mailbox ownership. Password sign-in does not require verification.
      await client.query(
        `UPDATE "user" SET email = $1, "emailVerified" = false, "updatedAt" = now()
         WHERE id = $2`,
        [input.newEmail, input.userId],
      );
      // Keep the owner/user IDs and all associated work; revoke every session
      // in the same transaction so a partial change cannot leave sessions active.
      await client.query('DELETE FROM session WHERE "userId" = $1', [
        input.userId,
      ]);
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "23505")
      throw new HttpError(409, "This email address is already in use.");
    throw error;
  }
}
