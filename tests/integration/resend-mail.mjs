import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { confirmationMessage } from "../../src/lib/confirmation.ts";
import { processEnquiryMail, sendConfirmation } from "../../src/server/mail.ts";

export async function checkResendMail({ db }) {
  const id = randomUUID();
  const originalFetch = globalThis.fetch;
  const overrides = {
    MAIL_PROVIDER: "resend",
    RESEND_API_KEY: "re_test_only_never_a_real_key",
    MAIL_FROM: "website@mail.get-automated.ai",
    NOTIFICATION_EMAIL: "hello@get-automated.ai",
  };
  const originalEnv = Object.fromEntries(
    Object.keys(overrides).map((key) => [key, process.env[key]]),
  );
  const sentId = randomUUID();
  const requests = [];
  let rejectReceipt = true;
  let checks = 0;
  try {
    await db().query(
      `INSERT INTO enquiries(id,submission_id,name,email,area,team_size,message,privacy_notice_version,confirmation_status,confirmation_payload)
       VALUES($1,$2,'PRIVATE NAME','resend-visitor@example.test','sales','small','PRIVATE MESSAGE','enquiry-v4','pending',$3)`,
      [
        id,
        randomUUID(),
        JSON.stringify(
          confirmationMessage({
            name: "Get Automated",
            contactEmail: "hello@get-automated.ai",
            bookingUrl: "",
          }),
        ),
      ],
    );
    Object.assign(process.env, overrides);
    // Intercept every request, never contact Resend or a real mailbox in CI.
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "https://api.resend.com/emails");
      const payload = JSON.parse(options.body);
      requests.push({ payload, key: options.headers["Idempotency-Key"] });
      if (rejectReceipt && payload.to[0] === "resend-visitor@example.test")
        return Response.json(
          { message: "PRIVATE PROVIDER ERROR" },
          { status: 429 },
        );
      return Response.json({ id: sentId });
    };
    await Promise.all([processEnquiryMail(id), processEnquiryMail(id)]);
    let row = (await db().query("SELECT * FROM enquiries WHERE id=$1", [id]))
      .rows[0];
    assert.equal(requests.length, 2);
    assert.equal(row.notification_status, "sent");
    assert.equal(row.confirmation_status, "failed");
    assert.equal(row.notification_attempts, 1);
    assert.equal(row.confirmation_attempts, 1);
    assert.equal(row.message, "PRIVATE MESSAGE");
    const receipt = requests.find(({ payload }) => payload.to[0] === row.email);
    assert.equal(receipt.payload.reply_to, "hello@get-automated.ai");
    assert.equal(receipt.payload.headers["Auto-Submitted"], "auto-generated");
    assert.doesNotMatch(
      JSON.stringify(requests),
      /PRIVATE NAME|PRIVATE MESSAGE/,
    );
    checks += 9;

    // Backoff prevents immediate retries; an aged failed attempt becomes eligible.
    await processEnquiryMail(id);
    assert.equal(requests.length, 2);
    rejectReceipt = false;
    await db().query(
      "UPDATE enquiries SET confirmation_attempted_at=now()-interval '6 minutes' WHERE id=$1",
      [id],
    );
    await processEnquiryMail(id);
    row = (await db().query("SELECT * FROM enquiries WHERE id=$1", [id]))
      .rows[0];
    assert.equal(row.confirmation_status, "sent");
    assert.equal(row.confirmation_attempts, 2);
    assert.equal(requests.length, 3);
    assert.equal(requests[2].key, receipt.key);
    await sendConfirmation(id, true);
    assert.equal(requests.length, 3);
    checks += 6;

    const { rows: events } = await db().query(
      "SELECT kind,details FROM enquiry_activity WHERE enquiry_id=$1 ORDER BY id",
      [id],
    );
    assert.equal(
      events.filter((event) => event.kind === "mail_sent").length,
      2,
    );
    assert(
      events
        .filter((event) => event.kind === "mail_sent")
        .every(
          (event) =>
            event.details.providerMessageId === sentId &&
            event.details.provider === "resend",
        ),
    );
    assert.equal(
      events.find((event) => event.kind === "mail_failed").details.failureCode,
      "resend_http_429",
    );
    assert.doesNotMatch(
      JSON.stringify(events),
      /PRIVATE|re_test_only|resend-visitor@/,
    );
    checks += 4;
    return checks;
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await db().query("DELETE FROM enquiries WHERE id=$1", [id]);
  }
}
