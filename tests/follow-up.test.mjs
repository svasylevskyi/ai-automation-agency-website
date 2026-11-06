import assert from "node:assert/strict";
import { test } from "node:test";
import { enquiryUpdateSchema } from "../src/lib/validation.ts";
import {
  warsawToday,
  followUpLabel,
  formatFollowUpDate,
} from "../src/lib/follow-up.ts";
import {
  confirmationMessage,
  confirmationPayloadSchema,
} from "../src/lib/confirmation.ts";
import { describeActivity } from "../src/lib/activity.ts";

test("follow-up requires a real date and action together, and cannot remain open on a closed enquiry", () => {
  const valid = {
    status: "contacted",
    notes: "Private context",
    version: 3,
    nextAction: " Send questions ",
    followUpDate: "2028-02-29",
  };
  assert.equal(enquiryUpdateSchema.parse(valid).nextAction, "Send questions");
  for (const change of [
    { followUpDate: "2027-02-29" },
    { followUpDate: "2026-04-31" },
    { followUpDate: "2026-1-01" },
    { followUpDate: "2100-01-01" },
    { followUpDate: null },
    { nextAction: "" },
    { nextAction: "x".repeat(301) },
    { status: "closed" },
  ])
    assert.equal(
      enquiryUpdateSchema.safeParse({ ...valid, ...change }).success,
      false,
      JSON.stringify(change),
    );
  assert(
    enquiryUpdateSchema.safeParse({
      ...valid,
      status: "closed",
      nextAction: "",
      followUpDate: null,
    }).success,
  );
});
test("Warsaw calendar dates are correct around midnight and daylight saving changes", () => {
  assert.equal(warsawToday(new Date("2026-11-06T23:30:00Z")), "2026-11-07");
  assert.equal(warsawToday(new Date("2026-07-06T22:30:00Z")), "2026-07-07");
  assert.equal(warsawToday(new Date("2026-03-29T01:30:00Z")), "2026-03-29");
  assert.equal(followUpLabel("2026-11-05", "2026-11-06"), "Overdue");
  assert.equal(followUpLabel("2026-11-06", "2026-11-06"), "Due today");
  assert.equal(followUpLabel("2026-11-07", "2026-11-06"), "Scheduled");
  assert.equal(formatFollowUpDate("2026-11-06"), "6 Nov 2026");
});
test("confirmation text contains only public settings, with optional booking and reply-to", () => {
  const message = confirmationMessage({
    name: "My agency",
    contactEmail: "public@example.test",
    bookingUrl: "https://example.test/book",
    nameFromForm: "PRIVATE NAME",
    email: "visitor@example.test",
    message: "PRIVATE MESSAGE",
    assessment: "PRIVATE ASSESSMENT",
  });
  assert(confirmationPayloadSchema.safeParse(message).success);
  assert.equal(message.replyTo, "public@example.test");
  assert.match(message.text, /https:\/\/example.test\/book/);
  assert.match(message.text, /does not book/);
  assert.match(message.text, /If you did not submit/);
  assert.doesNotMatch(
    JSON.stringify(message),
    /PRIVATE|visitor@example.test|\/admin/,
  );
  const minimal = confirmationMessage({
    name: "Agency",
    contactEmail: "",
    bookingUrl: "",
  });
  assert.equal(minimal.replyTo, undefined);
  assert.doesNotMatch(minimal.text, /choose a time|reply to this email/);
  assert.match(minimal.text, /not monitored/);
});
test("history distinguishes clearing, completing and SMTP acceptance", () => {
  assert.match(
    describeActivity("follow_up_cleared", {
      before: { action: "Call", date: "2026-11-06" },
    }),
    /without marking complete/,
  );
  assert.match(
    describeActivity("follow_up_completed", {
      action: "Call",
      date: "2026-11-06",
    }),
    /completed: Call/,
  );
  assert.match(
    describeActivity("mail_sent", { channel: "confirmation", attempt: 1 }),
    /does not confirm inbox delivery/,
  );
  assert.doesNotMatch(
    describeActivity("notes_updated", { notes: "PRIVATE NOTE" }),
    /PRIVATE NOTE/,
  );
});
