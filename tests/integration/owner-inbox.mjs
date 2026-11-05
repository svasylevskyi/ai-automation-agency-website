import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import sharp from "sharp";
import { db } from "../../src/server/db.ts";
import { provisionOwner } from "../../src/server/provision.ts";
import { issueChallenge } from "../../src/server/spam.ts";
import { sendNotification } from "../../src/server/mail.ts";

if (!new URL(process.env.DATABASE_URL).pathname.endsWith("_test"))
  throw new Error(
    "Integration tests require a dedicated database ending in _test.",
  );
const base = process.env.APP_URL;
const password = randomBytes(30).toString("base64url");
const email = `owner-${randomUUID()}@example.test`;
let cookie = "";
let checks = 0;
async function call(
  path,
  method = "GET",
  data,
  authenticated = false,
  origin = base,
) {
  return fetch(base + path, {
    method,
    redirect: "manual",
    headers: {
      ...(method !== "GET"
        ? { "Content-Type": "application/json", Origin: origin }
        : {}),
      ...(authenticated ? { Cookie: cookie } : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}
function status(response, expected) {
  assert.equal(response.status, expected);
  checks++;
}
async function signIn(pwd = password) {
  const response = await call("/api/auth/sign-in/email", "POST", {
    email,
    password: pwd,
  });
  return response;
}
try {
  await db().query("DELETE FROM site_owner");
  await db().query('DELETE FROM "user"');
  await db().query("DELETE FROM enquiries");
  await db().query("DELETE FROM request_limits");
  await provisionOwner(email, password);
  await assert.rejects(
    provisionOwner("someone@example.test", password),
    /already exists/,
  );
  checks++;
  status(await call("/admin"), 307);
  status(await call("/api/admin/settings", "PUT", {}), 401);
  status(await call("/api/admin/logo", "POST", {}), 401);
  status(
    await call("/api/auth/sign-up/email", "POST", {
      email: "visitor@example.test",
      password,
      name: "Visitor",
    }),
    404,
  );
  status(await signIn("invalid-password"), 401);
  const login = await signIn();
  status(login, 200);
  const cookies = login.headers.getSetCookie();
  assert(cookies.some((c) => /httponly/i.test(c) && /samesite=lax/i.test(c)));
  checks++;
  cookie = cookies.map((c) => c.split(";")[0]).join("; ");
  status(await call("/admin", "GET", undefined, true), 200);
  const ownerId = (await db().query("SELECT user_id FROM site_owner")).rows[0]
    .user_id;
  await db().query("DELETE FROM site_owner");
  status(await call("/admin", "GET", undefined, true), 307);
  status(await call("/api/admin/settings", "PUT", {}, true), 401);
  await db().query("INSERT INTO site_owner(user_id) VALUES ($1)", [ownerId]);
  const token = issueChallenge(Date.now() - 3000);
  const enquiry = {
    name: "Integration Visitor",
    email: "visitor@example.test",
    company: "Test agency",
    area: "sales",
    teamSize: "small",
    message:
      "We manually copy each enquiry into our CRM and need a better flow.",
    privacyAcknowledged: true,
    website: "",
    token,
  };
  status(
    await call(
      "/api/enquiries",
      "POST",
      enquiry,
      false,
      "https://attacker.test",
    ),
    403,
  );
  status(
    await call("/api/enquiries", "POST", {
      ...enquiry,
      privacyAcknowledged: false,
    }),
    400,
  );
  status(
    await call("/api/enquiries", "POST", {
      ...enquiry,
      token: token + "tampered",
    }),
    400,
  );
  status(
    await call("/api/enquiries", "POST", { ...enquiry, website: "bot.test" }),
    201,
  );
  assert.equal(
    (await db().query("SELECT count(*) FROM enquiries")).rows[0].count,
    "0",
  );
  checks++;
  status(await call("/api/enquiries", "POST", enquiry), 201);
  status(await call("/api/enquiries", "POST", enquiry), 201);
  const rows = (await db().query("SELECT * FROM enquiries")).rows;
  assert.equal(rows.length, 1);
  checks++;
  const id = rows[0].id;
  status(
    await call(`/api/admin/enquiries/${id}`, "PATCH", {
      status: "contacted",
      notes: "Private follow-up",
      version: 1,
    }),
    401,
  );
  status(
    await call(
      `/api/admin/enquiries/${id}`,
      "PATCH",
      { status: "contacted", notes: "Private follow-up", version: 1 },
      true,
      "https://attacker.test",
    ),
    403,
  );
  status(
    await call(
      `/api/admin/enquiries/${id}`,
      "PATCH",
      { status: "contacted", notes: "Private follow-up", version: 1 },
      true,
    ),
    200,
  );
  status(
    await call(
      `/api/admin/enquiries/${id}`,
      "PATCH",
      { status: "closed", notes: "stale", version: 1 },
      true,
    ),
    409,
  );
  const detail = await call(`/admin/enquiries/${id}`, "GET", undefined, true);
  status(detail, 200);
  assert.match(await detail.text(), /Private follow-up/);
  checks++;
  const filter = await call("/admin?status=closed", "GET", undefined, true);
  assert.doesNotMatch(await filter.text(), /Integration Visitor/);
  checks++;
  const saved = (await db().query("SELECT data,version FROM site_settings"))
    .rows[0];
  const newSettings = {
    ...saved.data,
    name: "A Longer Agency Name for Tomorrow",
    contactEmail: "public@example.test",
    bookingUrl: "https://example.test/book",
    version: saved.version,
  };
  status(await call("/api/admin/settings", "PUT", newSettings, true), 200);
  status(await call("/api/admin/settings", "PUT", newSettings, true), 409);
  const home = await call("/");
  const html = await home.text();
  assert.match(html, /<title>A Longer Agency Name for Tomorrow/);
  assert.match(html, /public@example.test/);
  assert.doesNotMatch(html, /Private follow-up/);
  checks++;
  const png = await sharp({
    create: { width: 360, height: 100, channels: 4, background: "#7045aa" },
  })
    .png()
    .toBuffer();
  const upload = await fetch(base + "/api/admin/logo", {
    method: "POST",
    headers: { Cookie: cookie, Origin: base, "Content-Type": "image/png" },
    body: png,
  });
  status(upload, 200);
  const logo = await upload.json();
  const image = await call(`/api/brand-logo/${logo.id}`);
  status(image, 200);
  assert.equal(image.headers.get("content-type"), "image/png");
  checks++;
  status(
    await call(
      "/api/admin/settings",
      "PUT",
      { ...newSettings, version: saved.version + 1, logoId: logo.id },
      true,
    ),
    200,
  );
  assert.match(
    await (await call("/")).text(),
    new RegExp(`/api/brand-logo/${logo.id}`),
  );
  checks++;
  const unsafe = await fetch(base + "/api/admin/logo", {
    method: "POST",
    headers: { Cookie: cookie, Origin: base, "Content-Type": "image/svg+xml" },
    body: '<svg onload="alert(1)"/>',
  });
  status(unsafe, 400);
  // A mail outage must not lose the saved enquiry; retry is idempotent once sent.
  await db().query(
    "UPDATE enquiries SET notification_status='pending' WHERE id=$1",
    [id],
  );
  const oldPort = process.env.SMTP_PORT;
  process.env.SMTP_PORT = "1026";
  await sendNotification(id);
  process.env.SMTP_PORT = oldPort;
  assert.equal(
    (
      await db().query(
        "SELECT notification_status FROM enquiries WHERE id=$1",
        [id],
      )
    ).rows[0].notification_status,
    "failed",
  );
  checks++;
  status(
    await call(`/api/admin/enquiries/${id}/notification`, "POST", {}, true),
    200,
  );
  assert.equal(
    (
      await db().query(
        "SELECT notification_status FROM enquiries WHERE id=$1",
        [id],
      )
    ).rows[0].notification_status,
    "sent",
  );
  checks++;
  // New submissions hit a persistent limit, while retrying the same token remains safe.
  for (let i = 0; i < 4; i++)
    await call("/api/enquiries", "POST", {
      ...enquiry,
      email: `limit${i}@example.test`,
      token: issueChallenge(Date.now() - 3000),
    });
  status(
    await call("/api/enquiries", "POST", {
      ...enquiry,
      email: "limited@example.test",
      token: issueChallenge(Date.now() - 3000),
    }),
    429,
  );
  status(await call("/api/enquiries", "POST", enquiry), 201);
  status(
    await call(`/api/admin/enquiries/${id}`, "DELETE", { version: 1 }, true),
    409,
  );
  status(
    await call(`/api/admin/enquiries/${id}`, "DELETE", { version: 2 }, true),
    200,
  );
  status(await call(`/admin/enquiries/${id}`, "GET", undefined, true), 404);
  status(await call("/api/auth/sign-out", "POST", {}, true), 200);
  status(await call("/api/admin/settings", "PUT", newSettings, true), 401);
  const login2 = await signIn();
  status(login2, 200);
  cookie = login2.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  await provisionOwner(email, randomBytes(30).toString("base64url"), true);
  status(await call("/api/admin/settings", "PUT", newSettings, true), 401);
  await db().query("UPDATE site_settings SET data=$1,version=version+1", [
    JSON.stringify(saved.data),
  ]);
  console.log(
    `Passed ${checks} integration assertions: auth, ownership, enquiries, persistence, mail recovery, settings, logos, conflicts, deletion, rate limiting and session revocation.`,
  );
} finally {
  await db().end();
}
