import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import {
  replyMessage,
  replyPreviewSchema,
  replySendSchema,
} from "../src/lib/reply-delivery.ts";

test("reviewed reply HTML escapes owner text and preserves paragraph/line breaks", () => {
  const body =
    'Hello Alex,\n\n<script>alert(1)</script> & "details"\nSecond line\n\nBest regards,\nStepan';
  const result = replyMessage(
    {
      name: "Get Automated",
      contactEmail: "hello@get-automated.ai",
      bookingUrl: "",
    },
    "https://get-automated.ai",
    "Your enquiry",
    body,
  );
  const document = new JSDOM(result.html).window.document;
  assert.equal(document.querySelector("script"), null);
  assert(document.body.textContent.includes("<script>alert(1)</script>"));
  assert(document.querySelectorAll("br").length >= 2);
  assert(result.text.startsWith(body));
  assert.equal(result.replyTo, "hello@get-automated.ai");
  assert.equal(document.querySelectorAll("img").length, 1);
});

test("preview and approval contracts reject injected recipients, headers and incomplete follow-ups", () => {
  const valid = {
    reviewVersion: 1,
    enquiryVersion: 1,
    subject: "Your enquiry",
    followUp: null,
  };
  assert(replyPreviewSchema.safeParse(valid).success);
  for (const invalid of [
    { ...valid, to: "someone-else@example.test" },
    { ...valid, subject: "Hello\r\nBcc:someone@example.test" },
    { ...valid, reviewVersion: 0 },
    { ...valid, followUp: { date: "2027-02-30", action: "Check" } },
    { ...valid, followUp: { date: "2027-02-10", action: "" } },
  ])
    assert(!replyPreviewSchema.safeParse(invalid).success);
  const approved = {
    deliveryId: "123e4567-e89b-42d3-a456-426614174000",
    confirmed: true,
  };
  assert(replySendSchema.safeParse(approved).success);
  for (const input of [
    { ...approved, confirmed: false },
    { deliveryId: approved.deliveryId },
    { ...approved, text: "replacement" },
  ])
    assert(!replySendSchema.safeParse(input).success);
});
