import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { issueChallenge } from "../../src/server/spam.ts";
import {
  sendConfirmation,
  sendNotification,
  expireExhaustedMailClaims,
} from "../../src/server/mail.ts";
import { warsawToday } from "../../src/lib/follow-up.ts";

export async function checkFollowUp({ call, status, enquiry, db }) {
  let checks = 0;
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    await client.query("CREATE SCHEMA integration_followup_upgrade");
    await client.query("SET LOCAL search_path TO integration_followup_upgrade");
    await client.query(
      "CREATE TABLE enquiries (id uuid PRIMARY KEY,status text NOT NULL DEFAULT 'new',created_at timestamptz DEFAULT now())",
    );
    await client.query(
      "CREATE TABLE legal_pages (slug text PRIMARY KEY,content text,version integer,is_draft boolean,updated_at timestamptz DEFAULT now())",
    );
    const legacy = randomUUID();
    await client.query(
      "INSERT INTO enquiries(id,status) VALUES ($1,'contacted')",
      [legacy],
    );
    await client.query(
      "INSERT INTO legal_pages(slug,content,version,is_draft) VALUES ('privacy','Owner-written privacy notice',2,true),('terms','Owner-approved terms',3,false)",
    );
    await client.query(
      await readFile(
        new URL("../../migrations/004-enquiry-follow-up.sql", import.meta.url),
        "utf8",
      ),
    );
    const row = (
      await client.query("SELECT * FROM enquiries WHERE id=$1", [legacy])
    ).rows[0];
    assert.equal(row.status, "contacted");
    assert.equal(row.confirmation_status, "not_required");
    assert.equal(row.confirmation_attempts, 0);
    assert.equal(row.next_action, "");
    assert.equal(
      (
        await client.query(
          "SELECT kind FROM enquiry_activity WHERE enquiry_id=$1",
          [legacy],
        )
      ).rows[0].kind,
      "history_started",
    );
    assert.deepEqual(
      (
        await client.query(
          "SELECT content,version FROM legal_pages ORDER BY slug",
        )
      ).rows,
      [
        { content: "Owner-written privacy notice", version: 2 },
        { content: "Owner-approved terms", version: 3 },
      ],
    );
    checks += 6;
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
  await db().query("DELETE FROM request_limits");
  const input = {
    ...enquiry,
    name: "Follow-up Visitor",
    email: "followup@example.test",
    token: issueChallenge(Date.now() - 3000),
  };
  const submissions = await Promise.all([
    call("/api/enquiries", "POST", input),
    call("/api/enquiries", "POST", input),
  ]);
  for (const response of submissions) status(response, 201);
  let item = (
    await db().query("SELECT * FROM enquiries WHERE email=$1", [input.email])
  ).rows[0];
  const id = item.id,
    url = `/api/admin/enquiries/${id}`;
  const row = async () =>
    (
      await db().query(
        "SELECT *,follow_up_on::text AS due_date FROM enquiries WHERE id=$1",
        [id],
      )
    ).rows[0];
  const events = async () =>
    (
      await db().query(
        "SELECT kind,details FROM enquiry_activity WHERE enquiry_id=$1 ORDER BY id",
        [id],
      )
    ).rows;
  async function waitMail() {
    for (let attempt = 0; attempt < 100; attempt++) {
      const current = await row();
      if (
        current.notification_status === "sent" &&
        current.confirmation_status === "sent"
      )
        return;
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.fail("Mail did not finish");
  }
  await waitMail();
  item = await row();
  assert.equal(item.confirmation_attempts, 1);
  assert.equal(item.notification_attempts, 1);
  assert.equal((await events()).filter((e) => e.kind === "received").length, 1);
  assert.equal(
    (await events()).filter((e) => e.kind === "mail_sent").length,
    2,
  );
  assert.equal(item.confirmation_payload.replyTo, "public@example.test");
  assert.match(item.confirmation_payload.text, /https:\/\/example.test\/book/);
  assert.doesNotMatch(
    item.confirmation_payload.text,
    /Follow-up Visitor|copy each enquiry/,
  );
  checks += 7;
  await Promise.all([
    sendConfirmation(id),
    sendConfirmation(id),
    sendNotification(id),
  ]);
  assert.equal((await row()).confirmation_attempts, 1);
  checks++;
  status(await call(`${url}/confirmation`, "POST", {}), 401);
  status(
    await call(
      `${url}/confirmation`,
      "POST",
      {},
      true,
      "https://attacker.test",
    ),
    403,
  );
  status(await call(`${url}/follow-up`, "POST", { version: 1 }), 401);
  status(
    await call(
      `${url}/follow-up`,
      "POST",
      { version: 1 },
      true,
      "https://attacker.test",
    ),
    403,
  );
  status(await call(`${url}/follow-up`, "POST", { version: 1 }, true), 400);
  status(
    await call(
      `/api/admin/enquiries/${randomUUID()}/confirmation`,
      "POST",
      {},
      true,
    ),
    404,
  );
  const update = {
    status: "contacted",
    notes: "Private tracked notes",
    nextAction: "Send questions",
    followUpDate: warsawToday(),
    version: 1,
  };
  for (const invalid of [
    { followUpDate: "2027-02-29" },
    { nextAction: "" },
    { followUpDate: null },
    { nextAction: "x".repeat(301) },
    { status: "closed" },
  ])
    status(await call(url, "PATCH", { ...update, ...invalid }, true), 400);
  status(await call(url, "PATCH", update, true), 200);
  assert.equal((await row()).due_date, update.followUpDate);
  let history = await events();
  assert(
    history.some(
      (e) => e.kind === "status_changed" && e.details.to === "contacted",
    ),
  );
  assert(history.some((e) => e.kind === "follow_up_scheduled"));
  assert(history.some((e) => e.kind === "notes_updated"));
  assert.doesNotMatch(JSON.stringify(history), /Private tracked notes/);
  checks += 5;
  let html = await (
    await call("/admin?view=attention", "GET", undefined, true)
  ).text();
  assert.match(html, /Follow-up Visitor/);
  assert.match(html, /Due today/);
  checks += 2;
  const beforeConflict = (await events()).length;
  status(
    await call(
      url,
      "PATCH",
      { ...update, nextAction: "Stale", version: 1 },
      true,
    ),
    409,
  );
  status(await call(`${url}/follow-up`, "POST", { version: 1 }, true), 409);
  assert.equal((await events()).length, beforeConflict);
  checks++;
  status(await call(`${url}/follow-up`, "POST", { version: 2 }, true), 200);
  assert.equal((await row()).next_action, "");
  assert.equal((await row()).due_date, null);
  assert(
    (await events()).some(
      (e) =>
        e.kind === "follow_up_completed" &&
        e.details.action === "Send questions",
    ),
  );
  checks += 3;
  status(await call(`${url}/follow-up`, "POST", { version: 2 }, true), 409);
  assert.doesNotMatch(
    await (await call("/admin?view=attention", "GET", undefined, true)).text(),
    /Follow-up Visitor/,
  );
  checks++;
  status(
    await call(
      url,
      "PATCH",
      { ...update, followUpDate: "2099-12-31", version: 3 },
      true,
    ),
    200,
  );
  assert.doesNotMatch(
    await (await call("/admin", "GET", undefined, true)).text(),
    /Follow-up Visitor/,
  );
  assert.match(
    await (await call("/admin?view=all", "GET", undefined, true)).text(),
    /Follow-up Visitor/,
  );
  checks += 2;
  status(
    await call(
      url,
      "PATCH",
      { ...update, followUpDate: "2000-01-01", version: 4 },
      true,
    ),
    200,
  );
  html = await (await call("/admin", "GET", undefined, true)).text();
  assert.match(html, /Follow-up Visitor/);
  assert.match(html, /Overdue/);
  checks += 2;
  // Two tabs cannot both update the same revision or create duplicate history.
  const concurrent = await Promise.all([
    call(
      url,
      "PATCH",
      { ...update, nextAction: '<script>alert("action")</script>', version: 5 },
      true,
    ),
    call(
      url,
      "PATCH",
      { ...update, nextAction: '<script>alert("action")</script>', version: 5 },
      true,
    ),
  ]);
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
  checks++;
  html = await (
    await call(`/admin/enquiries/${id}`, "GET", undefined, true)
  ).text();
  assert.match(html, /Activity history/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  checks += 3;
  const eventsBeforeNoop = (await events()).length;
  status(
    await call(
      url,
      "PATCH",
      { ...update, nextAction: '<script>alert("action")</script>', version: 6 },
      true,
    ),
    200,
  );
  assert.equal((await row()).version, 6);
  assert.equal((await events()).length, eventsBeforeNoop);
  checks += 2;
  status(
    await call(
      url,
      "PATCH",
      {
        ...update,
        status: "closed",
        nextAction: "",
        followUpDate: null,
        version: 6,
      },
      true,
    ),
    200,
  );
  assert((await events()).some((e) => e.kind === "follow_up_cleared"));
  assert.doesNotMatch(
    await (await call("/admin?view=attention", "GET", undefined, true)).text(),
    /Follow-up Visitor/,
  );
  checks += 2;
  status(
    await call(
      url,
      "PATCH",
      {
        ...update,
        status: "new",
        nextAction: "",
        followUpDate: null,
        version: 7,
      },
      true,
    ),
    200,
  );
  assert.match(
    await (await call("/admin?view=attention", "GET", undefined, true)).text(),
    /Follow-up Visitor/,
  );
  checks++;
  // Re-running migrations preserves both active state and history.
  const eventCount = (await events()).length;
  await promisify(execFile)(
    process.execPath,
    ["--import", "tsx", "scripts/migrate.ts"],
    { env: process.env },
  );
  assert.equal((await row()).version, 8);
  assert.equal((await events()).length, eventCount);
  checks += 2;
  // Receipt failure is independent of owner delivery and keeps the saved enquiry.
  await db().query(
    "UPDATE enquiries SET confirmation_status='pending',confirmation_attempts=0 WHERE id=$1",
    [id],
  );
  const port = process.env.SMTP_PORT;
  try {
    process.env.SMTP_PORT = "1026";
    await sendConfirmation(id);
  } finally {
    process.env.SMTP_PORT = port;
  }
  assert.equal((await row()).confirmation_status, "failed");
  assert.equal((await row()).notification_status, "sent");
  checks += 2;
  await sendConfirmation(id);
  assert.equal((await row()).confirmation_attempts, 1);
  checks++;
  status(await call(`${url}/confirmation`, "POST", {}, true), 200);
  assert.equal((await row()).confirmation_status, "sent");
  assert(
    (await events()).some(
      (e) => e.kind === "mail_failed" && e.details.channel === "confirmation",
    ),
  );
  checks += 2;
  // Parallel workers claim exactly once, including recovery of interrupted sends.
  await db().query(
    "UPDATE enquiries SET confirmation_status='sending',confirmation_attempted_at=now()-interval '10 minutes',confirmation_attempts=1 WHERE id=$1",
    [id],
  );
  await Promise.all([sendConfirmation(id), sendConfirmation(id)]);
  assert.equal((await row()).confirmation_attempts, 2);
  assert.equal((await row()).confirmation_status, "sent");
  checks += 2;
  // Automatic maintenance processes both channels after a delay.
  await db().query(
    "UPDATE enquiries SET confirmation_status='failed',confirmation_attempted_at=now()-interval '10 minutes' WHERE id=$1",
    [id],
  );
  await promisify(execFile)(
    process.execPath,
    ["--import", "tsx", "scripts/maintenance.ts"],
    { env: process.env },
  );
  assert.equal((await row()).confirmation_status, "sent");
  checks++;
  await db().query(
    "UPDATE enquiries SET confirmation_status='failed',confirmation_attempts=5,confirmation_attempted_at=now()-interval '10 minutes' WHERE id=$1",
    [id],
  );
  await sendConfirmation(id);
  assert.equal((await row()).confirmation_attempts, 5);
  assert.equal((await row()).confirmation_status, "failed");
  checks += 2;
  status(await call(`${url}/confirmation`, "POST", {}, true), 409);
  await db().query(
    "UPDATE enquiries SET confirmation_status='not_required' WHERE id=$1",
    [id],
  );
  await db().query("DELETE FROM request_limits");
  status(await call(`${url}/confirmation`, "POST", {}, true), 400);
  await sendConfirmation(id);
  assert.equal((await row()).confirmation_status, "not_required");
  checks++;
  // History pagination is bounded and all records cascade with the enquiry.
  await db().query(
    "INSERT INTO enquiry_activity(enquiry_id,kind) SELECT $1,'notes_updated' FROM generate_series(1,55)",
    [id],
  );
  const firstPage = await (
    await call(`/admin/enquiries/${id}`, "GET", undefined, true)
  ).text();
  assert.match(firstPage, /Older/);
  const secondPage = await call(
    `/admin/enquiries/${id}?activityPage=2`,
    "GET",
    undefined,
    true,
  );
  status(secondPage, 200);
  assert.match(await secondPage.text(), /Newer/);
  checks += 2;
  status(await call(url, "DELETE", { version: 8 }, true), 200);
  assert.equal((await events()).length, 0);
  checks++;
  // The last interrupted claim ends visibly instead of staying in Sending forever.
  const exhaustedId = randomUUID();
  await db().query(
    "INSERT INTO enquiries(id,submission_id,name,email,area,team_size,message,privacy_notice_version,confirmation_status,confirmation_attempts,confirmation_attempted_at) VALUES ($1,$2,'Exhausted test','exhausted@example.test','sales','small','Test only','test','sending',5,now()-interval '10 minutes')",
    [exhaustedId, randomUUID()],
  );
  await expireExhaustedMailClaims();
  assert.equal(
    (
      await db().query(
        "SELECT confirmation_status FROM enquiries WHERE id=$1",
        [exhaustedId],
      )
    ).rows[0].confirmation_status,
    "failed",
  );
  assert.equal(
    (
      await db().query(
        "SELECT details FROM enquiry_activity WHERE enquiry_id=$1",
        [exhaustedId],
      )
    ).rows[0].details.interrupted,
    true,
  );
  checks += 2;
  await db().query("DELETE FROM enquiries WHERE id=$1", [exhaustedId]);
  await db().query("DELETE FROM request_limits");
  return checks;
}
