import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes, randomUUID } from "node:crypto";
import sharp from "sharp";
import { db } from "../../src/server/db.ts";
import { provisionOwner } from "../../src/server/provision.ts";
import { issueChallenge } from "../../src/server/spam.ts";
import { recommendAssessment } from "../../src/lib/assessment.ts";
import { sendNotification } from "../../src/server/mail.ts";
import { checkFollowUp } from "./follow-up.mjs";
import { checkRetention } from "./retention.mjs";

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
  const health = await call("/api/health");
  status(health, 200);
  assert.equal(health.headers.get("cache-control"), "no-store");
  assert.deepEqual(await health.json(), {
    status: "ok",
    release: process.env.RELEASE_ID || "development",
  });
  checks += 2;
  await db().query(
    "ALTER TABLE site_settings RENAME TO integration_site_settings",
  );
  try {
    const unavailable = await call("/api/health");
    status(unavailable, 503);
    assert.deepEqual(await unavailable.json(), { status: "unavailable" });
    checks++;
  } finally {
    await db().query(
      "ALTER TABLE integration_site_settings RENAME TO site_settings",
    );
  }
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
  // Public legal pages, owner-only editing, safe rendering and migration preservation.
  const legalOriginals = (
    await db().query("SELECT * FROM legal_pages ORDER BY slug")
  ).rows;
  assert.equal(legalOriginals.length, 2);
  checks++;
  for (const slug of ["privacy", "terms"]) {
    const page = await call(`/${slug}`);
    status(page, 200);
    const html = await page.text();
    assert.match(html, /Draft for review/);
    assert.match(html, /LEGAL_NAME/);
    assert.match(html, /name="robots" content="noindex/);
    assert.match(html, new RegExp(`rel="canonical" href="${base}/${slug}"`));
    checks += 4;
  }
  const settingsPage = await call("/admin/settings", "GET", undefined, true);
  status(settingsPage, 200);
  assert.match(await settingsPage.text(), /Save Privacy Policy/);
  checks++;
  const originalPrivacy = legalOriginals.find(
    (page) => page.slug === "privacy",
  );
  const legalUpdate = {
    title: "Reviewed privacy draft",
    content:
      "## Contact details\n\nA draft with enough detail for a meaningful review. ".repeat(
        5,
      ) + '<script>alert("legal-xss")</script>',
    isDraft: true,
    version: originalPrivacy.version,
  };
  status(await call("/api/admin/legal/privacy", "PUT", legalUpdate), 401);
  status(
    await call(
      "/api/admin/legal/privacy",
      "PUT",
      legalUpdate,
      true,
      "https://attacker.test",
    ),
    403,
  );
  status(await call("/api/admin/legal/unknown", "PUT", legalUpdate, true), 404);
  status(
    await call(
      "/api/admin/legal/privacy",
      "PUT",
      { ...legalUpdate, content: "too short" },
      true,
    ),
    400,
  );
  status(
    await call(
      "/api/admin/legal/privacy",
      "PUT",
      { ...legalUpdate, content: "x".repeat(60001) },
      true,
    ),
    400,
  );
  status(
    await call(
      "/api/admin/legal/privacy",
      "PUT",
      { ...legalUpdate, content: originalPrivacy.content, isDraft: false },
      true,
    ),
    400,
  );
  const legalSaved = await call(
    "/api/admin/legal/privacy",
    "PUT",
    legalUpdate,
    true,
  );
  status(legalSaved, 200);
  const legalVersion = (await legalSaved.json()).version;
  assert.equal(legalVersion, originalPrivacy.version + 1);
  checks++;
  status(await call("/api/admin/legal/privacy", "PUT", legalUpdate, true), 409);
  const updatedPrivacy = await (await call("/privacy")).text();
  assert.match(updatedPrivacy, /<title>Reviewed privacy draft/);
  assert.match(updatedPrivacy, /&lt;script&gt;/);
  assert.doesNotMatch(updatedPrivacy, /<script>alert/);
  checks += 3;
  await promisify(execFile)(
    process.execPath,
    ["--import", "tsx", "scripts/migrate.ts"],
    { env: process.env },
  );
  const preserved = (
    await db().query(
      "SELECT content,version FROM legal_pages WHERE slug='privacy'",
    )
  ).rows[0];
  assert.equal(preserved.content, legalUpdate.content);
  assert.equal(preserved.version, legalVersion);
  assert.equal(
    (await db().query("SELECT content FROM legal_pages WHERE slug='terms'"))
      .rows[0].content,
    legalOriginals.find((page) => page.slug === "terms").content,
  );
  checks += 3;
  status(
    await call(
      "/api/admin/legal/privacy",
      "PUT",
      { ...legalUpdate, isDraft: false, version: legalVersion },
      true,
    ),
    200,
  );
  const readyPrivacy = await (await call("/privacy")).text();
  assert.doesNotMatch(readyPrivacy, /Draft for review/);
  // Site-wide test mode still suppresses indexing even when a page is ready.
  assert.match(readyPrivacy, /name="robots" content="noindex/);
  checks += 2;
  for (const page of legalOriginals)
    await db().query(
      "UPDATE legal_pages SET title=$1,content=$2,is_draft=$3,version=$4,updated_at=$5 WHERE slug=$6",
      [
        page.title,
        page.content,
        page.is_draft,
        page.version,
        page.updated_at,
        page.slug,
      ],
    );
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
  assert.equal(rows[0].assessment, null);
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
      {
        status: "contacted",
        notes: "Private follow-up",
        nextAction: "",
        followUpDate: null,
        version: 1,
      },
      true,
      "https://attacker.test",
    ),
    403,
  );
  status(
    await call(
      `/api/admin/enquiries/${id}`,
      "PATCH",
      {
        status: "contacted",
        notes: "Private follow-up",
        nextAction: "",
        followUpDate: null,
        version: 1,
      },
      true,
    ),
    200,
  );
  status(
    await call(
      `/api/admin/enquiries/${id}`,
      "PATCH",
      {
        status: "closed",
        notes: "stale",
        nextAction: "",
        followUpDate: null,
        version: 1,
      },
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
    privacyUrl: "https://example.test/privacy",
    version: saved.version,
  };
  status(await call("/api/admin/settings", "PUT", newSettings, true), 200);
  status(await call("/api/admin/settings", "PUT", newSettings, true), 409);
  const home = await call("/");
  const html = await home.text();
  assert.match(html, /<title>A Longer Agency Name for Tomorrow/);
  assert.match(html, /public@example.test/);
  assert.match(html, /href="https:\/\/example.test\/privacy"/);
  assert.match(html, /href="\/terms"/);
  assert.match(await (await call("/privacy")).text(), /Privacy Policy/);
  checks += 3;
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
  const followUpChecks = await checkFollowUp({ call, status, enquiry, db });
  checks += followUpChecks;
  const retentionChecks = await checkRetention({ call, status, db });
  checks += retentionChecks;
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
  await db().query("DELETE FROM request_limits");
  for (let i = 0; i < 5; i++)
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
  // Complete assessments are private, validated and stored with a server-derived result.
  await db().query("DELETE FROM request_limits");
  const assessment = {
    version: 1,
    area: "other",
    teamSize: "mid",
    tools: "Private scheduling spreadsheet",
    workflowDescription:
      '<script>alert("assessment")</script> An unusual recurring task.',
    frequency: "occasionally",
    difficulty: "unsure",
    goal: "accuracy",
    timing: "exploring",
  };
  const assessedEnquiry = {
    ...enquiry,
    area: "other",
    teamSize: "mid",
    message: "",
    email: "assessed@example.test",
    token: issueChallenge(Date.now() - 3000),
    assessment: {
      ...assessment,
      recommendation: { title: "Forged recommendation" },
    },
  };
  for (const invalid of [
    {
      ...assessedEnquiry,
      assessment: { ...assessment, tools: "x".repeat(301) },
    },
    { ...assessedEnquiry, assessment: { ...assessment, version: 99 } },
    { ...assessedEnquiry, assessment: { ...assessment, goal: undefined } },
    { ...assessedEnquiry, area: "sales" },
    { ...assessedEnquiry, privacyAcknowledged: false },
    { ...assessedEnquiry, assessment: undefined },
  ])
    status(await call("/api/enquiries", "POST", invalid), 400);
  status(await call("/api/enquiries", "POST", assessedEnquiry), 201);
  status(await call("/api/enquiries", "POST", assessedEnquiry), 201);
  const assessedRows = (
    await db().query("SELECT * FROM enquiries WHERE email=$1", [
      assessedEnquiry.email,
    ])
  ).rows;
  assert.equal(assessedRows.length, 1);
  assert.equal(assessedRows[0].message, "");
  assert.equal(assessedRows[0].privacy_notice_version, "enquiry-v4");
  assert.deepEqual(assessedRows[0].assessment, {
    ...assessment,
    recommendation: recommendAssessment(assessment),
  });
  checks += 4;
  const assessedId = assessedRows[0].id;
  status(await call(`/admin/enquiries/${assessedId}`), 307);
  const assessedDetail = await call(
    `/admin/enquiries/${assessedId}`,
    "GET",
    undefined,
    true,
  );
  status(assessedDetail, 200);
  const assessmentHtml = await assessedDetail.text();
  assert.match(assessmentHtml, /Workflow assessment/);
  assert.match(assessmentHtml, /Private scheduling spreadsheet/);
  assert.match(assessmentHtml, /Start with a focused workflow review/);
  assert.match(assessmentHtml, /&lt;script&gt;/);
  assert.doesNotMatch(assessmentHtml, /<script>alert|Forged recommendation/);
  assert.doesNotMatch(
    await (await call("/")).text(),
    /Private scheduling spreadsheet/,
  );
  checks += 6;
  await sendNotification(assessedId);
  // The response task may already be sending; wait for the persisted outcome.
  for (let attempt = 0; attempt < 30; attempt++) {
    const notification = (
      await db().query(
        "SELECT notification_status FROM enquiries WHERE id=$1",
        [assessedId],
      )
    ).rows[0].notification_status;
    if (notification === "sent") break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(
    (
      await db().query(
        "SELECT notification_status FROM enquiries WHERE id=$1",
        [assessedId],
      )
    ).rows[0].notification_status,
    "sent",
  );
  checks++;
  status(
    await call(
      `/api/admin/enquiries/${assessedId}`,
      "DELETE",
      { version: 1 },
      true,
    ),
    200,
  );
  assert.equal(
    (await db().query("SELECT id FROM enquiries WHERE id=$1", [assessedId]))
      .rowCount,
    0,
  );
  checks++;
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
  const nextPassword = randomBytes(30).toString("base64url");
  const passwordInput = {
    currentPassword: password,
    newPassword: nextPassword,
    confirmPassword: nextPassword,
  };
  status(await call("/api/admin/password", "POST", passwordInput), 401);
  status(
    await call(
      "/api/admin/password",
      "POST",
      passwordInput,
      true,
      "https://attacker.test",
    ),
    403,
  );
  status(
    await call(
      "/api/admin/password",
      "POST",
      { ...passwordInput, confirmPassword: "does-not-match" },
      true,
    ),
    400,
  );
  status(
    await call(
      "/api/admin/password",
      "POST",
      { ...passwordInput, newPassword: "short", confirmPassword: "short" },
      true,
    ),
    400,
  );
  status(
    await call(
      "/api/admin/password",
      "POST",
      { ...passwordInput, currentPassword: "incorrect-current-password" },
      true,
    ),
    400,
  );
  const otherCookie = cookie;
  // Avoid the auth library's short sign-in burst limit while exercising two browsers.
  await db().query('DELETE FROM "rateLimit"');
  const anotherLogin = await signIn();
  status(anotherLogin, 200);
  cookie = anotherLogin.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const previousCookie = cookie;
  const changed = await call(
    "/api/admin/password",
    "POST",
    { ...passwordInput, revokeOtherSessions: false },
    true,
  );
  status(changed, 200);
  assert.equal((await changed.json()).token, undefined);
  checks++;
  cookie = changed.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  assert(cookie);
  checks++;
  const rotatedCookie = cookie;
  status(await call("/admin/account", "GET", undefined, true), 200);
  cookie = otherCookie;
  status(await call("/api/admin/password", "POST", passwordInput, true), 401);
  cookie = previousCookie;
  status(await call("/api/admin/settings", "PUT", newSettings, true), 401);
  cookie = rotatedCookie;
  await db().query('DELETE FROM "rateLimit"');
  status(await signIn(password), 401);
  status(await signIn(nextPassword), 200);
  // Password changes are throttled per owner even when IP headers change.
  for (let attempt = 0; attempt < 3; attempt++) {
    status(
      await call(
        "/api/admin/password",
        "POST",
        { ...passwordInput, currentPassword: "incorrect-current-password" },
        true,
      ),
      400,
    );
  }
  status(await call("/api/admin/password", "POST", passwordInput, true), 429);
  await provisionOwner(email, randomBytes(30).toString("base64url"), true);
  status(await call("/api/admin/settings", "PUT", newSettings, true), 401);
  await db().query("UPDATE site_settings SET data=$1,version=version+1", [
    JSON.stringify(saved.data),
  ]);
  console.log(
    `Passed ${checks} integration assertions: auth, ownership, editable legal pages, follow-up dates/history/receipts, enquiries, guided assessments, persistence, mail recovery, settings, logos, conflicts, deletion, rate limiting, password changes and session revocation.`,
  );
} finally {
  await db().end();
}
