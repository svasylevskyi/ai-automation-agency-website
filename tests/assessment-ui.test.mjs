import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";

const dom = new JSDOM(
  "<!doctype html><html><body><div id='root'></div></body></html>",
  { url: "http://localhost:3000", pretendToBeVisual: true },
);
for (const key of [
  "window",
  "document",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "HTMLSelectElement",
  "FormData",
  "Event",
  "MouseEvent",
])
  globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = (callback) => {
  callback(0);
  return 0;
};
const { createRoot } = await import("react-dom/client");
const { ContactForms } = await import("../src/components/contact-forms.tsx");
const brand = { privacyUrl: "", contactEmail: "", bookingUrl: "" };
const root = createRoot(document.getElementById("root"));
let posts = [];
let tokenRequests = 0;
let shouldFail = false;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (url === "/api/enquiry-token") {
    tokenRequests++;
    return Response.json({ token: "test-token" });
  }
  assert.equal(url, "/api/enquiries");
  posts.push(JSON.parse(options.body));
  if (shouldFail)
    return Response.json(
      { error: "Please try again shortly." },
      { status: 503 },
    );
  return Response.json(
    { message: "Thank you. Your enquiry has been received." },
    { status: 201 },
  );
};
function button(text) {
  const found = [...document.querySelectorAll("button")].find((node) =>
    node.textContent.includes(text),
  );
  assert(found, `Missing button ${text}`);
  return found;
}
function field(labelText) {
  const label = [...document.querySelectorAll("label")].find((node) =>
    node.textContent.includes(labelText),
  );
  assert(label, `Missing field ${labelText}`);
  return label.querySelector("input, select, textarea");
}
async function change(label, value) {
  const element = field(label);
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(element),
      "value",
    ).set.call(element, value);
    element.dispatchEvent(
      new Event(element.tagName === "SELECT" ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
}
async function click(text) {
  await act(async () => button(text).click());
}
async function submit(selector) {
  await act(async () =>
    document
      .querySelector(selector)
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}
async function chooseOther() {
  await change("Where does repetitive work", "other");
  await change("Briefly describe", "An unusual scheduling workflow");
  await change("What best describes", "mid");
  await submit(".planner form");
  await change("Which tools", "Email and spreadsheets");
  await change("How often", "weekly");
  await change("biggest difficulty", "chasing");
  await submit(".planner form");
  await change("most like to improve", "speed");
  await change("When are you", "exploring");
  await submit(".planner form");
}

try {
  await test("assessment stays local; back, edit, transfer and retry preserve visitor input", async () => {
    await act(async () => root.render(createElement(ContactForms, { brand })));
    await change("Your name", "Visitor Name");
    await change("Email", "visitor@example.test");
    await change("What would you like", "Existing context should stay here.");
    document.querySelector(".planner-disclosure").open = true;
    await chooseOther();
    assert.match(
      document.querySelector(".plan-result").textContent,
      /focused workflow review/,
    );
    assert.equal(posts.length, 0);
    assert.equal(tokenRequests, 1);
    await click("Edit answers");
    assert.equal(
      field("Briefly describe").value,
      "An unusual scheduling workflow",
    );
    await submit(".planner form");
    assert.equal(field("Which tools").value, "Email and spreadsheets");
    await click("Back");
    assert.equal(field("What best describes").value, "mid");
    await submit(".planner form");
    await submit(".planner form");
    await submit(".planner form");
    await click("Discuss this workflow");
    assert.equal(document.querySelector(".planner-disclosure").open, false);
    assert.match(
      document.querySelector(".attached-assessment").textContent,
      /Email and spreadsheets/,
    );
    assert.equal(field("Your name").value, "Visitor Name");
    assert.equal(
      document.querySelector('textarea[name="message"]').value,
      "Existing context should stay here.",
    );
    assert.equal(document.querySelector('select[name="area"]'), null);
    assert.equal(
      document.querySelector('textarea[name="message"]').required,
      false,
    );
    await click("Edit assessment");
    assert.equal(document.querySelector(".planner-disclosure").open, true);
    await submit(".planner form");
    await change("Which tools", "Updated tools");
    await submit(".planner form");
    await submit(".planner form");
    await click("Discuss this workflow");
    assert.match(
      document.querySelector(".attached-assessment").textContent,
      /Updated tools/,
    );
    await change("Anything else", "");
    document.querySelector('[name="privacyAcknowledged"]').checked = true;
    shouldFail = true;
    await submit(".enquiry-card form");
    assert.match(
      document.querySelector(".notice.error").textContent,
      /try again/,
    );
    assert.equal(field("Your name").value, "Visitor Name");
    assert.match(
      document.querySelector(".attached-assessment").textContent,
      /Updated tools/,
    );
    shouldFail = false;
    await submit(".enquiry-card form");
    assert.equal(posts.length, 2);
    assert.deepEqual(posts[0], posts[1]);
    assert.equal(posts[1].area, "other");
    assert.equal(posts[1].teamSize, "mid");
    assert.equal(posts[1].message, "");
    assert.equal(
      posts[1].assessment.workflowDescription,
      "An unusual scheduling workflow",
    );
    assert.equal(posts[1].assessment.tools, "Updated tools");
    assert.equal(posts[1].privacyAcknowledged, true);
    assert.match(
      document.querySelector(".notice.success").textContent,
      /received/,
    );
    assert.equal(document.querySelector(".planner-disclosure"), null);
  });
  await test("removing an assessment restores direct enquiry fields without losing contact details", async () => {
    await act(async () =>
      root.render(createElement(ContactForms, { brand, key: "second" })),
    );
    await change("Your name", "Direct Visitor");
    await change("Email", "direct@example.test");
    await chooseOther();
    await click("Discuss this workflow");
    await click("Remove assessment");
    assert.equal(document.querySelector(".attached-assessment"), null);
    assert.equal(field("Your name").value, "Direct Visitor");
    assert.equal(
      document.querySelector('textarea[name="message"]').required,
      true,
    );
    await change("Where does work", "other");
    await change("What would you like", "Please help with our unusual task.");
    document.querySelector('[name="privacyAcknowledged"]').checked = true;
    await submit(".enquiry-card form");
    assert.equal(posts.at(-1).assessment, undefined);
    assert.equal(posts.at(-1).area, "other");
    assert.equal(posts.at(-1).name, "Direct Visitor");
  });
} finally {
  await act(async () => root.unmount());
  dom.window.close();
  globalThis.fetch = originalFetch;
}
