import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function checkInboxStatus({ call, status, db }) {
  const ids = Array.from({ length: 4 }, () => randomUUID());
  const [fresh, active, closed, untouched] = ids;
  const ref = (id, version = 1) => ({ id, version });
  const patch = (target, enquiries, auth = true, origin) =>
    call(
      "/api/admin/enquiries/status",
      "PATCH",
      { status: target, enquiries },
      auth,
      origin,
    );
  const state = async (id) =>
    (
      await db().query(
        `SELECT status,version,notes,next_action,follow_up_on::text AS due,closed_at,
      (SELECT status FROM prospect_jobs WHERE enquiry_id=e.id) AS job,
      (SELECT count(*)::int FROM enquiry_activity WHERE enquiry_id=e.id) AS events
     FROM enquiries e WHERE id=$1`,
        [id],
      )
    ).rows[0];
  try {
    await db().query(
      `INSERT INTO enquiries (id,submission_id,name,email,area,team_size,message,privacy_notice_version,status,notes)
       SELECT id,gen_random_uuid(),'Inbox fixture','inbox@example.test','other','small','Test','test',status,'Private note'
       FROM unnest($1::uuid[],$2::text[]) AS fixtures(id,status)`,
      [ids, ["new", "in_progress", "closed", "new"]],
    );
    await db().query(
      "UPDATE enquiries SET next_action='Call back',follow_up_on='2030-01-10' WHERE id=$1",
      [fresh],
    );
    await db().query(
      "INSERT INTO prospect_jobs (id,enquiry_id) VALUES (gen_random_uuid(),$1)",
      [fresh],
    );

    status(await patch("closed", [ref(fresh)], false), 401);
    status(
      await patch("closed", [ref(fresh)], true, "https://other.example"),
      403,
    );
    status(await patch("unknown", [ref(fresh)]), 400);
    for (const selection of [
      [],
      [ref("invalid")],
      [ref(fresh, 0)],
      [ref(fresh), ref(fresh)],
      Array.from({ length: 21 }, () => ref(randomUUID())),
    ])
      status(await patch("closed", selection), 400);

    const before = await state(fresh);
    const untouchedBefore = await state(untouched);
    for (const other of [ref(active, 2), ref(randomUUID())]) {
      status(await patch("closed", [ref(fresh), other]), 409);
      assert.deepEqual(await state(fresh), before);
    }
    const moved = await patch("in_progress", [
      ref(fresh),
      ref(active),
      ref(closed),
    ]);
    status(moved, 200);
    assert.deepEqual(await moved.json(), { updated: 2, unchanged: 1 });
    assert.deepEqual(await state(fresh), {
      ...before,
      status: "in_progress",
      version: 2,
      events: 1,
    });
    assert.equal((await state(closed)).closed_at, null);
    assert.equal((await state(active)).version, 1);
    assert.equal((await state(active)).events, 0);

    // Overlapping selections in two tabs can commit only once.
    const pair = [ref(fresh, 2), ref(closed, 2)];
    const results = await Promise.all([
      patch("closed", pair),
      patch("closed", [...pair].reverse()),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const after = await state(fresh);
    assert.ok(after.closed_at);
    assert.deepEqual(after, {
      ...before,
      status: "closed",
      version: 3,
      next_action: "",
      due: null,
      closed_at: after.closed_at,
      job: "cancelled",
      events: 3,
    });
    const events = await db().query(
      "SELECT kind,details FROM enquiry_activity WHERE enquiry_id=$1 ORDER BY id",
      [fresh],
    );
    assert.deepEqual(
      events.rows.map((e) => e.kind),
      ["status_changed", "status_changed", "follow_up_cleared"],
    );
    assert.deepEqual(events.rows[1].details, {
      from: "in_progress",
      to: "closed",
    });
    status(await patch("contacted", [ref(fresh, 3)]), 200);
    assert.equal((await state(fresh)).closed_at, null);
    status(await patch("new", [ref(fresh, 4)]), 200);
    assert.deepEqual(await state(untouched), untouchedBefore);
  } finally {
    await db().query("DELETE FROM enquiries WHERE id=ANY($1::uuid[])", [ids]);
  }
}
