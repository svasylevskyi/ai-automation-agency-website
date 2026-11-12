import assert from "node:assert/strict";
import { test } from "node:test";
import nodemailer from "nodemailer";
import { env } from "../src/server/env.ts";
import { deliverMail, MailDeliveryError } from "../src/server/mail-delivery.ts";
import { confirmationMessage } from "../src/lib/confirmation.ts";

const base = {
  DATABASE_URL: "postgresql://test:test@localhost/agency_test",
  APP_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-only-secret-with-at-least-32-characters",
};
const live = {
  ...base,
  MAIL_PROVIDER: "resend",
  RESEND_API_KEY: "re_test_only_never_a_real_key",
  MAIL_FROM: "website@mail.get-automated.ai",
  NOTIFICATION_EMAIL: "hello@get-automated.ai",
};
const message = {
  ...confirmationMessage({
    name: "Get Automated",
    contactEmail: "hello@get-automated.ai",
    bookingUrl: "",
  }),
  from: live.MAIL_FROM,
  to: "visitor@example.test",
  messageId: "<enquiry-confirmation-123@get-automated.ai>",
  headers: {
    "Auto-Submitted": "auto-generated",
    "X-Auto-Response-Suppress": "All",
  },
};
const providerId = "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794";

test("legacy SMTP configuration remains the default; MAIL_FROM overrides it", () => {
  assert.equal(env(base).MAIL_PROVIDER, "smtp");
  assert.equal(env(base).MAIL_FROM, "website@example.test");
  assert.equal(
    env({ ...base, SMTP_FROM: "old@example.test" }).MAIL_FROM,
    "old@example.test",
  );
  assert.equal(
    env({
      ...base,
      SMTP_FROM: "old@example.test",
      MAIL_FROM: "new@example.test",
    }).MAIL_FROM,
    "new@example.test",
  );
  assert.equal(
    env({ ...live, MAIL_FROM: "", SMTP_FROM: live.MAIL_FROM }).MAIL_FROM,
    live.MAIL_FROM,
  );
});

test("Resend requires a key and real configured sender and notification addresses", () => {
  assert.equal(env(live).MAIL_PROVIDER, "resend");
  for (const change of [
    { RESEND_API_KEY: "" },
    { RESEND_API_KEY: "REPLACE_WITH_KEY" },
    { MAIL_FROM: "website@example.test" },
    { MAIL_FROM: "onboarding@resend.dev" },
    { MAIL_FROM: "website@sub.example.com" },
    { NOTIFICATION_EMAIL: "owner@example.invalid" },
    { MAIL_PROVIDER: "typo" },
    { MAIL_FROM: "bad\nBcc: attacker@evil.com" },
  ]) {
    assert.throws(
      () => env({ ...live, ...change }),
      (error) => {
        assert.doesNotMatch(
          error.message,
          /re_test_only_never_a_real_key|attacker@/,
        );
        return true;
      },
    );
  }
});

test("Resend sends receipts with the business Reply-To and stable retry keys", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    return Response.json({ id: providerId });
  });
  const config = env(live);
  assert.deepEqual(await deliverMail(config, message), {
    provider: "resend",
    providerMessageId: providerId,
  });
  await deliverMail(config, message);
  await deliverMail(config, {
    ...message,
    messageId: "<enquiry-confirmation-456@get-automated.ai>",
  });
  await deliverMail(config, {
    ...message,
    from: "website@updates.get-automated.ai",
  });
  const { url, options } = calls[0];
  assert.equal(url, "https://api.resend.com/emails");
  assert.equal(options.method, "POST");
  assert.equal(options.redirect, "error");
  assert.equal(options.cache, "no-store");
  assert(options.signal instanceof AbortSignal);
  assert.equal(options.headers.Authorization, `Bearer ${live.RESEND_API_KEY}`);
  assert.equal(
    options.headers["Idempotency-Key"],
    calls[1].options.headers["Idempotency-Key"],
  );
  assert.notEqual(
    options.headers["Idempotency-Key"],
    calls[2].options.headers["Idempotency-Key"],
  );
  assert.notEqual(
    options.headers["Idempotency-Key"],
    calls[3].options.headers["Idempotency-Key"],
  );
  assert.equal(options.body, calls[1].options.body);
  const payload = JSON.parse(options.body);
  assert.equal(payload.reply_to, "hello@get-automated.ai");
  assert.deepEqual(payload.to, [message.to]);
  assert.equal(payload.text, message.text);
  assert.deepEqual(payload.headers, {
    ...message.headers,
    "Message-ID": message.messageId,
  });
  assert.equal(payload.from, live.MAIL_FROM);
});

test("Resend failures and malformed successes fail closed without leaking provider errors", async (t) => {
  let respond;
  t.mock.method(globalThis, "fetch", async () => respond());
  for (const code of [401, 403, 409, 422, 429, 500]) {
    respond = () =>
      Response.json({ message: "PRIVATE RECIPIENT AND KEY" }, { status: code });
    await assert.rejects(deliverMail(env(live), message), (error) => {
      assert(error instanceof MailDeliveryError);
      assert.equal(error.code, `resend_http_${code}`);
      assert.doesNotMatch(error.message, /PRIVATE/);
      return true;
    });
  }
  for (const payload of [{}, { id: "" }, { id: "PRIVATE RECIPIENT" }]) {
    respond = () => Response.json(payload);
    await assert.rejects(deliverMail(env(live), message), {
      code: "resend_invalid_response",
    });
  }
  respond = () => new Response("not json");
  await assert.rejects(deliverMail(env(live), message), {
    code: "resend_request_failed",
  });
  respond = () => {
    throw new Error("PRIVATE NETWORK ERROR");
  };
  await assert.rejects(deliverMail(env(live), message), {
    code: "resend_request_failed",
  });
});

test("SMTP keeps TLS rules, passes Reply-To, rejects unaccepted sends and closes on failure", async (t) => {
  const transports = [];
  let outcome = "accepted";
  t.mock.method(nodemailer, "createTransport", (options) => {
    const call = { options, closed: false };
    transports.push(call);
    return {
      sendMail: async (sent) => {
        assert.deepEqual(sent, message);
        if (outcome === "throw") throw new Error("PRIVATE SMTP ERROR");
        return { accepted: outcome === "accepted" ? [sent.to] : [] };
      },
      close: () => {
        call.closed = true;
      },
    };
  });
  assert.deepEqual(await deliverMail(env(base), message), { provider: "smtp" });
  assert.equal(transports[0].options.requireTLS, false);
  const remote = env({
    ...base,
    SMTP_HOST: "smtp.provider.test",
    SMTP_PORT: "587",
    SMTP_USER: "user",
    SMTP_PASSWORD: "test_password",
  });
  await deliverMail(remote, message);
  assert.equal(transports[1].options.requireTLS, true);
  assert.equal(transports[1].options.disableFileAccess, true);
  assert.equal(transports[1].options.disableUrlAccess, true);
  assert.deepEqual(transports[1].options.auth, {
    user: "user",
    pass: "test_password",
  });
  await deliverMail(
    { ...remote, SMTP_PORT: 465, SMTP_SECURE: "true" },
    message,
  );
  assert.equal(transports[2].options.secure, true);
  assert.equal(transports[2].options.requireTLS, false);
  outcome = "empty";
  await assert.rejects(deliverMail(env(base), message), {
    code: "smtp_not_accepted",
  });
  outcome = "throw";
  await assert.rejects(deliverMail(env(base), message), {
    code: "smtp_request_failed",
  });
  assert(transports.every((transport) => transport.closed));
});
