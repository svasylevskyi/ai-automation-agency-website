import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime.js";
import { prepareProspect } from "../automation/prospect-rules.mjs";
const dom = new JSDOM('<div id="root"></div>', {
  url: "https://example.test/admin",
});
for (const key of [
  "window",
  "document",
  "HTMLElement",
  "HTMLTextAreaElement",
  "Event",
])
  globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import("react-dom/client");
const { ProspectAssistant } =
  await import("../src/components/prospect-assistant.tsx");
const root = createRoot(document.getElementById("root"));
const props = {
  id: "fixture",
  version: 3,
  closed: false,
  enabled: true,
  job: null,
};
const calls = [];
const originalFetch = globalThis.fetch;
const render = async (changes) =>
  act(async () =>
    root.render(
      createElement(
        AppRouterContext.Provider,
        { value: { refresh() {} } },
        createElement(ProspectAssistant, { ...props, ...changes }),
      ),
    ),
  );
const button = (text) =>
  [...document.querySelectorAll("button")].find((el) =>
    el.textContent.includes(text),
  );
test("assistant respects paused/closed states and surfaces a queue conflict without losing the enquiry", async () => {
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return Response.json(
      { error: "This enquiry changed. Reload." },
      { status: 409 },
    );
  };
  try {
    await render({ enabled: false });
    assert.equal(button("Prepare brief"), undefined);
    await render({ closed: true });
    assert.equal(button("Prepare brief"), undefined);
    await render({});
    await act(async () => button("Prepare brief").click());
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/api/admin/enquiries/fixture/prospect");
    assert.deepEqual(JSON.parse(calls[0].body), { version: 3 });
    assert.match(
      document.querySelector('[role="status"]').textContent,
      /This enquiry changed/,
    );
    assert.equal(button("Prepare brief").disabled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("copying a draft uses the clipboard only, renders untrusted text safely and falls back to selection", async () => {
  const result = prepareProspect({
    enquiry: { area: "other", teamSize: "small", message: "", company: "" },
  }).result;
  result.brief = '<img src=x onerror="alert(1)">';
  const job = {
    status: "completed",
    attempts: 1,
    createdAt: "2026-11-06T12:00:00Z",
    completedAt: "2026-11-06T12:01:00Z",
    result,
    review: { text: null, ready: false, version: 0 },
  };
  let copied;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      async writeText(text) {
        copied = text;
      },
    },
  });
  globalThis.fetch = async () => {
    throw new Error("Copy must not call an API");
  };
  try {
    await render({ job });
    assert.equal(document.querySelector("img"), null);
    assert.equal(button("Prepare brief"), undefined);
    await act(async () => button("Copy reply draft").click());
    assert.equal(copied, result.replyDraft);
    const textarea = document.querySelector("textarea");
    const revised = "Which deal stages should appear in your Friday report?";
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      ).set.call(textarea, revised);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => button("Copy reply draft").click());
    assert.equal(copied, revised);
    assert.equal(
      document.querySelector(".reply-draft-editor details p").textContent,
      result.replyDraft,
    );
    navigator.clipboard.writeText = async () => {
      throw new Error("Clipboard unavailable");
    };
    await act(async () => button("Copy reply draft").click());
    assert.equal(document.activeElement, textarea);
    assert.equal(textarea.selectionStart, 0);
    assert.equal(textarea.selectionEnd, revised.length);
    assert.match(
      document.querySelector('[role="status"]').textContent,
      /Draft selected/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    await act(async () => root.unmount());
  }
});
