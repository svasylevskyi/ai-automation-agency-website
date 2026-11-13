import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function checkAdminEmail({ base, email, password, db }) {
  let checks = 0;
  const request = (path, data, cookie = "", origin = base, extraHeaders = {}) =>
    fetch(base + path, {
      method: data === undefined ? "GET" : "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        Cookie: cookie,
        ...extraHeaders,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  const status = (response, expected) => {
    assert.equal(response.status, expected);
    checks++;
  };
  const login = async (address) => {
    await db().query('DELETE FROM "rateLimit"');
    return request("/api/auth/sign-in/email", { email: address, password });
  };
  const cookies = (response) =>
    response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
  await db().query("DELETE FROM request_limits");
  const firstLogin = await login(email);
  status(firstLogin, 200);
  const currentCookie = cookies(firstLogin);
  const secondLogin = await login(email);
  status(secondLogin, 200);
  const otherCookie = cookies(secondLogin);
  const owner = (
    await db().query(
      'SELECT u.*, a.password FROM site_owner o JOIN "user" u ON u.id=o.user_id JOIN account a ON a."userId"=u.id',
    )
  ).rows[0];
  const accounts = (
    await db().query('SELECT * FROM account WHERE "userId"=$1 ORDER BY id', [
      owner.id,
    ])
  ).rows;
  const settings = (await db().query("SELECT * FROM site_settings")).rows;
  const newEmail = `updated-${randomUUID()}@example.test`;
  const input = {
    currentEmail: email,
    newEmail,
    confirmEmail: newEmail,
    currentPassword: password,
  };
  const path = "/api/admin/email";
  status(await request(path, input), 401);
  status(
    await request(path, input, currentCookie, "https://attacker.test"),
    403,
  );
  status(
    await request(path, input, currentCookie, base, {
      "Content-Type": "text/plain",
    }),
    415,
  );
  status(
    await request(path, { ...input, extra: "x".repeat(8001) }, currentCookie),
    413,
  );
  for (const change of [
    { newEmail: "invalid" },
    { confirmEmail: "does-not-match@example.test" },
    { newEmail: email.toUpperCase(), confirmEmail: email },
    { currentPassword: "" },
  ])
    status(await request(path, { ...input, ...change }, currentCookie), 400);
  status(
    await request(
      path,
      { ...input, currentEmail: "stale@example.test" },
      currentCookie,
    ),
    409,
  );
  const incorrect = await request(
    path,
    { ...input, currentPassword: "incorrect-password" },
    currentCookie,
  );
  status(incorrect, 400);
  assert.equal(
    (await incorrect.json()).error,
    "Your current password is incorrect.",
  );
  checks++;

  const otherId = randomUUID();
  const takenEmail = `taken-${randomUUID()}@example.test`;
  try {
    await db().query(
      'INSERT INTO "user" (id,name,email,"emailVerified","createdAt","updatedAt") VALUES ($1,\'Not the owner\',$2,true,now(),now())',
      [otherId, takenEmail],
    );
    await db().query(
      'INSERT INTO account (id,"accountId","providerId","userId",password,"createdAt","updatedAt") VALUES ($1,$2,\'credential\',$2,$3,now(),now())',
      [randomUUID(), otherId, owner.password],
    );
    const nonOwnerLogin = await login(takenEmail);
    status(nonOwnerLogin, 200);
    status(
      await request(
        path,
        { ...input, currentEmail: takenEmail },
        cookies(nonOwnerLogin),
      ),
      401,
    );
    status(
      await request(
        path,
        {
          ...input,
          newEmail: takenEmail.toUpperCase(),
          confirmEmail: takenEmail,
        },
        currentCookie,
      ),
      409,
    );
    // A legacy mixed-case address must also be detected before updating.
    await db().query('UPDATE "user" SET email=$1 WHERE id=$2', [
      takenEmail.toUpperCase(),
      otherId,
    ]);
    status(
      await request(
        path,
        { ...input, newEmail: takenEmail, confirmEmail: takenEmail },
        currentCookie,
      ),
      409,
    );
  } finally {
    await db().query('DELETE FROM "user" WHERE id=$1', [otherId]);
  }
  assert.equal(
    (await db().query('SELECT email FROM "user" WHERE id=$1', [owner.id]))
      .rows[0].email,
    email,
  );
  checks++;
  for (const blocked of [
    "/api/auth/change-email",
    "/api/auth/update-user",
    "/api/auth/verify-password",
  ])
    status(
      await request(
        blocked,
        { email: newEmail, newEmail, password },
        currentCookie,
      ),
      404,
    );

  const changed = await request(
    path,
    {
      ...input,
      newEmail: ` ${newEmail.toUpperCase()} `,
      userId: otherId,
      revokeOtherSessions: false,
    },
    currentCookie,
  );
  status(changed, 200);
  assert.equal(changed.headers.get("cache-control"), "no-store");
  assert(
    changed.headers.getSetCookie().some((value) => /max-age=0/i.test(value)),
  );
  assert.equal((await changed.json()).token, undefined);
  const updated = (
    await db().query('SELECT * FROM "user" WHERE id=$1', [owner.id])
  ).rows[0];
  assert.equal(updated.email, newEmail);
  assert.equal(updated.emailVerified, false);
  assert.equal(
    (await db().query("SELECT user_id FROM site_owner")).rows[0].user_id,
    owner.id,
  );
  assert.deepEqual(
    (
      await db().query('SELECT * FROM account WHERE "userId"=$1 ORDER BY id', [
        owner.id,
      ])
    ).rows,
    accounts,
  );
  assert.deepEqual(
    (await db().query("SELECT * FROM site_settings")).rows,
    settings,
  );
  assert.equal(
    (await db().query('SELECT id FROM session WHERE "userId"=$1', [owner.id]))
      .rowCount,
    0,
  );
  checks += 9;
  status(await request(path, input, currentCookie), 401);
  status(await request(path, input, otherCookie), 401);
  status(await request("/admin/admin-account", undefined, currentCookie), 307);
  status(await login(email), 401);
  const newLogin = await login(newEmail);
  status(newLogin, 200);
  const newCookie = cookies(newLogin);
  const accountPage = await request(
    "/admin/admin-account",
    undefined,
    newCookie,
  );
  status(accountPage, 200);
  const html = await accountPage.text();
  assert(html.includes(newEmail));
  assert.match(html, /Change your email address/);
  assert.match(html, /Change your password/);
  assert.match(
    await (await request("/admin/login?emailChanged=1")).text(),
    /Sign in with your new email address/,
  );
  checks += 4;
  await db().query("DELETE FROM request_limits");
  const restore = {
    ...input,
    currentEmail: newEmail,
    newEmail: email,
    confirmEmail: email,
  };
  for (let attempt = 0; attempt < 5; attempt++)
    status(
      await request(
        path,
        { ...restore, currentPassword: "incorrect-password" },
        newCookie,
        base,
        { "x-forwarded-for": `192.0.2.${attempt + 1}` },
      ),
      400,
    );
  const limited = await request(path, restore, newCookie);
  status(limited, 429);
  assert(Number(limited.headers.get("retry-after")) > 0);
  checks++;
  await db().query("DELETE FROM request_limits");
  const competing = await Promise.all([
    request(path, restore, newCookie),
    request(path, restore, newCookie),
  ]);
  assert.deepEqual(
    competing.map((response) => response.status).sort(),
    [200, 401],
  );
  assert.equal(
    (await db().query('SELECT email FROM "user" WHERE id=$1', [owner.id]))
      .rows[0].email,
    email,
  );
  checks += 2;
  status(await request(path, restore, newCookie), 401);
  status(await login(email), 200);
  return checks;
}
