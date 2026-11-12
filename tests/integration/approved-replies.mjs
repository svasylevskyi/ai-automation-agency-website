import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  previewReply,
  sendReply,
  getReplyDelivery,
} from "../../src/server/reply-delivery.ts";
import { saveReplyDraft } from "../../src/server/prospect.ts";
import { updateEnquiry } from "../../src/server/enquiries.ts";
import { warsawToday } from "../../src/lib/follow-up.ts";

export async function checkApprovedReplies({ call, status, db }) {
  let checks = 0;
  const equal = (actual, expected) => {
    assert.deepEqual(actual, expected);
    checks++;
  };
  const verify = (value) => {
    assert(value);
    checks++;
  };
  const rejects = async (fn, code) => {
    await assert.rejects(fn, (error) => error.status === code);
    checks++;
  };
  const ids = [];
  const body =
    "Hello Alex,\n\nWhich enquiry source should we review first?\n\nBest regards,\nStepan";
  async function fixture() {
    const id = randomUUID();
    ids.push(id);
    await db().query(
      `INSERT INTO enquiries(id,submission_id,name,email,area,team_size,message,privacy_notice_version)
      VALUES($1,$2,'Reply test visitor','reply-test@example.test','sales','small','PRIVATE ENQUIRY CONTENT','enquiry-v4')`,
      [id, randomUUID()],
    );
    await db().query(
      `INSERT INTO prospect_jobs(id,enquiry_id,status,result,reply_text,reply_ready,reply_version)
      VALUES($1,$2,'completed',$3,$4,true,1)`,
      [
        randomUUID(),
        id,
        JSON.stringify({
          method: "rules-v1",
          brief: "Brief",
          discoveryQuestions: ["Question"],
          nextAction: "Review",
          replyDraft: body,
        }),
        body,
      ],
    );
    return id;
  }
  const input = {
    reviewVersion: 1,
    enquiryVersion: 1,
    subject: "Your enquiry",
    followUp: { action: "Check for a reply", date: warsawToday() },
  };
  const originalFetch = globalThis.fetch;
  const keys = [
    "MAIL_PROVIDER",
    "MAIL_FROM",
    "RESEND_API_KEY",
    "NOTIFICATION_EMAIL",
  ];
  const originalEnv = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  try {
    const id = await fixture(),
      base = `/api/admin/enquiries/${id}/reply`;
    status(await call(`${base}/preview`, "POST", input), 401);
    status(
      await call(`${base}/send`, "POST", {
        deliveryId: randomUUID(),
        confirmed: true,
      }),
      401,
    );
    status(
      await call(
        `${base}/preview`,
        "POST",
        input,
        true,
        "https://attacker.test",
      ),
      403,
    );
    status(
      await call(`${base}/send`, "POST", {}, true, "https://attacker.test"),
      403,
    );
    status(
      await call(
        `${base}/preview`,
        "POST",
        { ...input, to: "other@example.test" },
        true,
      ),
      400,
    );
    status(
      await call(
        `${base}/preview`,
        "POST",
        { ...input, reviewVersion: 2 },
        true,
      ),
      409,
    );
    status(
      await call(
        `${base}/preview`,
        "POST",
        { ...input, enquiryVersion: 2 },
        true,
      ),
      409,
    );
    await db().query(
      "UPDATE prospect_jobs SET reply_ready=false WHERE enquiry_id=$1",
      [id],
    );
    status(await call(`${base}/preview`, "POST", input, true), 409);
    await db().query(
      "UPDATE prospect_jobs SET reply_ready=true,reply_text='Best regards, [Your name]' WHERE enquiry_id=$1",
      [id],
    );
    status(await call(`${base}/preview`, "POST", input, true), 400);
    await db().query(
      "UPDATE prospect_jobs SET reply_text=$2 WHERE enquiry_id=$1",
      [id, body],
    );
    const first = await call(`${base}/preview`, "POST", input, true);
    status(first, 200);
    const oldPreview = await first.json();
    equal(oldPreview.to, "reply-test@example.test");
    equal(oldPreview.attempts, 0);
    verify(oldPreview.html.includes("Best regards,<br>Stepan"));
    verify(!JSON.stringify(oldPreview).includes("PRIVATE ENQUIRY CONTENT"));
    equal(
      (
        await db().query(
          "SELECT count(*)::int AS n FROM enquiry_activity WHERE enquiry_id=$1 AND kind='mail_attempted'",
          [id],
        )
      ).rows[0].n,
      0,
    );
    const response = await call(`${base}/preview`, "POST", input, true);
    status(response, 200);
    const preview = await response.json();
    status(
      await call(
        `${base}/send`,
        "POST",
        { deliveryId: oldPreview.id, confirmed: true },
        true,
      ),
      409,
    );
    status(
      await call(
        `${base}/send`,
        "POST",
        { deliveryId: preview.id, confirmed: false },
        true,
      ),
      400,
    );
    status(
      await call(
        `${base}/send`,
        "POST",
        { deliveryId: preview.id, confirmed: true, to: "other@example.test" },
        true,
      ),
      400,
    );
    // Concurrent authenticated clicks must produce exactly one SMTP acceptance.
    const pair = await Promise.all(
      [1, 2].map(() =>
        call(
          `${base}/send`,
          "POST",
          { deliveryId: preview.id, confirmed: true },
          true,
        ),
      ),
    );
    pair.forEach((result) => status(result, 200));
    const delivery = await getReplyDelivery(id);
    equal(delivery.status, "accepted");
    equal(delivery.attempts, 1);
    equal(delivery.followUpOutcome, "applied");
    let parent = (
      await db().query(
        "SELECT status,next_action,follow_up_on::text AS date FROM enquiries WHERE id=$1",
        [id],
      )
    ).rows[0];
    equal(parent, {
      status: "contacted",
      next_action: input.followUp.action,
      date: input.followUp.date,
    });
    status(
      await call(
        `${base}/send`,
        "POST",
        { deliveryId: preview.id, confirmed: true },
        true,
      ),
      200,
    );
    equal((await getReplyDelivery(id)).attempts, 1);
    equal(
      (
        await db().query(
          "SELECT count(*)::int AS n FROM enquiry_activity WHERE enquiry_id=$1 AND kind='mail_sent'",
          [id],
        )
      ).rows[0].n,
      1,
    );
    status(
      await call(
        `${base}/preview`,
        "POST",
        { ...input, enquiryVersion: 2 },
        true,
      ),
      409,
    );
    status(
      await call(
        `/api/admin/enquiries/${id}/prospect/reply-draft`,
        "PATCH",
        { text: "Edited later", version: 1, ready: true },
        true,
      ),
      409,
    );
    verify(
      (
        await (
          await call(`/admin/enquiries/${id}`, "GET", undefined, true)
        ).text()
      ).includes("First reply delivery"),
    );

    const stale = await fixture();
    let stalePreview = await previewReply(stale, input);
    await saveReplyDraft(stale, {
      text: body + "\nAdditional context.",
      ready: true,
      version: 1,
    });
    await rejects(() => sendReply(stale, stalePreview.id), 409);
    stalePreview = await previewReply(stale, { ...input, reviewVersion: 2 });
    await db().query(
      "UPDATE reply_deliveries SET created_at=now()-interval '16 minutes' WHERE enquiry_id=$1",
      [stale],
    );
    await rejects(() => sendReply(stale, stalePreview.id), 409);
    stalePreview = await previewReply(stale, { ...input, reviewVersion: 2 });
    await updateEnquiry(stale, {
      version: 1,
      status: "closed",
      notes: "",
      nextAction: "",
      followUpDate: null,
    });
    await rejects(() => sendReply(stale, stalePreview.id), 409);

    // Resend uses only a fake transport. No real credentials or external sends.
    Object.assign(process.env, {
      MAIL_PROVIDER: "resend",
      MAIL_FROM: "website@mail.get-automated.ai",
      RESEND_API_KEY: "re_fake_test_key",
      NOTIFICATION_EMAIL: "hello@get-automated.ai",
    });
    const requests = [];
    let fail = true;
    globalThis.fetch = async (url, options) => {
      if (url !== "https://api.resend.com/emails")
        return originalFetch(url, options);
      requests.push({
        body: JSON.parse(options.body),
        key: options.headers["Idempotency-Key"],
      });
      await new Promise((resolve) => setTimeout(resolve, 30));
      return fail
        ? Response.json({ error: "unavailable" }, { status: 503 })
        : Response.json({ id: randomUUID() });
    };
    const retryId = await fixture();
    const retryPreview = await previewReply(retryId, input);
    let retry = await sendReply(retryId, retryPreview.id);
    equal(retry.status, "unconfirmed");
    equal(retry.retryAllowed, true);
    equal(
      (await db().query("SELECT status FROM enquiries WHERE id=$1", [retryId]))
        .rows[0].status,
      "new",
    );
    await rejects(
      () =>
        saveReplyDraft(retryId, { text: "Changed", ready: true, version: 1 }),
      409,
    );
    // Owner changed the next action during recovery. Never overwrite that edit.
    await updateEnquiry(retryId, {
      version: 1,
      status: "in_progress",
      notes: "Owner note",
      nextAction: "Newer action",
      followUpDate: warsawToday(),
    });
    process.env.MAIL_FROM = "different@mail.get-automated.ai";
    fail = false;
    retry = await sendReply(retryId, retryPreview.id);
    equal(retry.status, "accepted");
    equal(retry.followUpOutcome, "not_applied");
    equal(requests[1], requests[0]);
    equal(
      (
        await db().query("SELECT next_action FROM enquiries WHERE id=$1", [
          retryId,
        ])
      ).rows[0].next_action,
      "Newer action",
    );
    await sendReply(retryId, retryPreview.id);
    equal(requests.length, 2);

    const parallelId = await fixture();
    const parallelPreview = await previewReply(parallelId, {
      ...input,
      followUp: null,
    });
    await Promise.all([
      sendReply(parallelId, parallelPreview.id),
      sendReply(parallelId, parallelPreview.id),
    ]);
    equal(requests.length, 3);
    equal((await getReplyDelivery(parallelId)).attempts, 1);
    equal((await getReplyDelivery(parallelId)).followUpOutcome, "none");

    const interruptedId = await fixture();
    const interrupted = await previewReply(interruptedId, input);
    await db().query(
      `UPDATE reply_deliveries SET status='sending',attempts=1,approved_at=now(),
      first_attempt_at=now()-interval '10 minutes',attempted_at=now()-interval '6 minutes' WHERE enquiry_id=$1`,
      [interruptedId],
    );
    verify((await getReplyDelivery(interruptedId)).retryAllowed);
    equal((await sendReply(interruptedId, interrupted.id)).status, "accepted");
    equal(requests.length, 4);

    const expiredId = await fixture();
    const expired = await previewReply(expiredId, input);
    await db().query(
      `UPDATE reply_deliveries SET status='unconfirmed',attempts=1,
      first_attempt_at=now()-interval '24 hours',attempted_at=now()-interval '24 hours' WHERE enquiry_id=$1`,
      [expiredId],
    );
    equal((await getReplyDelivery(expiredId)).retryAllowed, false);
    await rejects(() => sendReply(expiredId, expired.id), 409);
    equal(requests.length, 4);
    await db().query(
      "UPDATE reply_deliveries SET first_attempt_at=now(),attempts=5 WHERE enquiry_id=$1",
      [expiredId],
    );
    await rejects(() => sendReply(expiredId, expired.id), 409);
    await db().query(
      "UPDATE reply_deliveries SET provider='smtp',attempts=1 WHERE enquiry_id=$1",
      [expiredId],
    );
    process.env.MAIL_PROVIDER = "smtp";
    await rejects(() => sendReply(expiredId, expired.id), 409);
    equal(requests.length, 4);

    await db().query("DELETE FROM enquiries WHERE id=$1", [parallelId]);
    equal(await getReplyDelivery(parallelId), null);
    equal(
      (
        await db().query(
          "SELECT count(*)::int AS n FROM enquiry_deletions WHERE enquiry_id=$1",
          [parallelId],
        )
      ).rows[0].n,
      1,
    );
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys)
      originalEnv[key] === undefined
        ? delete process.env[key]
        : (process.env[key] = originalEnv[key]);
    await db().query("DELETE FROM enquiries WHERE id=ANY($1::uuid[])", [ids]);
  }
  return checks;
}
