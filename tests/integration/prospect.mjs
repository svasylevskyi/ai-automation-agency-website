import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prepareProspect } from "../../automation/prospect-rules.mjs";

export async function checkProspect({ call, status, db }) {
  assert.equal(
    process.env.PROSPECT_AUTOMATION_ENABLED,
    "true",
    "Run integration tests with prospect automation enabled",
  );
  let checks = 0;
  const equal = (a, b) => {
    assert.deepEqual(a, b);
    checks++;
  };
  const worker = (
    path,
    input = {},
    token = process.env.PROSPECT_AUTOMATION_TOKEN,
  ) =>
    fetch(process.env.APP_URL + "/api/automation/prospects/" + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });
  const claim = async () => {
    const response = await worker("claim");
    status(response, 200);
    return (await response.json()).job;
  };
  // The rest of the suite's fixtures are not work for this worker test.
  await db().query(
    "UPDATE prospect_jobs SET status='cancelled' WHERE status <> 'completed'",
  );
  status(await call("/api/automation/prospects/claim", "POST", {}, true), 401);
  status(await worker("claim", {}, "invalid"), 401);
  status(await worker("complete", {}, "invalid"), 401);
  status(await worker("claim", { unexpected: true }), 400);
  equal(await claim(), null);
  const id = randomUUID();
  await db().query(
    `INSERT INTO enquiries (id,submission_id,name,email,company,area,team_size,message,privacy_notice_version,notes,notification_status)
    VALUES ($1,$2,'Private name','private@example.test','Example company','other','small','A recurring task','test','Private notes never sent','sent')`,
    [id, randomUUID()],
  );
  const ownerUrl = `/api/admin/enquiries/${id}/prospect`;
  const enquiryUrl = `/api/admin/enquiries/${id}`;
  try {
    status(await call(ownerUrl, "POST", { version: 1 }), 401);
    status(
      await call(
        ownerUrl,
        "POST",
        { version: 1 },
        true,
        "https://attacker.test",
      ),
      403,
    );
    status(await call(ownerUrl, "POST", { version: 2 }, true), 409);
    status(await call(ownerUrl, "POST", { version: 1 }, true), 200);
    equal(
      (
        await db().query(
          "SELECT status,attempts FROM prospect_jobs WHERE enquiry_id=$1",
          [id],
        )
      ).rows[0],
      { status: "pending", attempts: 0 },
    );
    status(await call(ownerUrl, "POST", { version: 1 }, true), 409);
    const parallel = await Promise.all([claim(), claim(), claim()]);
    equal(parallel.filter(Boolean).length, 1);
    let job = parallel.find(Boolean);
    equal(Object.keys(job.enquiry).sort(), [
      "area",
      "assessment",
      "company",
      "message",
      "teamSize",
    ]);
    assert.doesNotMatch(
      JSON.stringify(job),
      /private@example|Private name|Private notes/,
    );
    checks++;
    status(
      await worker("complete", {
        ...prepareProspect(job),
        claimToken: randomUUID(),
      }),
      409,
    );
    status(
      await worker("complete", {
        ...prepareProspect(job),
        result: { ...prepareProspect(job).result, method: "ai" },
      }),
      400,
    );
    status(await worker("complete", { text: "x".repeat(41000) }), 413);
    await db().query(
      "UPDATE prospect_jobs SET lease_until=now()-interval '1 second' WHERE enquiry_id=$1",
      [id],
    );
    status(await worker("complete", prepareProspect(job)), 409);
    const stale = job;
    job = await claim();
    assert.notEqual(job.claimToken, stale.claimToken);
    checks++;
    status(await worker("complete", prepareProspect(stale)), 409);
    const prepared = prepareProspect(job);
    prepared.result.brief = '<img src=x onerror="alert(1)">';
    status(await worker("complete", prepared), 200);
    status(await worker("complete", prepared), 200);
    status(
      await worker("complete", {
        ...prepared,
        result: { ...prepared.result, brief: "Replacement must not overwrite" },
      }),
      200,
    );
    equal(
      (
        await db().query(
          "SELECT result FROM prospect_jobs WHERE enquiry_id=$1",
          [id],
        )
      ).rows[0].result.brief,
      prepared.result.brief,
    );
    equal(
      (
        await db().query(
          "SELECT count(*)::int AS n FROM enquiry_activity WHERE enquiry_id=$1 AND kind='prospect_prepared'",
          [id],
        )
      ).rows[0].n,
      1,
    );
    equal(
      (
        await db().query(
          "SELECT status,notes,next_action,version FROM enquiries WHERE id=$1",
          [id],
        )
      ).rows[0],
      {
        status: "new",
        notes: "Private notes never sent",
        next_action: "",
        version: 1,
      },
    );
    const page = await call(`/admin/enquiries/${id}`, "GET", undefined, true);
    status(page, 200);
    const html = await page.text();
    assert.match(html, /Draft ready for review/);
    assert.match(html, /&lt;img/);
    assert.doesNotMatch(html, /<img src=x/);
    checks += 3;
    equal(await claim(), null);
    status(await call(ownerUrl, "POST", { version: 1 }, true), 409);
    // Simulate interrupted deliveries through exhaustion, then an explicit owner retry.
    await db().query(
      "UPDATE prospect_jobs SET status='running',attempts=4,lease_until=now()-interval '1 second',result=NULL,completed_at=NULL WHERE enquiry_id=$1",
      [id],
    );
    const fifth = await claim();
    await db().query(
      "UPDATE prospect_jobs SET lease_until=now()-interval '1 second' WHERE enquiry_id=$1",
      [id],
    );
    equal(await claim(), null);
    equal(
      (
        await db().query(
          "SELECT status,attempts FROM prospect_jobs WHERE enquiry_id=$1",
          [id],
        )
      ).rows[0],
      { status: "failed", attempts: 5 },
    );
    status(await call(ownerUrl, "POST", { version: 1 }, true), 200);
    job = await claim();
    status(await worker("complete", prepareProspect(fifth)), 409);
    status(
      await call(
        enquiryUrl,
        "PATCH",
        {
          version: 1,
          status: "closed",
          notes: "Private notes never sent",
          nextAction: "",
          followUpDate: null,
        },
        true,
      ),
      200,
    );
    equal(
      (
        await db().query(
          "SELECT status FROM prospect_jobs WHERE enquiry_id=$1",
          [id],
        )
      ).rows[0].status,
      "cancelled",
    );
    status(await worker("complete", prepareProspect(job)), 409);
    status(await call(ownerUrl, "POST", { version: 2 }, true), 409);
    equal(await claim(), null);
    status(
      await call(
        enquiryUrl,
        "PATCH",
        {
          version: 2,
          status: "new",
          notes: "Private notes never sent",
          nextAction: "",
          followUpDate: null,
        },
        true,
      ),
      200,
    );
    equal(await claim(), null);
    status(await call(ownerUrl, "POST", { version: 3 }, true), 200);
    job = await claim();
    status(await call(enquiryUrl, "DELETE", { version: 3 }, true), 200);
    status(await worker("complete", prepareProspect(job)), 410);
    equal(
      (
        await db().query(
          "SELECT count(*)::int AS n FROM prospect_jobs WHERE enquiry_id=$1",
          [id],
        )
      ).rows[0].n,
      0,
    );
    equal(await claim(), null);
  } finally {
    await db().query("DELETE FROM enquiries WHERE id=$1", [id]);
  }
  return checks;
}
