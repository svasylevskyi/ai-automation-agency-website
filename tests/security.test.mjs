import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import {
  enquirySchema,
  settingsSchema,
  enquiryUpdateSchema,
} from "../src/lib/validation.ts";
import {
  issueChallenge,
  verifyChallenge,
  clientKey,
} from "../src/server/spam.ts";
import { sameOrigin, readJson, readBody } from "../src/server/http.ts";
import { prepareLogo } from "../src/server/uploads.ts";
import sharp from "sharp";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost/agency_test";
process.env.APP_URL ??= "http://localhost:3000";
process.env.BETTER_AUTH_SECRET ??= randomBytes(48).toString("base64url");

test("enquiries require bounded content, a reply address and data-use acknowledgement", () => {
  const valid = {
    name: "Test Owner",
    email: "Owner@example.test",
    company: "",
    area: "sales",
    teamSize: "small",
    message: "Please help us simplify our incoming enquiries.",
    privacyAcknowledged: true,
    website: "",
    token: "x".repeat(50),
  };
  assert.equal(enquirySchema.parse(valid).email, "owner@example.test");
  for (const change of [
    { email: "invalid" },
    { message: "too short" },
    { message: "x".repeat(5001) },
    { privacyAcknowledged: false },
    { area: "arbitrary" },
  ])
    assert.equal(
      enquirySchema.safeParse({ ...valid, ...change }).success,
      false,
    );
  assert.equal(
    enquiryUpdateSchema.safeParse({ status: "made-up", notes: "", version: 1 })
      .success,
    false,
  );
});
test("booking/privacy URLs reject scripts, credentials and plain HTTP", () => {
  const base = {
    name: "My agency",
    description: "A useful description of this agency.",
    tagline: "Practical automation",
    contactEmail: "",
    bookingUrl: "",
    privacyUrl: "",
    showName: true,
    logoId: null,
  };
  for (const value of [
    "javascript:alert(1)",
    "http://example.test",
    "https://user:pass@example.test",
  ])
    assert.equal(
      settingsSchema.safeParse({ ...base, bookingUrl: value }).success,
      false,
    );
  assert.equal(
    settingsSchema.safeParse({
      ...base,
      bookingUrl: "https://example.test/book",
    }).success,
    true,
  );
});
test("form challenge rejects tampering, immediate submits and expired tokens", () => {
  const now = Date.now();
  const token = issueChallenge(now);
  assert.throws(() => verifyChallenge(token, now + 1000));
  assert.throws(() => verifyChallenge(token, now + 3600001));
  assert.throws(() => verifyChallenge(token + "x", now + 3000));
  assert.throws(() => verifyChallenge("malformed", now + 3000));
  assert.match(verifyChallenge(token, now + 3000), /^[a-f0-9-]{36}$/);
});
test("mutating requests require an exact configured origin", () => {
  for (const origin of [
    null,
    "http://attacker.test",
    "http://localhost:3000.attacker.test",
  ])
    assert.throws(() =>
      sameOrigin(
        new Request("http://localhost:3000/api/admin/settings", {
          headers: origin ? { origin } : {},
        }),
      ),
    );
  assert.doesNotThrow(() =>
    sameOrigin(
      new Request("http://localhost:3000/api/admin/settings", {
        headers: { origin: process.env.APP_URL },
      }),
    ),
  );
});
test("forwarded client addresses are ignored unless explicitly trusted", () => {
  process.env.TRUSTED_IP_HEADER = "";
  assert.equal(
    clientKey(new Headers({ "x-forwarded-for": "192.0.2.1" })),
    "local-or-unidentified",
  );
  process.env.TRUSTED_IP_HEADER = "x-client-ip";
  assert.equal(
    clientKey(new Headers({ "x-client-ip": "192.0.2.1" })),
    "192.0.2.1",
  );
  assert.equal(
    clientKey(new Headers({ "x-client-ip": "192.0.2.1, 198.51.100.2" })),
    "local-or-unidentified",
  );
  process.env.TRUSTED_IP_HEADER = "";
});
test("streamed request bodies enforce size limits and JSON type", async () => {
  await assert.rejects(
    readBody(
      new Request("http://localhost", { method: "POST", body: "123456" }),
      5,
    ),
    /too large/,
  );
  await assert.rejects(
    readJson(new Request("http://localhost", { method: "POST", body: "{}" })),
    /JSON/,
  );
  await assert.rejects(
    readJson(
      new Request("http://localhost", {
        method: "POST",
        body: "{invalid",
        headers: { "content-type": "application/json" },
      }),
    ),
    /could not be read/,
  );
});
test("logo uploads reject active SVG and invalid images, re-encode supported pixels", async () => {
  await assert.rejects(
    prepareLogo(Buffer.from('<svg onload="alert(1)"/>')),
    /SVG/,
  );
  await assert.rejects(
    prepareLogo(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    /could not be read/,
  );
  const source = await sharp({
    create: { width: 2000, height: 1000, channels: 4, background: "#8866aa" },
  })
    .png()
    .toBuffer();
  const result = await prepareLogo(source);
  assert.equal(result.width, 1024);
  assert.equal(result.height, 512);
  assert.equal((await sharp(result.data).metadata()).format, "png");
});
