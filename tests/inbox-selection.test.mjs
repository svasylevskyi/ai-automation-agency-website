import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime.js";

test("the inbox submits only visible, selected rows and keeps a failed selection for review", async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "http://localhost/admin",
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const { InboxSelection } =
    await import("../src/components/inbox-selection.tsx");
  const root = createRoot(document.getElementById("root"));
  const originalFetch = globalThis.fetch;
  const calls = [];
  let refreshes = 0;
  const router = { refresh: () => refreshes++ };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, method: options.method, ...JSON.parse(options.body) });
    return calls.length === 1
      ? Response.json({ error: "Reload the inbox." }, { status: 409 })
      : Response.json({ updated: 1, unchanged: 0 });
  };
  const item = (id) => ({ id, name: id, version: 3, detail: id });
  const render = (ids) =>
    act(async () =>
      root.render(
        createElement(
          AppRouterContext.Provider,
          { value: router },
          createElement(
            InboxSelection,
            { items: ids.map(item) },
            "No enquiries",
          ),
        ),
      ),
    );
  const all = () => document.querySelector(".inbox-toolbar input");
  const apply = () => document.querySelector("button");
  const click = (el) => act(async () => el.click());
  try {
    await render(["A", "B", "C"]);
    assert.ok(apply().disabled);
    await click(document.querySelector('[aria-label="Select A"]'));
    assert.equal(all().indeterminate, true);
    await click(all());
    assert.equal(
      document.querySelectorAll(".row-check input:checked").length,
      3,
    );
    await click(all());
    assert.equal(
      document.querySelectorAll(".row-check input:checked").length,
      0,
    );
    await click(all());
    await render(["B", "D"]);
    assert.equal(all().indeterminate, true);
    const select = document.querySelector("select");
    await act(async () => {
      select.value = "closed";
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    assert.match(
      document.querySelector(".inbox-close-note").textContent,
      /clears scheduled follow-ups/,
    );
    await click(apply());
    assert.deepEqual(calls[0], {
      url: "/api/admin/enquiries/status",
      method: "PATCH",
      status: "closed",
      enquiries: [{ id: "B", version: 3 }],
    });
    assert.equal(refreshes, 0);
    assert.match(
      document.querySelector('[role="status"]').textContent,
      /Reload/,
    );
    assert.ok(document.querySelector('[aria-label="Select B"]').checked);
    await click(apply());
    assert.deepEqual(calls[1], calls[0]);
    assert.equal(refreshes, 1);
    assert.ok(apply().disabled);
    assert.equal(
      document.querySelectorAll(".row-check input:checked").length,
      0,
    );
    await render([]);
    assert.match(
      document.querySelector('[role="status"]').textContent,
      /1 enquiry moved to Closed/,
    );
    assert.match(document.body.textContent, /No enquiries/);
  } finally {
    globalThis.fetch = originalFetch;
    await act(async () => root.unmount());
    dom.window.close();
  }
});
