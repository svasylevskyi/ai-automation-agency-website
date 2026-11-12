import { db } from "../src/server/db";
import { env } from "../src/server/env";
import { getSettings } from "../src/server/settings";

// Read-only preflight: no email, provider request, credentials or enquiry content.
try {
  const config = env();
  const { settings } = await getSettings();
  console.log(`Mail provider: ${config.MAIL_PROVIDER}`);
  console.log(`Sender: ${config.MAIL_FROM}`);
  console.log(`Owner notification inbox: ${config.NOTIFICATION_EMAIL}`);
  console.log(
    `Reply-To for new receipts: ${settings.contactEmail || "NOT CONFIGURED"}`,
  );
  if (!settings.contactEmail) {
    console.error(
      "Set Public email in Owner area > Settings before going live.",
    );
    process.exitCode = 1;
  }
  const { rows } = await db().query(`
    SELECT 'notification' AS channel, notification_status AS status, count(*)::int AS count
    FROM enquiries WHERE notification_status IN ('pending','failed','sending') GROUP BY notification_status
    UNION ALL
    SELECT 'confirmation', confirmation_status, count(*)::int
    FROM enquiries WHERE confirmation_status IN ('pending','failed','sending') GROUP BY confirmation_status
    ORDER BY channel,status
  `);
  if (rows.length) {
    console.table(rows);
    console.log(
      "Review these existing messages in the owner inbox before switching providers. Maintenance can retry eligible old messages using the new provider.",
    );
  } else {
    console.log("No pending, failed or in-progress mail in the enquiry inbox.");
  }
  console.log(
    "Local configuration checked only. Verify DNS/key permissions in Resend, then submit a fresh enquiry using an address you control to test delivery and replies.",
  );
} catch {
  console.error(
    "Mail preflight failed. Check the server environment and database connection; see docs/email-setup.md. No mail was sent.",
  );
  process.exitCode = 1;
} finally {
  // Avoid initializing the connection pool after configuration validation failed.
  try {
    await db().end();
  } catch {
    /* No active pool to close. */
  }
}
