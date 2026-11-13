import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime.js";
import { emailChangeSchema } from "../src/lib/validation.ts";

test("email changes normalise addresses and require matching, different, bounded credentials", () => {
  const valid = {
    currentEmail: "owner@example.test",
    newEmail: " New.Owner@Example.Test ",
    confirmEmail: "new.owner@example.test",
    currentPassword: "current password",
  };
  assert.equal(
    emailChangeSchema.parse(valid).newEmail,
    "new.owner@example.test",
  );
  for (const change of [
    { newEmail: "not-an-email" },
    { confirmEmail: "someone-else@example.test" },
    { newEmail: "OWNER@example.test", confirmEmail: "owner@example.test" },
    { currentEmail: "" },
    { currentPassword: "" },
    { currentPassword: "x".repeat(129) },
    { newEmail: `${"a".repeat(250)}@example.test` },
  ])
    assert.equal(
      emailChangeSchema.safeParse({ ...valid, ...change }).success,
      false,
    );
  assert.equal(
    emailChangeSchema.parse({ ...valid, userId: "another-user" }).userId,
    undefined,
  );
});

const dom = new JSDOM('<div id="root"></div>', {
  url: "http://localhost:3000/admin/admin-account",
});
for (const key of ["window", "document", "HTMLElement", "Event", "FormData"])
  globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = (callback) => {
  callback();
  return 0;
};
const { createRoot } = await import("react-dom/client");
const { EmailForm } = await import("../src/components/email-form.tsx");

test("email form validates before sending, preserves failed edits and redirects only after success", async () => {
  const originalFetch = globalThis.fetch;
  const root = createRoot(document.getElementById("root"));
  const calls = [];
  const navigation = [];
  let finish;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, input: JSON.parse(options.body) });
    return new Promise((resolve) => {
      finish = resolve;
    });
  };
  const field = (name) => document.querySelector(`[name="${name}"]`);
  const submit = () =>
    act(async () => {
      document
        .querySelector("form")
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
    });
  try {
    await act(async () =>
      root.render(
        createElement(
          AppRouterContext.Provider,
          {
            value: {
              replace: (url) => navigation.push(url),
              refresh: () => navigation.push("refresh"),
            },
          },
          createElement(EmailForm, { currentEmail: "owner@example.test" }),
        ),
      ),
    );
    field("newEmail").value = "New.Owner@example.test";
    field("confirmEmail").value = "different@example.test";
    field("currentPassword").value = "current password";
    await submit();
    assert.equal(calls.length, 0);
    assert.match(
      document.querySelector('[role="alert"]').textContent,
      /must match/,
    );
    field("confirmEmail").value = "new.owner@example.test";
    await submit();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/api/admin/email");
    assert.equal(calls[0].input.currentEmail, "owner@example.test");
    assert.equal(calls[0].input.newEmail, "new.owner@example.test");
    assert.equal(document.querySelector("button").disabled, true);
    await submit();
    assert.equal(calls.length, 1);
    await act(async () =>
      finish(
        Response.json(
          { error: "Your current password is incorrect." },
          { status: 400 },
        ),
      ),
    );
    assert.equal(navigation.length, 0);
    assert.equal(field("newEmail").value, "New.Owner@example.test");
    assert.equal(document.querySelector("button").disabled, false);
    assert.equal(
      document.activeElement,
      document.querySelector('[role="alert"]'),
    );
    assert.match(
      document.querySelector('[role="alert"]').textContent,
      /incorrect/,
    );
    field("currentPassword").value = "correct password";
    await submit();
    await act(async () =>
      finish(Response.json({ message: "Email address updated." })),
    );
    assert.deepEqual(navigation, ["/admin/login?emailChanged=1", "refresh"]);
    assert.equal(field("currentPassword").value, "");
    assert.equal(document.querySelector("button").disabled, true);
  } finally {
    globalThis.fetch = originalFetch;
    await act(async () => root.unmount());
  }
});
