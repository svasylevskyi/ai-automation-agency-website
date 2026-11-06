import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { cleanExpiredEnquiries } from "../../src/server/retention.ts";

export async function checkRetention({ call, status, db }) {
  let checks = 0;
  const equal = (a, b) => {
    assert.deepEqual(a, b);
    checks++;
  };
  const client = await db().connect();
  try {
    await client.query(
      "BEGIN; CREATE SCHEMA retention_upgrade; SET LOCAL search_path TO retention_upgrade",
    );
    await client.query(
      "CREATE TABLE enquiries(id uuid PRIMARY KEY,status text,updated_at timestamptz)",
    );
    await client.query(
      "INSERT INTO enquiries VALUES ($1,'closed',now()-interval '2 years')",
      [randomUUID()],
    );
    await client.query(
      await readFile(
        new URL("../../migrations/005-retention.sql", import.meta.url),
        "utf8",
      ),
    );
    equal(
      (
        await client.query(
          "SELECT closed_at >= now()-interval '1 minute' AS protected FROM enquiries",
        )
      ).rows[0].protected,
      true,
    );
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
  const policy = async () =>
    (await db().query("SELECT * FROM retention_policy")).rows[0];
  equal((await policy()).enabled, false);
  status(
    await call("/api/admin/retention/preview", "POST", {
      days: 180,
      version: 1,
    }),
    401,
  );
  status(await call("/api/admin/retention", "PUT", {}), 401);
  status(
    await call(
      "/api/admin/retention/preview",
      "POST",
      {},
      true,
      "https://other.test",
    ),
    403,
  );
  status(
    await call("/api/admin/retention", "PUT", {}, true, "https://other.test"),
    403,
  );
  for (const days of [29, 3651, 30.5])
    status(
      await call(
        "/api/admin/retention/preview",
        "POST",
        { days, version: 1 },
        true,
      ),
      400,
    );
  status(
    await call(
      "/api/admin/retention",
      "PUT",
      { days: 180, version: 1, enabled: true },
      true,
    ),
    400,
  );

  const ids = Array.from({ length: 108 }, () => randomUUID());
  // These are synthetic old records. The production closure trigger intentionally prevents backdating.
  const fixture = await db().connect();
  try {
    await fixture.query(
      "BEGIN; ALTER TABLE enquiries DISABLE TRIGGER enquiry_closure",
    );
    for (const id of ids)
      await fixture.query(
        `INSERT INTO enquiries
      (id,submission_id,name,email,area,team_size,message,privacy_notice_version,status,closed_at,updated_at,notification_status)
      VALUES ($1,$2,'Retention fixture','retention@example.test','sales','small','Private retention fixture','test','closed',now()-interval '200 days',now()-interval '200 days','sent')`,
        [id, randomUUID()],
      );
    await fixture.query(
      "ALTER TABLE enquiries ENABLE TRIGGER enquiry_closure; COMMIT",
    );
  } catch (e) {
    await fixture.query("ROLLBACK");
    throw e;
  } finally {
    fixture.release();
  }
  const [reopened, edited, freshMail, nullMail, recentlyClosed] = ids.slice(-5);
  await db().query("UPDATE enquiries SET status='in_progress' WHERE id=$1", [
    reopened,
  ]);
  equal(
    (
      await db().query("SELECT closed_at FROM enquiries WHERE id=$1", [
        reopened,
      ])
    ).rows[0].closed_at,
    null,
  );
  await db().query("UPDATE enquiries SET updated_at=now() WHERE id=$1", [
    edited,
  ]);
  await db().query(
    "UPDATE enquiries SET notification_status='sending',notification_attempted_at=now() WHERE id=$1",
    [freshMail],
  );
  await db().query(
    "UPDATE enquiries SET notification_status='sending' WHERE id=$1",
    [nullMail],
  );
  await db().query("UPDATE enquiries SET status='new' WHERE id=$1", [
    recentlyClosed,
  ]);
  await db().query("UPDATE enquiries SET status='closed' WHERE id=$1", [
    recentlyClosed,
  ]);
  equal(await cleanExpiredEnquiries(), 0);
  const preview = async () => {
    const response = await call(
      "/api/admin/retention/preview",
      "POST",
      { days: 180, version: (await policy()).version },
      true,
    );
    status(response, 200);
    return response.json();
  };
  let shown = await preview();
  equal(shown.count, 103);
  equal(shown.samples.length, 50);
  equal(
    (
      await db().query(
        "SELECT count(*)::int AS n FROM enquiries WHERE id=ANY($1::uuid[])",
        [ids],
      )
    ).rows[0].n,
    108,
  );
  const save = (token, extra = {}) =>
    call(
      "/api/admin/retention",
      "PUT",
      {
        days: 180,
        version: 1,
        enabled: true,
        previewToken: token,
        acknowledged: true,
        ...extra,
      },
      true,
    );
  status(await save(shown.token + "invalid"), 409);
  status(await save(shown.token, { acknowledged: false }), 400);
  status(await save(shown.token, { days: 181 }), 409);
  const expired = JSON.parse(
    Buffer.from(shown.token.split(".")[0], "base64url").toString(),
  );
  expired.issued -= 601000;
  const body = Buffer.from(JSON.stringify(expired)).toString("base64url");
  const signature = createHmac("sha256", process.env.BETTER_AUTH_SECRET)
    .update("retention-preview:" + body)
    .digest("base64url");
  status(await save(body + "." + signature), 409);
  await db().query(
    "UPDATE enquiries SET notes='Changed after preview',version=version+1,updated_at=now() WHERE id=$1",
    [ids[0]],
  );
  status(await save(shown.token), 409);
  shown = await preview();
  equal(shown.count, 102);
  await db().query(
    "INSERT INTO enquiry_activity(enquiry_id,kind) VALUES ($1,'history_started')",
    [ids[1]],
  );
  status(await save(shown.token), 200);
  status(await save(shown.token), 409);
  equal((await policy()).enabled, true);
  const batches = await Promise.all([
    cleanExpiredEnquiries(),
    cleanExpiredEnquiries(),
  ]);
  equal(
    batches.sort((a, b) => a - b),
    [2, 100],
  );
  equal(
    (
      await db().query(
        "SELECT count(*)::int AS n FROM enquiries WHERE id=ANY($1::uuid[])",
        [ids],
      )
    ).rows[0].n,
    6,
  );
  equal(
    (
      await db().query(
        "SELECT count(*)::int AS n FROM enquiry_activity WHERE enquiry_id=$1",
        [ids[1]],
      )
    ).rows[0].n,
    0,
  );
  equal(
    (
      await db().query(
        "SELECT count(*)::int AS n FROM enquiry_deletions WHERE enquiry_id=ANY($1::uuid[])",
        [ids],
      )
    ).rows[0].n,
    102,
  );
  const marker = (
    await db().query("SELECT * FROM enquiry_deletions WHERE enquiry_id=$1", [
      ids[1],
    ])
  ).rows[0];
  equal(Object.keys(marker).sort(), ["deleted_at", "enquiry_id"]);
  status(await call("/admin/retention", "GET", undefined, true), 200);
  status(
    await call(
      "/api/admin/retention",
      "PUT",
      { days: 180, version: 2, enabled: false },
      true,
    ),
    200,
  );
  equal(await cleanExpiredEnquiries(), 0);
  // Manual deletion must produce the same recovery marker and remove associated history.
  status(
    await call(
      `/api/admin/enquiries/${edited}`,
      "DELETE",
      { version: 1 },
      true,
    ),
    200,
  );
  equal(
    (
      await db().query(
        "SELECT count(*)::int AS n FROM enquiry_deletions WHERE enquiry_id=$1",
        [edited],
      )
    ).rows[0].n,
    1,
  );
  await db().query("DELETE FROM enquiries WHERE id=ANY($1::uuid[])", [ids]);
  return checks;
}
