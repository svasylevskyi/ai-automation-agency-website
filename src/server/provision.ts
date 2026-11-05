import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { transaction } from "./db";

export async function provisionOwner(
  email: string,
  password: string,
  reset = false,
) {
  email = z.email().parse(email.trim().toLowerCase());
  z.string().min(12).max(128).parse(password);
  const hash = await hashPassword(password);
  await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(8192027)");
    const existing = await client.query(
      'SELECT user_id, email FROM site_owner JOIN "user" ON "user".id = site_owner.user_id',
    );
    if (existing.rowCount) {
      if (!reset || existing.rows[0].email !== email)
        throw new Error(
          "An owner already exists. To reset their password, use --reset-password and the same email.",
        );
      await client.query(
        'UPDATE account SET password=$1, "updatedAt"=now() WHERE "userId"=$2 AND "providerId"=\'credential\'',
        [hash, existing.rows[0].user_id],
      );
      await client.query('DELETE FROM session WHERE "userId"=$1', [
        existing.rows[0].user_id,
      ]);
      return;
    }
    if (reset)
      throw new Error("No owner exists. Run without --reset-password first.");
    const id = randomUUID();
    await client.query(
      'INSERT INTO "user" (id,name,email,"emailVerified","createdAt","updatedAt") VALUES ($1,\'Website owner\',$2,true,now(),now())',
      [id, email],
    );
    await client.query(
      'INSERT INTO account (id,"accountId","providerId","userId",password,"createdAt","updatedAt") VALUES ($1,$2,\'credential\',$2,$3,now(),now())',
      [randomUUID(), id, hash],
    );
    await client.query("INSERT INTO site_owner (user_id) VALUES ($1)", [id]);
  });
}
