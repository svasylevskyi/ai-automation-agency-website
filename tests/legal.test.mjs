import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { LegalContent } from "../src/components/legal-content.tsx";
import {
  legalPages,
  legalSlugs,
  legalPlaceholders,
  legalKeys,
  resolveLegalText,
  unresolvedLegalKeys,
  legalValuesSchema,
  legalUpdateSchema,
  privacyHref,
} from "../src/lib/legal.ts";

const valid = {
  title: "Privacy Policy",
  content:
    "A complete description of the way the agency uses information. ".repeat(5),
  isDraft: true,
  version: 1,
  values: {},
  valuesVersion: 1,
};
test("drafts allow placeholders; ready pages reject unresolved details and bounded content", () => {
  const draft = { ...valid, content: valid.content + " {LEGAL_NAME}" };
  assert(legalUpdateSchema.safeParse(draft).success);
  assert.equal(
    legalUpdateSchema.safeParse({ ...draft, isDraft: false }).success,
    false,
  );
  assert(legalUpdateSchema.safeParse({ ...valid, isDraft: false }).success);
  for (const change of [
    { content: "Too short" },
    { content: "x".repeat(60001) },
    { title: "x" },
    { title: "x".repeat(121) },
    { version: 0 },
    { version: 1.5 },
    { isDraft: "false" },
  ])
    assert.equal(
      legalUpdateSchema.safeParse({ ...valid, ...change }).success,
      false,
    );
  assert.deepEqual(
    legalPlaceholders("[LEGAL_NAME] [CONTACT_EMAIL] [LEGAL_NAME]"),
    ["[LEGAL_NAME]", "[CONTACT_EMAIL]"],
  );
});
test("legal text formatting escapes HTML and does not activate links or embedded content", () => {
  const html = renderToStaticMarkup(
    createElement(LegalContent, {
      content:
        "## Your rights\r\n\r\nFirst line.\r\nSecond line.\r\n\r\n- Access\r\n- Correction\r\n\r\n<script>alert(1)</script>\n[Open](javascript:alert(1))\n<img src=x onerror=alert(1)>",
    }),
  );
  assert.match(html, /<h2 id="legal-section-0">Your rights<\/h2>/);
  assert.match(html, /<li>Access<\/li><li>Correction<\/li>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /First line.\nSecond line./);
  assert.doesNotMatch(html, /<script|<img|<a /);
});
test("bundled templates and prefilled values describe the confirmed production setup", async () => {
  const values = JSON.parse(
    await readFile(
      new URL("../src/content/legal-details.json", import.meta.url),
      "utf8",
    ),
  );
  assert(legalValuesSchema.safeParse(values).success);
  assert.equal(values.LEGAL_NAME, "Stepan Vasylevskyi - IT Consulting");
  assert.equal(values.NIP, "8992779679");
  assert.equal(values.REGON, "540469457");
  assert.equal(values.CONTACT_EMAIL, "support@get-automated.ai");
  assert.equal(values.PRIVACY_CONTACT_EMAIL, values.CONTACT_EMAIL);
  assert.equal(values.COMPLAINTS_EMAIL, values.CONTACT_EMAIL);
  assert.match(values.POSTAL_ADDRESS, /Wrocław/);
  assert.match(values.MAIL_DELIVERY_DETAILS, /United States/);
  assert.match(values.AUTOMATION_DETAILS, /not currently processed/);
  assert.equal(values.LOG_RETENTION, "");
  for (const slug of legalSlugs) {
    const content = await readFile(
      new URL(`../src/content/${legalPages[slug].file}`, import.meta.url),
      "utf8",
    );
    assert(content.length > 5000);
    assert(content.includes("{LEGAL_NAME}"));
    assert(content.includes("{TRADING_NAME}"));
    assert(content.includes("{WEBSITE_URL}"));
    assert(content.includes("{POSTAL_ADDRESS}"));
    assert.doesNotMatch(content, /\[[A-Z][A-Z0-9_]*\]/);
    assert.doesNotMatch(
      content,
      /current test site|captured locally|InfoTech|duckdns\.org/,
    );
    assert(legalKeys(content).every((key) => Object.hasOwn(values, key)));
    assert(legalUpdateSchema.safeParse({ ...valid, content, values }).success);
    assert.equal(
      legalUpdateSchema.safeParse({ ...valid, content, values, isDraft: false })
        .success,
      slug === "terms",
    );
    assert.deepEqual(
      unresolvedLegalKeys(content, values),
      slug === "privacy" ? ["LOG_RETENTION"] : [],
    );
  }
  assert.equal(privacyHref(""), "/privacy");
  assert.equal(
    privacyHref("https://example.test/privacy"),
    "https://example.test/privacy",
  );
});

test("placeholder replacement is literal, safe and refuses incomplete or nested values", () => {
  const text = "{LEGAL_NAME} / {LEGAL_NAME} / [CONTACT_EMAIL] / {MISSING}";
  const values = {
    LEGAL_NAME: "<script>$&</script>",
    CONTACT_EMAIL: "support@example.test",
  };
  assert.equal(
    resolveLegalText(text, values),
    "<script>$&</script> / <script>$&</script> / support@example.test / {MISSING}",
  );
  assert.deepEqual(legalKeys(text), ["LEGAL_NAME", "CONTACT_EMAIL", "MISSING"]);
  assert.deepEqual(unresolvedLegalKeys(text, values), ["MISSING"]);
  assert.equal(
    resolveLegalText("{NAME}", Object.create({ NAME: "inherited" })),
    "{NAME}",
  );
  const html = renderToStaticMarkup(
    createElement(LegalContent, { content: resolveLegalText(text, values) }),
  );
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.equal(legalValuesSchema.safeParse({ NAME: "{OTHER}" }).success, false);
  assert.equal(legalValuesSchema.safeParse({ NAME: "[OTHER]" }).success, false);
  assert.equal(
    legalValuesSchema.safeParse({ NAME: "x".repeat(4001) }).success,
    false,
  );
  assert.equal(
    legalValuesSchema.safeParse({ "bad-key": "value" }).success,
    false,
  );
  assert.equal(
    legalUpdateSchema.safeParse({ ...valid, valuesVersion: 0 }).success,
    false,
  );
  assert(
    legalUpdateSchema.safeParse({
      ...valid,
      content: valid.content + "{NAME}",
      values: { NAME: "Resolved" },
      isDraft: false,
    }).success,
  );
  assert.equal(
    legalUpdateSchema.safeParse({ ...valid, title: "{NAME}", isDraft: false })
      .success,
    false,
  );
});
