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
  legalUpdateSchema,
  privacyHref,
} from "../src/lib/legal.ts";

const valid = {
  title: "Privacy Policy",
  content:
    "A complete description of the way the agency uses information. ".repeat(5),
  isDraft: true,
  version: 1,
};
test("drafts allow placeholders; ready pages reject unresolved details and bounded content", () => {
  const draft = { ...valid, content: valid.content + " [LEGAL_NAME]" };
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
test("bundled drafts identify Get Automated and retain outstanding details", async () => {
  for (const slug of legalSlugs) {
    const content = await readFile(
      new URL(`../src/content/${legalPages[slug].file}`, import.meta.url),
      "utf8",
    );
    assert(content.length > 5000);
    assert(content.includes("Stepan Vasylevskyi - InfoTech Consulting"));
    assert(content.includes("Get Automated"));
    assert(content.includes("https://get-automated.ai"));
    assert.match(content, /\[POSTAL_ADDRESS\]/);
    assert.doesNotMatch(content, /\[(LEGAL_NAME|TRADING_NAME|WEBSITE_URL)\]/);
    assert(legalUpdateSchema.safeParse({ ...valid, content }).success);
    assert.equal(
      legalUpdateSchema.safeParse({ ...valid, content, isDraft: false })
        .success,
      false,
    );
    assert.doesNotMatch(content, /2\.31\.126\.173|duckdns\.org/);
  }
  assert.equal(privacyHref(""), "/privacy");
  assert.equal(
    privacyHref("https://example.test/privacy"),
    "https://example.test/privacy",
  );
});
