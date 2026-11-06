import { db } from "../src/server/db";
import {
  processEnquiryMail,
  expireExhaustedMailClaims,
} from "../src/server/mail";
try {
  await db().query("DELETE FROM request_limits WHERE expires_at < now()");
  await db().query('DELETE FROM session WHERE "expiresAt" < now()');
  await expireExhaustedMailClaims();
  const { rows } = await db().query(
    `SELECT id FROM enquiries WHERE
      (notification_attempts < 5 AND (notification_status='pending' OR (notification_status IN ('failed','sending') AND notification_attempted_at < now()-interval '5 minutes')))
      OR (confirmation_attempts < 5 AND (confirmation_status='pending' OR (confirmation_status IN ('failed','sending') AND confirmation_attempted_at < now()-interval '5 minutes')))
      ORDER BY created_at LIMIT 100`,
  );
  for (const row of rows) await processEnquiryMail(row.id);
  console.log(
    `Processed email recovery for ${rows.length} enquiries and removed expired limits/sessions.`,
  );
} finally {
  await db().end();
}
