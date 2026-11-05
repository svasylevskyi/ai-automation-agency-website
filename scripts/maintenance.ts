import { db } from "../src/server/db";
import { sendNotification } from "../src/server/mail";
try {
  await db().query("DELETE FROM request_limits WHERE expires_at < now()");
  await db().query('DELETE FROM session WHERE "expiresAt" < now()');
  const { rows } = await db().query(
    "SELECT id FROM enquiries WHERE notification_status IN ('pending','failed') OR (notification_status='sending' AND notification_attempted_at < now()-interval '5 minutes') ORDER BY created_at LIMIT 100",
  );
  for (const row of rows) await sendNotification(row.id);
  console.log(
    `Processed ${rows.length} notification retries and removed expired limits/sessions.`,
  );
} finally {
  await db().end();
}
