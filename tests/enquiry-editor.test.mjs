import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime.js";
const dom = new JSDOM('<div id="root"></div>', {
  url: "http://localhost:3000/admin",
});
for (const key of [
  "window",
  "document",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "HTMLSelectElement",
  "Event",
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
const { EnquiryEditor } = await import("../src/components/enquiry-editor.tsx");
const root = createRoot(document.getElementById("root"));
const calls = [];
let version = 1,
  conflict = false,
  refreshes = 0;
const oldFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  const body = JSON.parse(options.body);
  calls.push({ url, method: options.method, ...body });
  if (conflict)
    return Response.json(
      { error: "This enquiry changed. Copy your edits, then reload." },
      { status: 409 },
    );
  return Response.json({ version: ++version });
};
async function input(name, value) {
  const el = document.querySelector(`[name="${name}"]`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(el),
      "value",
    ).set.call(el, value);
    el.dispatchEvent(
      new Event(el.tagName === "SELECT" ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
}
const complete = () =>
  [...document.querySelectorAll("button")].find(
    (b) => b.textContent === "Mark saved follow-up complete",
  );
async function submit() {
  await act(async () =>
    document
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}
try {
  await test("owner can schedule, complete, reschedule and retain unsaved edits on conflict", async () => {
    const props = {
      id: "enquiry",
      status: "contacted",
      notes: "Original notes",
      version: 1,
      nextAction: "",
      followUpDate: null,
      notification: "sent",
      confirmation: "sent",
      confirmationAttempts: 1,
    };
    await act(async () =>
      root.render(
        createElement(
          AppRouterContext.Provider,
          { value: { refresh: () => refreshes++, push: () => {} } },
          createElement(EnquiryEditor, props),
        ),
      ),
    );
    await input("nextAction", "Send questions");
    await submit();
    assert.equal(calls.length, 0);
    assert.match(
      document.querySelector('[role="status"]').textContent,
      /both a next action/,
    );
    await input("followUpDate", "2026-11-12");
    await submit();
    assert.equal(calls[0].nextAction, "Send questions");
    assert.equal(calls[0].followUpDate, "2026-11-12");
    assert.equal(calls[0].version, 1);
    assert(complete());
    assert.equal(complete().disabled, false);
    await input("notes", "Unsaved notes");
    assert.equal(complete().disabled, true);
    await submit();
    assert.equal(calls[1].version, 2);
    await act(async () => complete().click());
    assert.equal(calls[2].url, "/api/admin/enquiries/enquiry/follow-up");
    assert.equal(calls[2].version, 3);
    assert.equal(document.querySelector('[name="nextAction"]').value, "");
    assert.equal(complete(), undefined);
    await input("nextAction", "Follow up after call");
    await input("followUpDate", "2026-11-20");
    conflict = true;
    await submit();
    assert.equal(calls[3].version, 4);
    assert.match(
      document.querySelector('[role="status"]').textContent,
      /Copy your edits/,
    );
    assert.equal(
      document.querySelector('[name="nextAction"]').value,
      "Follow up after call",
    );
    assert.equal(
      document.querySelector('[name="notes"]').value,
      "Unsaved notes",
    );
    assert.equal(document.querySelector("fieldset").disabled, false);
    assert.equal(refreshes, 3);
  });
} finally {
  await act(async () => root.unmount());
  dom.window.close();
  globalThis.fetch = oldFetch;
}
