import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";

const dom = new JSDOM('<div id="root"></div>', {
  url: "http://localhost:3000/admin/legal/privacy",
});
for (const key of [
  "window",
  "document",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
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
const { LegalEditor } = await import("../src/components/legal-editor.tsx");
const root = createRoot(document.getElementById("root"));
const initial = {
  slug: "privacy",
  title: "Privacy Policy",
  content: "## Controller\n\n[LEGAL_NAME] ".repeat(6),
  isDraft: true,
  version: 1,
  updatedAt: "2026-11-06T12:00:00.000Z",
};
const originalFetch = globalThis.fetch;
let calls = [],
  result = "success";
globalThis.fetch = async (url, options) => {
  calls.push({ url, ...JSON.parse(options.body) });
  return result === "success"
    ? Response.json({ version: 2, updatedAt: "2026-11-06T12:01:00.000Z" })
    : Response.json(
        {
          error:
            "This page changed in another window. Copy your edits, then reload before saving.",
        },
        { status: 409 },
      );
};
try {
  await test("legal editor saves one page, uses new revision and preserves unsaved text on conflict", async () => {
    await act(async () =>
      root.render(
        createElement(LegalEditor, { initial, privacyOverride: true }),
      ),
    );
    assert.match(document.body.textContent, /custom Privacy Policy URL/);
    assert.match(document.body.textContent, /\[LEGAL_NAME\]/);
    assert.equal(document.querySelector("a").getAttribute("target"), "_blank");
    const textarea = document.querySelector("textarea");
    const content = "## Updated draft\n\n" + "Useful policy text. ".repeat(12);
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      ).set.call(textarea, content);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    assert.equal(
      document.querySelector(".legal-preview h2").textContent,
      "Updated draft",
    );
    await act(async () =>
      document
        .querySelector("form")
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    assert.equal(calls[0].url, "/api/admin/legal/privacy");
    assert.equal(calls[0].content, content);
    assert.equal(calls[0].version, 1);
    assert.match(document.body.textContent, /Saved revision 2/);
    result = "conflict";
    await act(async () =>
      document
        .querySelector("form")
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    assert.equal(calls[1].version, 2);
    assert.match(
      document.querySelector(".notice.error").textContent,
      /Copy your edits/,
    );
    assert.equal(textarea.value, content);
    assert.equal(document.querySelector("button").disabled, false);
  });
} finally {
  await act(async () => root.unmount());
  dom.window.close();
  globalThis.fetch = originalFetch;
}
