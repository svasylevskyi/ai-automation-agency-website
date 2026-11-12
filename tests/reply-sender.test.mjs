import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime.js";
const dom = new JSDOM('<div id="root"></div>', {
  url: "https://example.test/admin",
});
for (const key of [
  "window",
  "document",
  "HTMLElement",
  "HTMLInputElement",
  "Event",
])
  globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import("react-dom/client");
const { ReplySender } = await import("../src/components/reply-sender.tsx");
const root = createRoot(document.getElementById("root"));
const originalFetch = globalThis.fetch;
const calls = [];
const preview = {
  id: "preview-id",
  status: "preview",
  reviewVersion: 1,
  enquiryVersion: 2,
  from: "website@mail.get-automated.ai",
  to: "visitor@example.test",
  replyTo: "hello@get-automated.ai",
  subject: "Following up on your enquiry",
  text: "Reviewed reply",
  html: "<p>Reviewed reply</p>",
  provider: "resend",
  providerMessageId: null,
  attempts: 0,
  acceptedAt: null,
  updatedAt: "2026-11-12T12:00:00Z",
  retryAllowed: false,
  followUp: null,
  followUpOutcome: "none",
};
const render = async (props = {}) =>
  act(async () =>
    root.render(
      createElement(
        AppRouterContext.Provider,
        { value: { refresh() {} } },
        createElement(ReplySender, {
          id: "id",
          reviewVersion: 1,
          enquiryVersion: 2,
          ready: true,
          closed: false,
          delivery: null,
          onLock() {},
          ...props,
        }),
      ),
    ),
  );
const button = (text) =>
  [...document.querySelectorAll("button")].find((x) => x.textContent === text);

test("sending requires a current preview and recipient confirmation; form changes invalidate approval", async () => {
  globalThis.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return Response.json(
      url.endsWith("/preview")
        ? preview
        : {
            ...preview,
            status: "accepted",
            acceptedAt: "2026-11-12T12:01:00Z",
            updatedAt: "2026-11-12T12:01:00Z",
          },
    );
  };
  try {
    await render({ ready: false });
    assert.equal(button("Preview email").disabled, true);
    await render();
    assert.equal(button("Send reply"), undefined);
    await act(async () => button("Preview email").click());
    assert.equal(calls.length, 1);
    assert.equal(button("Send reply").disabled, true);
    assert.equal(document.querySelector("iframe").getAttribute("sandbox"), "");
    assert(document.body.textContent.includes(preview.to));
    await act(async () =>
      [...document.querySelectorAll("input[type=checkbox]")].at(-1).click(),
    );
    assert.equal(button("Send reply").disabled, false);
    await render({ reviewVersion: 2 });
    assert.equal(button("Send reply"), undefined);
    await render();
    const subject = document.getElementById("reply-subject");
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set.call(subject, "Updated");
      subject.dispatchEvent(new Event("input", { bubbles: true }));
    });
    assert.equal(button("Send reply"), undefined);
    await act(async () => button("Preview email").click());
    assert.equal(button("Send reply").disabled, true);
    await act(async () =>
      [...document.querySelectorAll("input[type=checkbox]")].at(-1).click(),
    );
    await act(async () => button("Send reply").click());
    assert.deepEqual(calls.at(-1).body, {
      deliveryId: "preview-id",
      confirmed: true,
    });
    assert.equal(button("Send reply"), undefined);
    assert(
      document.body.textContent.includes("Accepted by the email provider"),
    );
  } finally {
    globalThis.fetch = originalFetch;
    await act(async () => root.unmount());
  }
});
