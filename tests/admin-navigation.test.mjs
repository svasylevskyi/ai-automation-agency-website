import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime.js";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime.js";

const dom = new JSDOM(
  '<div id="root"></div><button id="outside">Outside</button>',
  { url: "http://localhost:3000/admin/agency-identity" },
);
for (const key of [
  "window",
  "document",
  "HTMLElement",
  "Event",
  "KeyboardEvent",
])
  globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
globalThis.self = dom.window;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import("react-dom/client");
const { AdminNavigation } = await import(
  "../src/components/admin-navigation.tsx"
);

test("grouped admin navigation preserves order and closes accessibly on Escape, outside focus and navigation", async () => {
  const root = createRoot(document.getElementById("root"));
  const render = async (path = "/admin/agency-identity") =>
    act(async () =>
      root.render(
        createElement(
          AppRouterContext.Provider,
          { value: { push() {}, replace() {}, prefetch() {} } },
          createElement(
            PathnameContext.Provider,
            { value: path },
            createElement(AdminNavigation),
          ),
        ),
      ),
    );
  const open = async (details) =>
    act(async () => {
      details.open = true;
      details.dispatchEvent(new Event("toggle"));
    });
  try {
    await render();
    const [settings, legal] = document.querySelectorAll("details");
    assert.deepEqual(
      [
        ...document.querySelectorAll(
          "nav > a, nav > details > summary, nav > div > button",
        ),
      ].map((el) =>
        el.textContent.trim().replace(/\s+\(opens in a new tab\)/, ""),
      ),
      ["Enquiries", "Settings", "Legal docs", "View Website", "Sign Out"],
    );
    assert.deepEqual(
      [...settings.querySelectorAll("a")].map((el) => el.textContent),
      ["Agency identity", "Admin account", "Retention & backups"],
    );
    assert.equal(
      document.querySelector('[aria-current="page"]').getAttribute("href"),
      "/admin/agency-identity",
    );
    await open(settings);
    await act(async () => settings.querySelector("a").focus());
    await act(async () =>
      settings
        .querySelector("a")
        .dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        ),
    );
    assert.equal(settings.open, false);
    assert.equal(document.activeElement, settings.querySelector("summary"));
    await open(settings);
    await open(legal);
    assert.equal(settings.open, false);
    await act(async () =>
      document
        .getElementById("outside")
        .dispatchEvent(new Event("pointerdown", { bubbles: true })),
    );
    assert.equal(legal.open, false);
    await open(settings);
    await act(async () => {
      settings.querySelector("a").focus();
      document.getElementById("outside").focus();
    });
    assert.equal(settings.open, false);
    await open(settings);
    await render("/admin/legal/terms");
    assert.equal(settings.open, false);
    assert.equal(
      document.querySelector('[aria-current="page"]').getAttribute("href"),
      "/admin/legal/terms",
    );
    assert.equal(legal.querySelector("summary").dataset.active, "true");
  } finally {
    await act(async () => root.unmount());
  }
});
