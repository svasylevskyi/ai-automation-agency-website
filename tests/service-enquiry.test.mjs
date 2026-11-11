import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement as h } from "react";
import { enquirySchema } from "../src/lib/validation.ts";
import { serviceEnquirySuccess } from "../src/lib/enquiry-routes.ts";

const dom = new JSDOM("<div id='root'></div>", {
  url: "http://localhost:3000/enquiry-follow-up-automation",
  pretendToBeVisual: true,
});
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
const { ServiceEnquiryProvider, ServiceEnquiryLink, ServiceEnquiryForm } =
  await import("../src/components/service-enquiry.tsx");
const root = createRoot(document.getElementById("root"));
let posts = [];
let fail = true;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (url === "/api/enquiry-token")
    return Response.json({ token: "x".repeat(50) });
  assert.equal(url, "/api/enquiries");
  posts.push(JSON.parse(options.body));
  return fail
    ? Response.json({ error: "Please retry." }, { status: 503 })
    : Response.json({ message: serviceEnquirySuccess }, { status: 201 });
};
const field = (name) => document.querySelector(`[name='${name}']`);
const submit = () =>
  act(async () =>
    document
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );

try {
  await test("service CTAs select the saved route, retain input across switches and failures, and keep the visible website out of the honeypot", async () => {
    await act(async () =>
      root.render(
        h(
          ServiceEnquiryProvider,
          null,
          h(ServiceEnquiryLink, {}),
          h(ServiceEnquiryLink, { route: "custom automation" }),
          h(ServiceEnquiryForm, {
            brand: { privacyUrl: "", bookingUrl: "", contactEmail: "" },
          }),
        ),
      ),
    );
    assert.match(document.querySelector("h3").textContent, /enquiry process/);
    field("name").value = "Test Visitor";
    field("email").value = "visitor@example.test";
    field("company").value = "Example Studio";
    field("message").value = "We need help following up on website enquiries.";
    field("businessWebsite").value = "https://example.test";
    field("currentTools").value = "HubSpot and Google Sheets";
    field("privacyAcknowledged").checked = true;
    await submit();
    assert.equal(posts[0].enquiryRoute, "enquiry-process review");
    assert.equal(posts[0].area, "sales");
    assert.equal(posts[0].website, "");
    assert.equal(
      enquirySchema.parse(posts[0]).businessWebsite,
      "https://example.test",
    );
    await act(async () =>
      document.querySelectorAll("a[href='#contact']")[1].click(),
    );
    assert.equal(field("enquiryRoute").value, "custom automation");
    assert.match(
      field("message").closest("label").textContent,
      /What process would you like to improve/,
    );
    assert.equal(field("message").value, posts[0].message);
    assert.equal(field("currentTools").value, posts[0].currentTools);
    await submit();
    assert.equal(posts[1].enquiryRoute, "custom automation");
    assert.equal(posts[1].area, "other");
    assert.match(document.body.textContent, /Please retry/);
    assert.equal(field("businessWebsite").value, posts[0].businessWebsite);
    await act(async () =>
      document.querySelectorAll("a[href='#contact']")[0].click(),
    );
    assert.equal(field("enquiryRoute").value, "enquiry-process review");
    fail = false;
    await submit();
    assert.match(
      document.body.textContent,
      /Thanks—your enquiry has been received/,
    );
    assert.equal(document.querySelector("form"), null);
  });

  await test("service context is bounded, routes are allowlisted, and website addresses cannot contain scripts or credentials", () => {
    const valid = posts[0];
    for (const extra of [
      { enquiryRoute: "unknown" },
      { businessWebsite: "javascript:alert(1)" },
      { businessWebsite: "https://user:password@example.test" },
      { businessWebsite: "file:///etc/passwd" },
      { currentTools: "x".repeat(1001) },
    ]) {
      assert.equal(
        enquirySchema.safeParse({ ...valid, ...extra }).success,
        false,
      );
    }
    assert.equal(
      enquirySchema.parse({ ...valid, businessWebsite: "", currentTools: "" })
        .currentTools,
      "",
    );
    const { enquiryRoute, businessWebsite, currentTools, ...legacy } = valid;
    const oldSubmission = enquirySchema.parse(legacy);
    assert.equal(oldSubmission.enquiryRoute, undefined);
    assert.equal(oldSubmission.businessWebsite, "");
  });
} finally {
  await act(async () => root.unmount());
  globalThis.fetch = originalFetch;
  dom.window.close();
}
