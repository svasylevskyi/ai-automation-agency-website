import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
const dom = new JSDOM('<div id="root"></div>', {
  url: "http://localhost:3000/admin/retention",
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
globalThis.requestAnimationFrame = (callback) => {
  callback(0);
  return 0;
};
const { createRoot } = await import("react-dom/client");
const { RetentionEditor } =
  await import("../src/components/retention-editor.tsx");
const root = createRoot(document.getElementById("root"));
const oldFetch = globalThis.fetch,
  calls = [];
let conflict = false;
globalThis.fetch = async (url, options) => {
  calls.push({ url, ...JSON.parse(options.body) });
  if (url.endsWith("/preview"))
    return Response.json({
      token: "proof",
      count: 0,
      cutoff: new Date().toISOString(),
      samples: [],
    });
  if (conflict)
    return Response.json(
      { error: "Retention settings changed. Reload before saving." },
      { status: 409 },
    );
  return Response.json({ version: 2 });
};
const button = (name) =>
  [...document.querySelectorAll("button")].find((b) =>
    b.textContent.includes(name),
  );
const boxes = () => document.querySelectorAll('input[type="checkbox"]');
async function submit() {
  await act(async () =>
    document
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}
try {
  await test("retention requires preview and acknowledgement, invalidates changed periods and preserves conflicting edits", async () => {
    await act(async () =>
      root.render(
        createElement(RetentionEditor, {
          initial: {
            enabled: false,
            days: 180,
            version: 1,
            lastCleanupAt: null,
            lastDeletedCount: 0,
          },
        }),
      ),
    );
    await act(async () => boxes()[0].click());
    assert.equal(button("Save").disabled, true);
    assert.equal(boxes()[1].disabled, true);
    await act(async () => button("Preview").click());
    assert.match(
      document.querySelector("h3").textContent,
      /0 eligible enquiries/,
    );
    assert.equal(button("Save").disabled, true);
    await act(async () => boxes()[1].click());
    assert.equal(button("Save").disabled, false);
    const input = document.querySelector('[name="days"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set.call(input, "90");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    assert.equal(document.querySelector("h3"), null);
    assert.equal(button("Save").disabled, true);
    await act(async () => button("Preview").click());
    await act(async () => boxes()[1].click());
    conflict = true;
    await submit();
    assert.match(
      document.querySelector('[role="status"]').textContent,
      /Reload/,
    );
    assert.equal(input.value, "90");
    assert.equal(document.querySelector("fieldset").disabled, false);
    assert.equal(calls.at(-1).previewToken, "proof");
    assert.equal(calls.at(-1).acknowledged, true);
    conflict = false;
    await act(async () => boxes()[0].click());
    assert.equal(button("Save").disabled, false);
    await submit();
    assert.equal(calls.at(-1).enabled, false);
    assert.match(
      document.querySelector('[role="status"]').textContent,
      /cleanup disabled/,
    );
  });
} finally {
  await act(async () => root.unmount());
  dom.window.close();
  globalThis.fetch = oldFetch;
}
