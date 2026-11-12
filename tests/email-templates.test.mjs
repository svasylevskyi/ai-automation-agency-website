import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import {
  confirmationMessage,
  confirmationPayloadSchema,
} from "../src/lib/confirmation.ts";
import { notificationMessage } from "../src/lib/notification.ts";

const origin = "https://get-automated.ai";
const brand = {
  name: "Get Automated",
  tagline: "Practical intelligence. Human ambition.",
  contactEmail: "hello@get-automated.ai",
  bookingUrl: "",
};

test("acknowledgements use a neutral greeting and branded sign-off in both formats", () => {
  for (const [name, greeting] of [
    ["Stepan", "Hello Stepan,"],
    ["  María   José O’Neill  ", "Hello María José O’Neill,"],
    ["Alex\r\nTaylor", "Hello Alex Taylor,"],
    [undefined, "Hello,"],
    ["", "Hello,"],
    [" \t\n ", "Hello,"],
  ]) {
    const message = confirmationMessage(brand, origin, name);
    assert(confirmationPayloadSchema.safeParse(message).success);
    assert.equal(message.text.split("\n\n")[0], greeting);
    assert.match(message.text, /Best regards,\nGet Automated/);
    const document = new JSDOM(message.html).window.document;
    assert(document.body.textContent.includes(greeting));
    assert(document.body.textContent.includes("Best regards,"));
    assert(document.body.textContent.includes(brand.name));
    assert.equal(
      document.querySelector("img").src,
      `${origin}/brand/email-mark.png`,
    );
    assert.equal(message.replyTo, brand.contactEmail);
    assert.equal(document.documentElement.lang, "en");
    assert.equal(document.querySelectorAll("h1").length, 1);
  }
});

test("names and branding cannot inject HTML, links, images or headers", () => {
  const name = '<img src="https://attacker.test" onerror="alert(1)"> & Eve';
  const message = confirmationMessage(
    { ...brand, name: "Agency <script>alert(2)</script> & Co" },
    origin,
    name,
  );
  const document = new JSDOM(message.html).window.document;
  assert(document.body.textContent.includes(`Hello ${name},`));
  assert.equal(
    document.querySelectorAll("script,iframe,form,[onerror]").length,
    0,
  );
  assert.equal(document.querySelectorAll("img").length, 1);
  assert(
    [...document.querySelectorAll("a")].every((link) => link.origin === origin),
  );
  assert(!message.subject.includes(name));
  assert(!message.replyTo.includes(name));
  assert.equal(
    confirmationMessage(brand, origin, "x".repeat(1000)).text.split("\n\n")[0]
      .length,
    107,
  );
});

test("optional booking links are escaped correctly and missing contact email keeps the fallback instructions", () => {
  const bookingUrl = "https://calendar.example.test/book?a=1&b=2";
  const message = confirmationMessage({ ...brand, bookingUrl }, origin);
  const document = new JSDOM(message.html).window.document;
  const action = [...document.querySelectorAll("a")].find(
    (link) => link.textContent === "Choose a time to talk",
  );
  assert.equal(action.href, bookingUrl);
  assert(message.text.includes(bookingUrl));
  const generic = confirmationMessage({ ...brand, contactEmail: "" }, origin);
  assert.equal(generic.replyTo, undefined);
  assert.match(generic.text, /not monitored/);
  assert.match(generic.html, /not monitored/);
  assert.doesNotMatch(generic.html, /Choose a time/);
  assert.throws(() =>
    confirmationMessage(
      { ...brand, bookingUrl: "javascript:alert(1)" },
      origin,
    ),
  );
});

test("website PNG logos keep their aspect ratio; unsafe image sources use the orbit fallback", () => {
  const src = "/api/brand-logo/123e4567-e89b-42d3-a456-426614174000";
  const custom = confirmationMessage(
    { ...brand, logo: { src, width: 600, height: 100 } },
    origin,
  );
  const image = new JSDOM(custom.html).window.document.querySelector("img");
  assert.equal(image.src, origin + src);
  assert.equal(image.width, 120);
  assert.equal(image.height, 20);
  const unsafe = confirmationMessage(
    {
      ...brand,
      logo: { src: "https://attacker.test/pixel", width: 1, height: 1 },
    },
    origin,
  );
  assert.equal(
    new JSDOM(unsafe.html).window.document.querySelector("img").src,
    `${origin}/brand/email-mark.png`,
  );
});

test("notification links stay private to the owner message; both formats avoid enquiry contents", () => {
  const notification = notificationMessage(
    {
      ...brand,
      message: "PRIVATE MESSAGE",
      assessment: "PRIVATE ASSESSMENT",
      visitor: "PRIVATE NAME",
    },
    origin,
    "123",
  );
  assert(confirmationPayloadSchema.safeParse(notification).success);
  assert.match(notification.text, /Best regards,\nGet Automated/);
  const document = new JSDOM(notification.html).window.document;
  assert(document.body.textContent.includes("Best regards,"));
  assert.equal(
    [...document.querySelectorAll("a")].find(
      (link) => link.textContent === "Review the enquiry",
    ).href,
    `${origin}/admin/enquiries/123`,
  );
  assert.doesNotMatch(JSON.stringify(notification), /PRIVATE/);
  assert.doesNotMatch(
    confirmationMessage(brand, origin, "Alex").html,
    /\/admin/,
  );
});

test("plain-text historical snapshots remain valid and template output is deterministic", () => {
  const legacy = {
    subject: "Old receipt",
    text: "Original wording",
    replyTo: "old@example.test",
  };
  assert.deepEqual(confirmationPayloadSchema.parse(legacy), legacy);
  assert.deepEqual(
    confirmationMessage(brand, origin, "Alex"),
    confirmationMessage(brand, origin, "Alex"),
  );
  assert.deepEqual(
    notificationMessage(brand, origin, "123"),
    notificationMessage(brand, origin, "123"),
  );
});
