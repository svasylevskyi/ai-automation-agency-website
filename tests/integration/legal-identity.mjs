import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

export async function checkLegalIdentity(db) {
  const client = await db().connect();
  const migration = await readFile(
    new URL("../../migrations/008-legal-identity.sql", import.meta.url),
    "utf8",
  );
  try {
    await client.query("BEGIN");
    await client.query("CREATE SCHEMA integration_legal_identity");
    await client.query("SET LOCAL search_path TO integration_legal_identity");
    await client.query(
      await readFile(
        new URL("../../migrations/003-legal-pages.sql", import.meta.url),
        "utf8",
      ),
    );
    const expected = [];
    for (const slug of ["privacy", "terms"]) {
      // Freeze migration 008's historical input rather than deriving it from
      // today's editable templates.
      const legacy =
        slug === "privacy"
          ? "This Privacy Policy explains how personal data is handled when you visit this website, and contact [LEGAL_NAME], operating as [TRADING_NAME]."
          : "[LEGAL_NAME] operates [TRADING_NAME] at [WEBSITE_URL].";
      const content = legacy
        .replaceAll("[LEGAL_NAME]", "Stepan Vasylevskyi - InfoTech Consulting")
        .replaceAll("[TRADING_NAME]", "Get Automated")
        .replaceAll("[WEBSITE_URL]", "https://get-automated.ai")
        .replace(
          "when you visit this website,",
          "when you visit https://get-automated.ai,",
        );
      const amendment = "\n\nOwner's additional wording.";
      await client.query(
        "INSERT INTO legal_pages (slug,title,content,version,updated_at) VALUES ($1,$2,$3,7,'2020-01-01')",
        [slug, "Custom " + slug, legacy + amendment],
      );
      expected.push({
        slug,
        title: "Custom " + slug,
        content: content + amendment,
        version: 8,
        is_draft: true,
      });
    }
    const rows = async () =>
      (
        await client.query(
          "SELECT slug,title,content,version,is_draft FROM legal_pages ORDER BY slug",
        )
      ).rows;
    await client.query(migration);
    assert.deepEqual(await rows(), expected);
    assert.equal(
      (
        await client.query(
          "SELECT count(*)::int AS count FROM legal_pages WHERE updated_at > '2020-01-01'",
        )
      ).rows[0].count,
      2,
    );

    // Reapplying is harmless, including for an already approved, customised page.
    await client.query(
      "UPDATE legal_pages SET title='Approved terms',content='Owner-approved custom terms for Get Automated.',is_draft=false WHERE slug='terms'",
    );
    const before = (
      await client.query("SELECT * FROM legal_pages ORDER BY slug")
    ).rows;
    await client.query(migration);
    assert.deepEqual(
      (await client.query("SELECT * FROM legal_pages ORDER BY slug")).rows,
      before,
    );
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}
